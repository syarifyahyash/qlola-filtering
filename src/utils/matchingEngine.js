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
 * 5. Pengecekan Blok Wanita (opsional):
 *    - BELUM_DIAMBIL di Buku Bank tetapi tercatat di Blok Wanita dengan nominal sama
 *      -> dianggap MATCHED (Cocok), sumber = BLOK_WANITA.
 *    - Setiap hasil menyimpan `matchSource` (BUKU_BANK / BLOK_WANITA / KEDUANYA)
 *      agar asal kecocokan bisa ditampilkan langsung di kolom Status.
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
      matchSource: null,
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
        matchSource: 'BUKU_BANK',
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
      matchSource: 'BUKU_BANK',
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
      matchSource: 'BUKU_BANK',
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
    matchSource: 'BUKU_BANK',
    namaPenerima: matches.map(m => `${m.namaPenerima} (${formatRupiah(m.nominal)})`).join(' | '),
    nominal: qlNom,
    deskripsi: qlDesc,
  };
}

/**
 * Siapkan entri Blok Wanita (opsional) untuk pengecekan kedua.
 * Deskripsi Blok Wanita sudah dirapikan saat parsing, jadi cukup normalisasi.
 */
function prepareBlokWanita(bwData) {
  return bwData.map(b => ({
    ...b,
    normDesc: normalizeDesc(b.deskripsi),
    coreRef: extractCoreRef(b.deskripsi),
  }));
}

/**
 * Cek satu baris hasil rekonsiliasi terhadap data Blok Wanita.
 * Tidak mengubah status utama (Cocok/Review/Belum) — hanya informasi tambahan.
 */
function checkBlokWanitaRow(result, preparedBW) {
  const qlNorm = normalizeDesc(result.deskripsi);
  const qlRef = extractCoreRef(result.deskripsi);

  const matches = preparedBW.filter(b => isDescMatch(qlNorm, qlRef, b));

  if (matches.length === 0) {
    return { status: 'TIDAK_TERCATAT', matches: [], tanggalPenarikan: '' };
  }

  const sameNominal = matches.some(m => m.nominal === result.nominal);

  return {
    status: sameNominal ? 'TERCATAT' : 'NOMINAL_BEDA',
    matches: matches.map(m => ({
      _index: m._index,
      tanggalPenarikan: m.tanggalPenarikan,
      nominal: m.nominal,
      deskripsi: m.deskripsi,
    })),
    tanggalPenarikan: matches[0].tanggalPenarikan || '',
  };
}

/**
 * Jalankan proses rekonsiliasi secara sinkron.
 * @param {Array} qlData - Hasil parseDataQlola()
 * @param {Array} bbData - Hasil parseBukuBank()
 * @param {Array} [bwData] - Hasil parseBlokWanita() (opsional)
 * @returns {{ results: Array, summary: Object }}
 */
export function reconcile(qlData, bbData, bwData) {
  if (!qlData?.length || !bbData?.length) {
    return {
      results: [],
      summary: buildSummary([]),
    };
  }

  const preparedBB = prepareBukuBank(bbData);
  const results = qlData.map((qlRow, idx) => reconcileRow(qlRow, idx, preparedBB));
  const bwSummary = applyBlokWanita(results, bwData);

  return {
    results,
    summary: buildSummary(results, bwSummary),
  };
}

/**
 * Tentukan status akhir setelah pengecekan Blok Wanita.
 *
 * Aturan:
 *  - Cocok di Buku Bank (status MATCHED) tetap Cocok, sumbernya ditandai
 *    Buku Bank (atau "keduanya" bila juga tercatat di Blok Wanita).
 *  - Belum ada di Buku Bank tapi tercatat di Blok Wanita (nominal sama)
 *    -> dianggap COCOK dengan sumber Blok Wanita.
 *  - Belum ada di Buku Bank tapi ada di Blok Wanita dengan nominal berbeda
 *    -> PERLU_REVIEW.
 */
function classifyWithBlokWanita(result) {
  const check = result.blokWanita;
  if (!check) return;

  const bwTercatat = check.status === 'TERCATAT';
  const bbMatched = result.status === 'MATCHED';

  if (bbMatched) {
    result.matchSource = bwTercatat ? 'KEDUANYA' : 'BUKU_BANK';
    return;
  }

  if (result.status !== 'BELUM_DIAMBIL') return;

  if (bwTercatat) {
    result.status = 'MATCHED';
    result.statusLabel = 'Cocok';
    result.matchSource = 'BLOK_WANITA';
    result.namaPenerima = 'Tercatat di Blok Wanita';
    return;
  }

  if (check.status === 'NOMINAL_BEDA') {
    const bwNominal = check.matches[0]?.nominal;
    result.status = 'PERLU_REVIEW';
    result.statusLabel = 'Perlu Review';
    result.matchSource = 'BLOK_WANITA';
    result.namaPenerima = `Blok Wanita (Nominal BW: ${formatRupiah(bwNominal)})`;
  }
}

/**
 * Terapkan pengecekan Blok Wanita ke seluruh hasil rekonsiliasi.
 * @returns {Object|null} meta ringkasan Blok Wanita
 */
