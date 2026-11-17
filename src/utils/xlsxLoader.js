/**
 * Lazy loader untuk library xlsx (SheetJS).
 *
 * Library ini cukup besar (~400KB), padahal baru dibutuhkan saat user
 * meng-upload file atau menekan tombol Export. Dengan dynamic import,
 * bundle awal aplikasi tetap kecil dan halaman pertama lebih cepat dibuka.
 */
let xlsxPromise;

export function loadXLSX() {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx');
  }
  return xlsxPromise;
}
