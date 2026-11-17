import { formatRupiah } from './normalizer';

/**
 * Engine rekonsiliasi & matching transaksi antara DataQlola dan BukuBank.
 *
 * ALUR LOGIKA:
 * 1. Setiap baris mutasi QLola dicocokkan dengan entri Buku Bank.
 * 2. Deskripsi Buku Bank sering kali memuat kode teller/user, tanda '-',
 *    dan nominal yang terformat (baik di baris baru / multiline atau di akhir baris).
 *    Fungsi extractBukuBankDesc mengekstrak deskripsi murni transaksi.
 * 3. Kecocokan deskripsi mencakup:
 *    - Persis sama setelah normalisasi spasi
 *    - Prefix match (menangani pemotongan 112 karakter pada nomor FASTIDJA transaksi BFST di Buku Bank)
 *    - Substring match
 *    - Core Reference ID (kode referensi unik ESB, GoPay ID, DANA ID)
 * 4. Pengecekan Nominal & Split Transaksi:
 *    - Tepat 1 kecocokan dengan nominal sama -> MATCHED (Cocok)
 *    - Tepat 1 kecocokan dengan nominal berbeda -> PERLU_REVIEW
 *    - >1 kecocokan di mana total nominalnya sama persis dengan QLola -> MATCHED (Transaksi Dibagi)
 *    - >1 kecocokan di mana total nominalnya tidak sama -> PERLU_REVIEW
 *    - Tidak ditemukan kecocokan sama sekali -> BELUM_DIAMBIL
 *
 * CATATAN PERFORMA:
 * Proses untuk ribuan transaksi bisa memakan waktu beberapa detik. Karena itu
 * reconcileAsync() memproses baris secara bertahap (chunked) dan mengembalikan
 * kontrol ke browser secara berkala agar UI tidak "not responding".
 * Deskripsi & core reference Buku Bank juga di-precompute sekali saja
 * (bukan di-regex ulang untuk setiap pasangan QLola x Buku Bank).
 */

/** Batas waktu kerja sebelum menyerahkan kontrol ke browser (ms). */
const MAX_WORK_MS = 12;

function now() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/**
 * Membuat fungsi "yield" yang mengembalikan kontrol ke event loop tanpa
 * penundaan timer. setTimeout(0) dibatasi ~4ms (bahkan ~15ms di Windows),
 * sehingga untuk ribuan baris MessageChannel jauh lebih cepat.
 */
function createYield() {
  if (typeof MessageChannel === 'undefined') {
    return {
      yieldToUi: () => new Promise(resolve => setTimeout(resolve, 0)),
      dispose: () => {},
    };
  }

  const channel = new MessageChannel();
  let pendingResolve = null;

  channel.port1.onmessage = () => {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.();
  };

  return {
    yieldToUi: () => new Promise(resolve => {
      pendingResolve = resolve;
      channel.port2.postMessage(null);
    }),
    dispose: () => {
      pendingResolve = null;
      channel.port1.close();
      channel.port2.close();
    },
  };
}


/**
 * Normalisasi string teks: hilangkan spasi berlebih, huruf besar semua.
 */
