/**
 * Engine rekonsiliasi & matching transaksi antara DataQlola dan BukuBank.
 *
 * ALUR LOGIKA:
 * - Sumber utama iterasi adalah baris-baris pada DataQlola (QL).
 * - Untuk setiap baris QL, cari semua baris BukuBank (BB) yang memiliki
 *   deskripsi PERSIS SAMA dan nominal SAMA PERSIS.
 * - Jika ditemukan tepat 1 kecocokan → status MATCHED, tampilkan nama penerima dari BB.
 * - Jika ditemukan >1 kecocokan → status PERLU_REVIEW (ambigu, perlu cek manual).
 * - Jika tidak ada kecocokan → status BELUM_DIAMBIL.
 * - Nominal 0 diabaikan (sudah difilter di tahap parsing).
 */

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

  // Buat lookup BukuBank: key = deskripsi exact string
  // Satu deskripsi bisa memiliki lebih dari satu entri (edge case)
  const bbByDesc = new Map();
  bbData.forEach(bbRow => {
    const key = bbRow.deskripsi;
    if (!bbByDesc.has(key)) bbByDesc.set(key, []);
    bbByDesc.get(key).push(bbRow);
  });

  const results = qlData.map((qlRow, idx) => {
    const qlDesc = qlRow.deskripsi;
    const qlNom = qlRow.nominal;

    // Ambil semua baris BB dengan deskripsi persis sama
    const descMatches = bbByDesc.get(qlDesc) || [];

    // Filter lebih lanjut: nominal juga harus sama persis
    const nominalMatches = descMatches.filter(bb => bb.nominal === qlNom);

    if (nominalMatches.length === 0) {
      // Tidak ditemukan kecocokan apapun
      return {
        id: `REC-${idx + 1}`,
        qlRow,
        bbMatches: [],
        status: 'BELUM_DIAMBIL',
        statusLabel: 'Belum Diambil',
        namaPenerima: '-',
        nominal: qlNom,
        deskripsi: qlDesc,
      };
    }

    if (nominalMatches.length === 1) {
      // Tepat 1 kecocokan → ideal, tampilkan nama penerima
      const matched = nominalMatches[0];
      return {
        id: `REC-${idx + 1}`,
        qlRow,
        bbMatches: nominalMatches,
        status: 'MATCHED',
        statusLabel: 'Cocok',
        namaPenerima: matched.namaPenerima || '(Nama kosong di Buku Bank)',
        nominal: qlNom,
        deskripsi: qlDesc,
      };
    }

    // Lebih dari 1 kecocokan → perlu review manual
    return {
      id: `REC-${idx + 1}`,
      qlRow,
      bbMatches: nominalMatches,
      status: 'PERLU_REVIEW',
      statusLabel: 'Perlu Review',
      // Tampilkan semua nama yang ditemukan untuk memudahkan review
      namaPenerima: nominalMatches.map(bb => bb.namaPenerima).join(' | '),
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

  const totalNominal = results.reduce((s, r) => s + r.nominal, 0);
  const matchedNominal = matched.reduce((s, r) => s + r.nominal, 0);
  const reviewNominal = needsReview.reduce((s, r) => s + r.nominal, 0);
  const unmatchedNominal = unmatched.reduce((s, r) => s + r.nominal, 0);

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
