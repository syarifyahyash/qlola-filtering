/**
 * Memformat angka menjadi format Rupiah standar Indonesia.
 */
export function formatRupiah(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Konversi serial tanggal Excel menjadi string tanggal yang dapat dibaca.
 */
export function formatExcelDate(serial) {
  if (!serial) return '-';
  if (typeof serial === 'string' && serial.includes('-')) return serial;
  try {
    // Excel serial date: 1 = 1 Jan 1900
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return String(serial);
  }
}