function applyBlokWanita(results, bwData) {
  if (!bwData?.length) return null;

  const preparedBW = prepareBlokWanita(bwData);
  const linked = new Set();
  let tercatat = 0;
  let nominalBeda = 0;
  let tidakTercatat = 0;
  let tercatatNominal = 0;

  for (const result of results) {
    const check = checkBlokWanitaRow(result, preparedBW);
    result.blokWanita = check;
    classifyWithBlokWanita(result);

    if (check.status === 'TERCATAT') {
      tercatat++;
      tercatatNominal += result.nominal || 0;
    } else if (check.status === 'NOMINAL_BEDA') {
      nominalBeda++;
    } else {
      tidakTercatat++;
    }

    for (const m of check.matches) linked.add(m._index);
  }

  const totalNominal = bwData.reduce((s, b) => s + (b.nominal || 0), 0);

  return {
    checked: true,
    totalRows: bwData.length,
    totalNominal,
    tercatat,
    nominalBeda,
    tidakTercatat,
    tercatatNominal,
    linkedRows: linked.size,
    unlinkedRows: bwData.length - linked.size,
  };
}

/**
 * Versi asinkron dari reconcile() untuk dataset besar.
 * Memproses baris per baris dan secara berkala "yield" ke event loop
 * supaya browser tetap responsif, sambil melaporkan progres.
 *
 * @param {Array} qlData - Hasil parseDataQlola()
 * @param {Array} bbData - Hasil parseBukuBank()
 * @param {{
 *   onProgress?: (percent: number, processed: number, total: number, phase?: 'matching'|'blok-wanita') => void,
 *   signal?: AbortSignal,
 *   blokWanita?: Array,
 * }} options
 * @returns {Promise<{ results: Array, summary: Object }>}
 */
export async function reconcileAsync(qlData, bbData, { onProgress, signal, blokWanita } = {}) {
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
  const hasBW = Boolean(blokWanita?.length);
  // Pencocokan utama memakai 0-80% dari progres bila ada pengecekan Blok Wanita.
  const mainScale = hasBW ? 0.8 : 1;

  onProgress?.(0, 0, total, 'matching');

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
        onProgress?.(Math.round(((i + 1) / total) * 100 * mainScale), i + 1, total, 'matching');

        // Beri kesempatan browser melukis ulang UI / memproses input
        await yielder.yieldToUi();
        lastYield = now();
      }
    }

    let bwSummary = null;
    if (hasBW) {
      const preparedBW = prepareBlokWanita(blokWanita);
      const linked = new Set();
      let tercatat = 0;
      let nominalBeda = 0;
      let tidakTercatat = 0;
      let tercatatNominal = 0;
      lastYield = now();

      for (let i = 0; i < total; i++) {
        if (signal?.aborted) {
          const err = new Error('Pengecekan Blok Wanita dibatalkan');
          err.name = 'AbortError';
          throw err;
        }

        const check = checkBlokWanitaRow(results[i], preparedBW);
        results[i].blokWanita = check;
        classifyWithBlokWanita(results[i]);

        if (check.status === 'TERCATAT') {
          tercatat++;
          tercatatNominal += results[i].nominal || 0;
        } else if (check.status === 'NOMINAL_BEDA') {
          nominalBeda++;
        } else {
          tidakTercatat++;
        }

        for (const m of check.matches) linked.add(m._index);

        if (i === total - 1 || now() - lastYield >= MAX_WORK_MS) {
          onProgress?.(Math.round(80 + ((i + 1) / total) * 20), i + 1, total, 'blok-wanita');
          await yielder.yieldToUi();
          lastYield = now();
        }
      }

      bwSummary = {
        checked: true,
        totalRows: blokWanita.length,
        totalNominal: blokWanita.reduce((s, b) => s + (b.nominal || 0), 0),
        tercatat,
        nominalBeda,
        tidakTercatat,
        tercatatNominal,
        linkedRows: linked.size,
        unlinkedRows: blokWanita.length - linked.size,
      };
    }

    return {
      results,
      summary: buildSummary(results, bwSummary),
    };
  } finally {
    yielder.dispose();
  }
}

function buildSummary(results, blokWanita = null) {
  let matchedCount = 0;
  let reviewCount = 0;
  let unmatchedCount = 0;
  let totalNominal = 0;
  let matchedNominal = 0;
  let reviewNominal = 0;
  let unmatchedNominal = 0;

  for (const r of results) {
    const nominal = r.nominal || 0;
    totalNominal += nominal;

    if (r.status === 'MATCHED') {
      matchedCount++;
      matchedNominal += nominal;
    } else if (r.status === 'PERLU_REVIEW') {
      reviewCount++;
      reviewNominal += nominal;
    } else if (r.status === 'BELUM_DIAMBIL') {
      unmatchedCount++;
      unmatchedNominal += nominal;
    }
  }

  const matchPct = results.length > 0 ? Math.round((matchedCount / results.length) * 100) : 0;

  return {
    totalTransaksi: results.length,
    matched: matchedCount,
    perluReview: reviewCount,
    belumDiambil: unmatchedCount,
    totalNominal,
    matchedNominal,
    reviewNominal,
    unmatchedNominal,
    matchPercentage: matchPct,
    blokWanita,
  };
}
