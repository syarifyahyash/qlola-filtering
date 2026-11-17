import * as XLSX from 'xlsx';

/**
 * Parse file BukuBank dari Excel.
 * 
 * Struktur file BukuBank:
 *  - Baris 1-3: Header laporan (judul, tanggal, kosong)
 *  - Baris 4 (index 3): Header kolom:
 *      [0] No | [1] Nomor Voucher | [2] Deskripsi | [3] User Input |
 *      [4] Nama Narapidana/Penerima | [5] Nominal | ...
 *  - Baris 5+ (index 4+): Data transaksi
 * 
 * Kolom yang dipakai:
 *  - Kolom C (index 2): Deskripsi
 *  - Kolom E (index 4): Nama Penerima
 *  - Kolom F (index 5): Nominal
 */
export function parseBukuBank(fileArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(fileArrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Data mulai dari baris ke-5 (index 4), setelah 3 baris header laporan + 1 baris header kolom
  const dataRows = rows.slice(4);

  return dataRows
    .filter(row => {
      const deskripsi = String(row[2] || '').trim();
      const nominal = Number(row[5]);
      // Abaikan baris kosong dan nominal 0
      return deskripsi.length > 0 && nominal > 0;
    })
    .map((row, idx) => ({
      _rowIndex: idx + 5, // nomor baris di Excel (untuk referensi debug)
      nomorVoucher: String(row[1] || '').trim(),
      deskripsi: String(row[2] || '').trim(),
      userInput: String(row[3] || '').trim(),
      namaPenerima: String(row[4] || '').trim(),
      nominal: Number(row[5]),
    }));
}

/**
 * Parse file DataQlola dari Excel.
 * 
 * Struktur file DataQlola:
 *  - Baris 1 (index 0): Header kolom:
 *      [0] ID_NUM | [1] SEQ | [2] NO_REK | [3] NAMA | [4] VALUTA | [5] JENIS_REKENING |
 *      [6] DATE | [7] JAM_TRAN | [8] KODE_TRAN | [9] DESK_TRAN |
 *      [10] SALDO_AWAL | [11] MUTASI_DEBET | [12] MUTASI_KREDIT | ...
 *  - Baris 2+ (index 1+): Data transaksi
 * 
 * Kolom yang dipakai:
 *  - Kolom J (index 9): DESK_TRAN (deskripsi transaksi)
 *  - Kolom M (index 12): MUTASI_KREDIT (nominal)
 */
export function parseDataQlola(fileArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(fileArrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Data mulai dari baris ke-2 (index 1), setelah 1 baris header kolom
  const dataRows = rows.slice(1);

  return dataRows
    .filter(row => {
      const deskripsi = String(row[9] || '').trim();
      const nominal = Number(row[12]);
      // Abaikan baris kosong dan nominal 0
      return deskripsi.length > 0 && nominal > 0;
    })
    .map((row, idx) => ({
      _rowIndex: idx + 2,
      idNum: row[0],
      seq: row[1],
      tanggal: row[6], // nilai tanggal Excel serial
      jamTran: row[7],
      kodeTran: row[8],
      deskripsi: String(row[9] || '').trim(),
      saldoAwal: Number(row[10]),
      mutasiDebet: Number(row[11]),
      nominal: Number(row[12]), // MUTASI_KREDIT
      saldoAkhir: Number(row[13]),
    }));
}
