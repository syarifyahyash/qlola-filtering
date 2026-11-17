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
 */

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
 * Periksa apakah deskripsi QLola dan deskripsi Buku Bank cocok.
 */
function isDescMatch(qlDesc, bbRawDesc) {
  const qlNorm = normalizeDesc(qlDesc);
  const bbClean = extractBukuBankDesc(bbRawDesc);
  const bbNorm = normalizeDesc(bbClean);

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
  const qlRef = extractCoreRef(qlDesc);
  const bbRef = extractCoreRef(bbRawDesc);
  if (qlRef && bbRef && qlRef === bbRef) {
    return true;
  }

  return false;
}

/**
 * Jalankan proses rekonsiliasi.
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

  // Siapkan entri Buku Bank
  const preparedBB = bbData.map(b => ({
    ...b,
    cleanDesc: extractBukuBankDesc(b.deskripsi),
    normDesc: normalizeDesc(extractBukuBankDesc(b.deskripsi)),
    coreRef: extractCoreRef(b.deskripsi),
  }));

  const results = qlData.map((qlRow, idx) => {
    const qlDesc = qlRow.deskripsi;
    const qlNom = qlRow.nominal;

    // Cari semua baris Buku Bank yang cocok secara deskripsi
    const matches = preparedBB.filter(bb => isDescMatch(qlDesc, bb.deskripsi));

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
  });

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
