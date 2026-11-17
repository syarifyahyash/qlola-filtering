import * as XLSX from 'xlsx';

/**
 * Parse file BukuBank dari Excel atau CSV.
 * 
 * Struktur file BukuBank:
 *  - Header laporan di atas (Judul, Tanggal, dll)
 *  - Baris header kolom:
 *      No | Nomor Voucher | Deskripsi | User Input | Nama Narapidana/Penerima | Nominal | ...
 *  - Baris data transaksi
 * 
 * Kolom yang dipakai:
 *  - Deskripsi (biasanya kolom index 2)
 *  - Nama Penerima (biasanya kolom index 4)
 *  - Nominal (biasanya kolom index 5)
 */
export function parseBukuBank(fileArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(fileArrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Cari baris header kolom secara dinamis
  let headerIdx = rows.findIndex(row => {
    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
    return rowStr.includes('deskripsi') &&
           (rowStr.includes('voucher') || rowStr.includes('nominal') || rowStr.includes('narapidana') || rowStr.includes('penerima') || rowStr.includes('no'));
  });

  if (headerIdx === -1) {
    // Default fallback ke baris ke-4 (index 3) jika tidak terdeteksi
    headerIdx = 3;
  }

  const headerRow = rows[headerIdx] || [];

  // Cari index kolom secara dinamis
  let deskCol = headerRow.findIndex(c => /deskripsi/i.test(String(c)));
  let namaCol = headerRow.findIndex(c => /nama|narapidana|penerima/i.test(String(c)));
  let nomCol = headerRow.findIndex(c => /^nominal$/i.test(String(c).trim()));
  let voucherCol = headerRow.findIndex(c => /voucher/i.test(String(c)));

  if (deskCol === -1) deskCol = 2;
  if (namaCol === -1) namaCol = 4;
  if (nomCol === -1) nomCol = 5;
  if (voucherCol === -1) voucherCol = 1;

  const dataRows = rows.slice(headerIdx + 1);

  return dataRows
    .filter(row => {
      const deskripsi = String(row[deskCol] || '').trim();
      const rawNom = row[nomCol];
      const nominal = typeof rawNom === 'number' ? rawNom : Number(String(rawNom || '').replace(/[^0-9.-]/g, '')) || 0;
      // Abaikan baris kosong dan nominal 0 atau baris TOTAL
      const isTotalRow = String(row[0] || '').toUpperCase().includes('TOTAL') || deskripsi.toUpperCase().includes('TOTAL');
      return deskripsi.length > 0 && nominal > 0 && !isTotalRow;
    })
    .map((row, idx) => {
      const rawNom = row[nomCol];
      const nominal = typeof rawNom === 'number' ? rawNom : Number(String(rawNom || '').replace(/[^0-9.-]/g, '')) || 0;
      return {
        _rowIndex: headerIdx + 2 + idx,
        nomorVoucher: String(row[voucherCol] || '').trim(),
        deskripsi: String(row[deskCol] || '').trim(),
        userInput: String(row[3] || '').trim(),
        namaPenerima: String(row[namaCol] || '').trim(),
        nominal,
      };
    });
}

/**
 * Parse file DataQlola dari Excel atau CSV.
 * 
 * Struktur file DataQlola:
 *  - Baris header kolom:
 *      ID_NUM | SEQ | NO_REK | NAMA | VALUTA | JENIS_REKENING |
 *      DATE | JAM_TRAN | KODE_TRAN | DESK_TRAN |
 *      SALDO_AWAL | MUTASI_DEBET | MUTASI_KREDIT | ...
 *  - Baris data transaksi
 */
export function parseDataQlola(fileArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(fileArrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Cari baris header secara dinamis
  let headerIdx = rows.findIndex(row => {
    const rowStr = row.map(c => String(c).toUpperCase()).join(' ');
    return (rowStr.includes('DESK_TRAN') || rowStr.includes('DESKRIPSI')) &&
           (rowStr.includes('MUTASI') || rowStr.includes('KREDIT') || rowStr.includes('NOMINAL'));
  });

  if (headerIdx === -1) {
    headerIdx = 0; // Default baris 1
  }

  const headerRow = rows[headerIdx] || [];

  let deskCol = headerRow.findIndex(c => /DESK_TRAN|DESKRIPSI/i.test(String(c)));
  let nomCol = headerRow.findIndex(c => /MUTASI_KREDIT|KREDIT|NOMINAL/i.test(String(c)));
  let dateCol = headerRow.findIndex(c => /^DATE$|^TANGGAL$/i.test(String(c)));
  let jamCol = headerRow.findIndex(c => /JAM_TRAN|JAM/i.test(String(c)));
  let idCol = headerRow.findIndex(c => /ID_NUM|^NO$/i.test(String(c)));

  if (deskCol === -1) deskCol = 9;
  if (nomCol === -1) nomCol = 12;
  if (dateCol === -1) dateCol = 6;
  if (jamCol === -1) jamCol = 7;
  if (idCol === -1) idCol = 0;

  const dataRows = rows.slice(headerIdx + 1);

  return dataRows
    .filter(row => {
      const deskripsi = String(row[deskCol] || '').trim();
      const rawNom = row[nomCol];
      const nominal = typeof rawNom === 'number' ? rawNom : Number(String(rawNom || '').replace(/[^0-9.-]/g, '')) || 0;
      const isTotalRow = String(row[0] || '').toUpperCase().includes('TOTAL') || deskripsi.toUpperCase().includes('TOTAL');
      return deskripsi.length > 0 && nominal > 0 && !isTotalRow;
    })
    .map((row, idx) => {
      const rawNom = row[nomCol];
      const nominal = typeof rawNom === 'number' ? rawNom : Number(String(rawNom || '').replace(/[^0-9.-]/g, '')) || 0;
      return {
        _rowIndex: headerIdx + 2 + idx,
        idNum: row[idCol] || (idx + 1),
        seq: row[1],
        tanggal: row[dateCol],
        jamTran: row[jamCol],
        kodeTran: row[8],
        deskripsi: String(row[deskCol] || '').trim(),
        nominal,
      };
    });
}
