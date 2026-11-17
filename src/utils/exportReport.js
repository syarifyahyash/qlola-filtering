/**
 * Export laporan hasil rekonsiliasi ke file CSV.
 */

function toCSV(headers, rows) {
  const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headerRow = headers.map(escape).join(',');
  const dataRows = rows.map(row => row.map(escape).join(','));
  // UTF-8 BOM agar Excel Windows tidak salah encoding
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

function download(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ts() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** Export semua hasil rekonsiliasi */
export function exportAllToCSV(records) {
  const headers = ['No', 'Deskripsi QLola', 'Nominal (IDR)', 'Status', 'Nama Penerima'];
  const rows = records.map((r, i) => [
    i + 1,
    r.deskripsi,
    r.nominal,
    r.statusLabel,
    r.namaPenerima,
  ]);
  download(toCSV(headers, rows), `Rekonsiliasi_Semua_${ts()}.csv`);
}

/** Export hanya transaksi BELUM_DIAMBIL */
export function exportBelumDiambilToCSV(records) {
  const unmatched = records.filter(r => r.status === 'BELUM_DIAMBIL');
  const headers = ['No', 'Deskripsi QLola', 'Nominal (IDR)', 'Status'];
  const rows = unmatched.map((r, i) => [i + 1, r.deskripsi, r.nominal, r.statusLabel]);
  download(toCSV(headers, rows), `Transaksi_Belum_Diambil_${ts()}.csv`);
}

/** Export hanya transaksi PERLU_REVIEW */
export function exportPerluReviewToCSV(records) {
  const review = records.filter(r => r.status === 'PERLU_REVIEW');
  const headers = ['No', 'Deskripsi QLola', 'Nominal (IDR)', 'Kandidat Nama Penerima'];
  const rows = review.map((r, i) => [i + 1, r.deskripsi, r.nominal, r.namaPenerima]);
  download(toCSV(headers, rows), `Perlu_Review_${ts()}.csv`);
}

export function printReport() {
  window.print();
}