function normalizeDesc(str) {
  return String(str || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Ekstrak deskripsi transaksi murni dari kolom Deskripsi Buku Bank.
 */
function extractBukuBankDesc(rawDesc) {
  if (!rawDesc) return '';
  // Ambil baris pertama jika multiline
  let line = String(rawDesc).split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || '';
  // Hapus suffix teller dan nominal jika ada di baris yang sama, misal: " ... 0371897 - 250,000.00"
  line = line.replace(/\s+\d{5,8}\s*-\s*[\d,.]+(?:\.00)?(?:\s+DIBAGI.*)?$/i, '');
  return line.trim();
}

/**
 * Ekstrak ID/kode transaksi inti jika tersedia (ESB ref, GoPay ID, DANA ID).
 */
function extractCoreRef(desc) {
  if (!desc) return '';
  const s = String(desc).toUpperCase();
  const esbMatch = s.match(/ESB:[A-Z0-9]+:[A-Z0-9]+:[A-Z0-9]+/);
  if (esbMatch) return esbMatch[0];
  const gopayMatch = s.match(/ID26\d{10,}[A-Z0-9]+/);
  if (gopayMatch) return gopayMatch[0];
  const danaMatch = s.match(/DANA\d{16,}/);
  if (danaMatch) return danaMatch[0];
  return '';
}

/**
 * Siapkan entri Buku Bank sekali saja (normalisasi deskripsi + ekstraksi core ref).
 */
function prepareBukuBank(bbData) {
  return bbData.map(b => ({
    ...b,
    cleanDesc: extractBukuBankDesc(b.deskripsi),
    normDesc: normalizeDesc(extractBukuBankDesc(b.deskripsi)),
    coreRef: extractCoreRef(b.deskripsi),
  }));
}

/**
 * Periksa apakah deskripsi QLola dan entri Buku Bank cocok.
 * @param {string} qlNorm - deskripsi QLola yang sudah dinormalisasi
 * @param {string} qlRef - core reference QLola
 * @param {{normDesc: string, coreRef: string}} bb - entri Buku Bank ter-precompute
 */
function isDescMatch(qlNorm, qlRef, bb) {
  const bbNorm = bb.normDesc;

  if (!qlNorm || !bbNorm) return false;

  // 1. Exact match setelah normalisasi
  if (qlNorm === bbNorm) return true;

  // 2. Prefix match (menangani pemotongan karakter FASTIDJA pada BFST)
  if (bbNorm.length >= 25 && (qlNorm.startsWith(bbNorm) || bbNorm.startsWith(qlNorm))) {
    return true;
  }

  // 3. Substring match
  if (bbNorm.length >= 25 && (qlNorm.includes(bbNorm) || bbNorm.includes(qlNorm))) {
    return true;
  }

  // 4. Core reference ID match
  if (qlRef && bb.coreRef && qlRef === bb.coreRef) {
    return true;
  }

  return false;
}

/**
 * Bentuk satu baris hasil rekonsiliasi untuk sebuah transaksi QLola.
 */
function reconcileRow(qlRow, idx, preparedBB) {
  const qlDesc = qlRow.deskripsi;
  const qlNom = qlRow.nominal;
  const qlNorm = normalizeDesc(qlDesc);
  const qlRef = extractCoreRef(qlDesc);

  // Cari semua baris Buku Bank yang cocok secara deskripsi
  const matches = preparedBB.filter(bb => isDescMatch(qlNorm, qlRef, bb));

  if (matches.length === 0) {
    // Tidak ditemukan kecocokan sama sekali di Buku Bank
    return {
      id: `REC-${idx + 1}`,
      qlRow,
      tanggal: qlRow.tanggal,
      jamTran: qlRow.jamTran,
      bbMatches: [],
      status: 'BELUM_DIAMBIL',
      statusLabel: 'Belum Diambil',
      namaPenerima: '-',
      nominal: qlNom,
      deskripsi: qlDesc,
    };
  }

  if (matches.length === 1) {
    const matched = matches[0];
    if (matched.nominal === qlNom) {
      // Tepat 1 kecocokan dengan nominal persis sama -> MATCHED
      return {
        id: `REC-${idx + 1}`,
        qlRow,
        tanggal: qlRow.tanggal,
        jamTran: qlRow.jamTran,
        bbMatches: matches,
        status: 'MATCHED',
        statusLabel: 'Cocok',
        namaPenerima: matched.namaPenerima || '(Nama kosong di Buku Bank)',
        nominal: qlNom,
        deskripsi: qlDesc,
      };
    }

    // Deskripsi cocok tapi nominal berbeda
    return {
      id: `REC-${idx + 1}`,
      qlRow,
      tanggal: qlRow.tanggal,
      jamTran: qlRow.jamTran,
      bbMatches: matches,
      status: 'PERLU_REVIEW',
      statusLabel: 'Perlu Review',
      namaPenerima: `${matched.namaPenerima} (Nominal BB: ${formatRupiah(matched.nominal)})`,
      nominal: qlNom,
      deskripsi: qlDesc,
    };
  }

  // matches.length > 1 (Lebih dari 1 voucher Buku Bank)
  const sumNominalBB = matches.reduce((s, m) => s + (m.nominal || 0), 0);

  if (sumNominalBB === qlNom) {
    // Transaksi dibagi (split), total nominal cocok persis -> MATCHED
    const penerimaList = matches
      .map(m => `${m.namaPenerima} (${formatRupiah(m.nominal)})`)
      .join(' + ');

    return {
      id: `REC-${idx + 1}`,
      qlRow,
      tanggal: qlRow.tanggal,
      jamTran: qlRow.jamTran,
      bbMatches: matches,
      status: 'MATCHED',
      statusLabel: 'Cocok (Dibagi)',
      namaPenerima: penerimaList,
      nominal: qlNom,
      deskripsi: qlDesc,
    };
  }

  // Jika sum nominal tidak sama dengan mutasi QLola
  return {
    id: `REC-${idx + 1}`,
    qlRow,
    tanggal: qlRow.tanggal,
    jamTran: qlRow.jamTran,
    bbMatches: matches,
    status: 'PERLU_REVIEW',
    statusLabel: 'Perlu Review',
    namaPenerima: matches.map(m => `${m.namaPenerima} (${formatRupiah(m.nominal)})`).join(' | '),
    nominal: qlNom,
    deskripsi: qlDesc,
  };
}

/**
 * Jalankan proses rekonsiliasi secara sinkron.
 * @param {Array} qlData - Hasil parseDataQlola()
 * @param {Array} bbData - Hasil parseBukuBank()
 * @returns {{ results: Array, summary: Object }}
 */
export function reconcile(qlData, bbData) {
  if (!qlData?.length || !bbData?.length) {
    return {
      results: [],
      summary: buildSummary([]),
    };
  }

  const preparedBB = prepareBukuBank(bbData);
  const results = qlData.map((qlRow, idx) => reconcileRow(qlRow, idx, preparedBB));

  return {
    results,
    summary: buildSummary(results),
  };
}

/**
 * Versi asinkron dari reconcile() untuk dataset besar.
 * Memproses baris per baris dan secara berkala "yield" ke event loop
 * supaya browser tetap responsif, sambil melaporkan progres.
 *
 * @param {Array} qlData - Hasil parseDataQlola()
 * @param {Array} bbData - Hasil parseBukuBank()
 * @param {{ onProgress?: (percent: number, processed: number, total: number) => void, signal?: AbortSignal }} options
 * @returns {Promise<{ results: Array, summary: Object }>}
 */
export async function reconcileAsync(qlData, bbData, { onProgress, signal } = {}) {
  if (!qlData?.length || !bbData?.length) {
    return {
      results: [],
      summary: buildSummary([]),
    };
  }

  const preparedBB = prepareBukuBank(bbData);
  const total = qlData.length;
  const results = new Array(total);
  const yielder = createYield();

  onProgress?.(0, 0, total);

  try {
    let lastYield = now();
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) {
        const err = new Error('Rekonsiliasi dibatalkan');
        err.name = 'AbortError';
        throw err;
      }

      results[i] = reconcileRow(qlData[i], i, preparedBB);

      const isLast = i === total - 1;
      if (isLast || now() - lastYield >= MAX_WORK_MS) {
        onProgress?.(Math.round(((i + 1) / total) * 100), i + 1, total);

        // Beri kesempatan browser melukis ulang UI / memproses input
        await yielder.yieldToUi();
        lastYield = now();
      }
    }
  } finally {
    yielder.dispose();
  }

  return {
    results,
    summary: buildSummary(results),
  };
}

function buildSummary(results) {
  const matched = results.filter(r => r.status === 'MATCHED');
  const needsReview = results.filter(r => r.status === 'PERLU_REVIEW');
  const unmatched = results.filter(r => r.status === 'BELUM_DIAMBIL');

  const totalNominal = results.reduce((s, r) => s + (r.nominal || 0), 0);
  const matchedNominal = matched.reduce((s, r) => s + (r.nominal || 0), 0);
  const reviewNominal = needsReview.reduce((s, r) => s + (r.nominal || 0), 0);
  const unmatchedNominal = unmatched.reduce((s, r) => s + (r.nominal || 0), 0);

  const matchPct = results.length > 0 ? Math.round((matched.length / results.length) * 100) : 0;

  return {
    totalTransaksi: results.length,
    matched: matched.length,
    perluReview: needsReview.length,
    belumDiambil: unmatched.length,
    totalNominal,
    matchedNominal,
    reviewNominal,
    unmatchedNominal,
    matchPercentage: matchPct,
  };
}
