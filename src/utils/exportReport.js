import * as XLSX from 'xlsx';

/** =========================================================
 *  exportReport.js
 *  Mengekspor hasil rekonsiliasi ke file CSV dan Excel (.xlsx)
 *  mengikuti format laporan resmi:
 * 
 *  Row 1: DAFTAR MUTASI QLOLA YANG BELUM DIKLAIM,,,,
 *  Row 2: TANGGAL 1 OKTOBER - 31 OKTOBER,,,,
 *  Row 3: Diakses pada Jam  18:30 WIB,,,,
 *  Row 4: NO,TGL,DARI/TUJUAN,MUTASI,DIAMBIL OLEH
 *  Row 5: ,,,MASUK,
 *  Row 6+: 1,2026-10-01 05:46:25,Deskripsi...,50000,
 *  Row Last: TOTAL,,,4007000,
 * ========================================================= */

const NAMA_BULAN = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

/**
 * Format tanggal dan waktu menjadi YYYY-MM-DD HH:mm:ss
 * Mendukung Excel serial number, Date object, string ISO, dan pemisahan jamTran.
 */
export function formatRowDateTime(tanggal, jamTran) {
  if (!tanggal && !jamTran) return '-';

  // Jika tanggal sudah berupa string lengkap "YYYY-MM-DD HH:mm:ss"
  if (typeof tanggal === 'string' && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(tanggal.trim())) {
    return tanggal.trim();
  }

  let year = null;
  let month = null;
  let day = null;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let hasTime = false;

  // 1. Parse komponen tanggal dari 'tanggal'
  if (typeof tanggal === 'number' || (!isNaN(Number(tanggal)) && String(tanggal).trim() !== '')) {
    const num = Number(tanggal);
    // Excel serial number (1 = 1 Jan 1900, 25569 = 1 Jan 1970)
    const totalMs = Math.round((num - 25569) * 86400000);
    const d = new Date(totalMs);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();

    // Jika serial Excel memiliki bagian pecahan (waktu)
    const frac = num % 1;
    if (frac > 0.00001) {
      hours = d.getUTCHours();
      minutes = d.getUTCMinutes();
      seconds = d.getUTCSeconds();
      hasTime = true;
    }
  } else if (tanggal instanceof Date) {
    year = tanggal.getFullYear();
    month = tanggal.getMonth() + 1;
    day = tanggal.getDate();
    hours = tanggal.getHours();
    minutes = tanggal.getMinutes();
    seconds = tanggal.getSeconds();
    hasTime = true;
  } else if (typeof tanggal === 'string') {
    const s = tanggal.trim();
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    } else {
      const ddmmyyyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (ddmmyyyy) {
        day = parseInt(ddmmyyyy[1], 10);
        month = parseInt(ddmmyyyy[2], 10);
        year = parseInt(ddmmyyyy[3], 10);
      }
    }

    const timeMatch = s.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      seconds = parseInt(timeMatch[3], 10);
      hasTime = true;
    }
  }

  // 2. Parse jam jika belum diperoleh dari tanggal
  if (!hasTime && jamTran !== undefined && jamTran !== null && jamTran !== '') {
    if (typeof jamTran === 'number') {
      const totalSec = Math.round(jamTran * 86400);
      hours = Math.floor(totalSec / 3600) % 24;
      minutes = Math.floor((totalSec % 3600) / 60);
      seconds = totalSec % 60;
    } else if (typeof jamTran === 'string') {
      const jt = jamTran.trim();
      const colonMatch = jt.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
      if (colonMatch) {
        hours = parseInt(colonMatch[1], 10);
        minutes = parseInt(colonMatch[2], 10);
        seconds = colonMatch[3] ? parseInt(colonMatch[3], 10) : 0;
      } else if (/^\d{6}$/.test(jt)) {
        hours = parseInt(jt.slice(0, 2), 10);
        minutes = parseInt(jt.slice(2, 4), 10);
        seconds = parseInt(jt.slice(4, 6), 10);
      } else if (/^\d{4}$/.test(jt)) {
        hours = parseInt(jt.slice(0, 2), 10);
        minutes = parseInt(jt.slice(2, 4), 10);
        seconds = 0;
      }
    }
  }

  if (!year || !month || !day) {
    return String(tanggal || '-');
  }

  const yStr = String(year).padStart(4, '0');
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const hStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  return `${yStr}-${mStr}-${dStr} ${hStr}:${minStr}:${sStr}`;
}

/**
 * Otomatis mengambil periode tanggal dari data transaksi,
 * contoh: "TANGGAL 1 OKTOBER - 31 OKTOBER"
 */
function getPeriodeText(records, customPeriode) {
  if (customPeriode && typeof customPeriode === 'string' && customPeriode.trim()) {
    return customPeriode.trim();
  }

  const validDates = [];
  for (const r of records) {
    const tgl = r.tanggal || r.qlRow?.tanggal;
    if (!tgl) continue;
    let d = null;
    if (typeof tgl === 'number' || (!isNaN(Number(tgl)) && String(tgl).trim() !== '')) {
      const ms = Math.round((Number(tgl) - 25569) * 86400000);
      d = new Date(ms);
    } else if (tgl instanceof Date) {
      d = tgl;
    } else if (typeof tgl === 'string') {
      const match = tgl.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        d = new Date(Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)));
      } else {
        const ddmmyyyy = tgl.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (ddmmyyyy) {
          d = new Date(Date.UTC(parseInt(ddmmyyyy[3], 10), parseInt(ddmmyyyy[2], 10) - 1, parseInt(ddmmyyyy[1], 10)));
        }
      }
    }
    if (d && !isNaN(d.getTime())) {
      validDates.push(d);
    }
  }

  if (validDates.length > 0) {
    validDates.sort((a, b) => a.getTime() - b.getTime());
    const minD = validDates[0];
    const maxD = validDates[validDates.length - 1];
    const minDay = minD.getUTCDate();
    const minBulan = NAMA_BULAN[minD.getUTCMonth()];
    const maxDay = maxD.getUTCDate();
    const maxBulan = NAMA_BULAN[maxD.getUTCMonth()];

    return `TANGGAL ${minDay} ${minBulan} - ${maxDay} ${maxBulan}`;
  }

  const now = new Date();
  const currentBulan = NAMA_BULAN[now.getMonth()];
  return `TANGGAL 1 ${currentBulan} - ${now.getDate()} ${currentBulan}`;
}

/**
 * String jam akses, contoh: "Diakses pada Jam  18:30 WIB"
 */
function getJamAksesText() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `Diakses pada Jam  ${hh}:${mm} WIB`;
}

/**
 * Standar escape untuk sel CSV.
 * Jika mengandung koma, kutip ganda, atau enter, bungkus dalam kutip ganda.
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Filter data rekonsiliasi sesuai mode
 */
function filterRecordsByMode(records, filterMode) {
  if (filterMode === 'belum') {
    return {
      filtered: records.filter(r => r.status === 'BELUM_DIAMBIL'),
      reportTitle: 'DAFTAR MUTASI QLOLA YANG BELUM DIKLAIM',
      modeLabel: 'BelumDiklaim',
    };
  }
  if (filterMode === 'review') {
    return {
      filtered: records.filter(r => r.status === 'PERLU_REVIEW'),
      reportTitle: 'DAFTAR MUTASI QLOLA YANG PERLU REVIEW',
      modeLabel: 'PerluReview',
    };
  }
  if (filterMode === 'matched') {
    return {
      filtered: records.filter(r => r.status === 'MATCHED'),
      reportTitle: 'DAFTAR MUTASI QLOLA YANG SUDAH DIKLAIM',
      modeLabel: 'SudahDiklaim',
    };
  }
  return {
    filtered: records,
    reportTitle: 'DAFTAR MUTASI QLOLA - REKONSILIASI LENGKAP',
    modeLabel: 'Semua',
  };
}

/**
 * Download file teks/CSV ke browser dengan UTF-8 BOM
 */
function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export rekonsiliasi ke CSV persis sesuai format contoh
 */
export function exportToCSV(records, filterMode = 'belum', periodeText = '') {
  // Jika records sudah difilter di luar tapi filterMode ditentukan
  const { filtered, reportTitle, modeLabel } = filterRecordsByMode(records, filterMode);

  // Jika records yang dipass sudah terfilter dari luar dan mode matching persis
  const dataToExport = filtered.length > 0 ? filtered : records;

  const title = reportTitle;
  const periode = getPeriodeText(dataToExport, periodeText);
  const jamAkses = getJamAksesText();

  // Header 5 baris
  const line1 = `${title},,,,`;
  const line2 = `${periode},,,,`;
  const line3 = `${jamAkses},,,,`;
  const line4 = 'NO,TGL,DARI/TUJUAN,MUTASI,DIAMBIL OLEH';
  const line5 = ',,,MASUK,';

  // Baris data
  const dataLines = dataToExport.map((item, idx) => {
    const no = idx + 1;
    const tgl = formatRowDateTime(item.tanggal || item.qlRow?.tanggal, item.jamTran || item.qlRow?.jamTran);
    const deskripsi = escapeCSV(item.deskripsi || item.qlRow?.deskripsi || '');
    const mutasi = item.nominal ?? item.qlRow?.nominal ?? 0;
    const diambilOleh = escapeCSV((item.namaPenerima && item.namaPenerima !== '-') ? item.namaPenerima : '');

    return [no, tgl, deskripsi, mutasi, diambilOleh].join(',');
  });

  // Baris TOTAL
  const totalNominal = dataToExport.reduce((s, r) => s + (Number(r.nominal) || 0), 0);
  const totalLine = ['TOTAL', '', '', totalNominal, ''].join(',');

  const allContent = [line1, line2, line3, line4, line5, ...dataLines, totalLine].join('\r\n') + '\r\n';

  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadCSV(allContent, `Rekap_QLola_${modeLabel}_${ts}.csv`);
}

/** Shortcut export belum diklaim */
export function exportBelumDiambilToCSV(records, periode) {
  exportToCSV(records, 'belum', periode);
}

/** Shortcut export perlu review */
export function exportPerluReviewToCSV(records, periode) {
  exportToCSV(records, 'review', periode);
}

/** Shortcut export matched/sudah diklaim */
export function exportMatchedToCSV(records, periode) {
  exportToCSV(records, 'matched', periode);
}

/** Shortcut export semua data */
export function exportAllToCSV(records, periode) {
  exportToCSV(records, 'all', periode);
}

/** =========================================================
 *  Export ke Excel (.xlsx) dengan struktur baris yang sama
 * ========================================================= */
export function exportToExcel(records, filterMode = 'belum', periodeText = '', sheetTitle = 'REKAP QLOLA') {
  const { filtered, reportTitle, modeLabel } = filterRecordsByMode(records, filterMode);
  const dataToExport = filtered.length > 0 ? filtered : records;

  const periode = getPeriodeText(dataToExport, periodeText);
  const jamAkses = getJamAksesText();

  const headerRows = [
    [reportTitle, '', '', '', ''],
    [periode, '', '', '', ''],
    [jamAkses, '', '', '', ''],
    ['NO', 'TGL', 'DARI/TUJUAN', 'MUTASI', 'DIAMBIL OLEH'],
    ['', '', '', 'MASUK', ''],
  ];

  const merges = [
    { s: { c: 0, r: 0 }, e: { c: 4, r: 0 } }, // A1:E1 Judul
    { s: { c: 0, r: 1 }, e: { c: 4, r: 1 } }, // A2:E2 Periode
    { s: { c: 0, r: 2 }, e: { c: 4, r: 2 } }, // A3:E3 Jam akses
    { s: { c: 0, r: 3 }, e: { c: 0, r: 4 } }, // A4:A5 NO
    { s: { c: 1, r: 3 }, e: { c: 1, r: 4 } }, // B4:B5 TGL
    { s: { c: 2, r: 3 }, e: { c: 2, r: 4 } }, // C4:C5 DARI/TUJUAN
    { s: { c: 4, r: 3 }, e: { c: 4, r: 4 } }, // E4:E5 DIAMBIL OLEH
  ];

  const dataRows = dataToExport.map((item, idx) => {
    const tgl = formatRowDateTime(item.tanggal || item.qlRow?.tanggal, item.jamTran || item.qlRow?.jamTran);
    return [
      idx + 1,
      tgl,
      item.deskripsi || item.qlRow?.deskripsi || '',
      item.nominal ?? item.qlRow?.nominal ?? 0,
      (item.namaPenerima && item.namaPenerima !== '-') ? item.namaPenerima : '',
    ];
  });

  const totalNominal = dataToExport.reduce((s, r) => s + (Number(r.nominal) || 0), 0);
  const totalRow = ['TOTAL', '', '', totalNominal, ''];
  const totalRowIndex = headerRows.length + dataRows.length;

  merges.push({ s: { c: 0, r: totalRowIndex }, e: { c: 2, r: totalRowIndex } });

  const allRows = [...headerRows, ...dataRows, totalRow];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 6 },   // A: NO
    { wch: 22 },  // B: TGL
    { wch: 75 },  // C: DARI/TUJUAN
    { wch: 16 },  // D: MUTASI
    { wch: 40 },  // E: DIAMBIL OLEH
  ];

  // Format kolom D (MUTASI) dan TOTAL sebagai angka ribuan
  dataRows.forEach((_, i) => {
    const rowIdx = headerRows.length + i;
    const cellRef = XLSX.utils.encode_cell({ c: 3, r: rowIdx });
    if (ws[cellRef]) {
      ws[cellRef].t = 'n';
      ws[cellRef].z = '#,##0';
    }
  });

  const totalNomCellRef = XLSX.utils.encode_cell({ c: 3, r: totalRowIndex });
  if (ws[totalNomCellRef]) {
    ws[totalNomCellRef].t = 'n';
    ws[totalNomCellRef].z = '#,##0';
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle.substring(0, 31));

  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `Rekap_QLola_${modeLabel}_${ts}.xlsx`);
}

export function exportBelumDiambilToExcel(records, periode, sheetTitle) {
  exportToExcel(records, 'belum', periode, sheetTitle || 'REKAP QLOLA BELUM DIKLAIM');
}

export function exportPerluReviewToExcel(records, periode, sheetTitle) {
  exportToExcel(records, 'review', periode, sheetTitle || 'REKAP QLOLA PERLU REVIEW');
}

export function exportMatchedToExcel(records, periode, sheetTitle) {
  exportToExcel(records, 'matched', periode, sheetTitle || 'REKAP QLOLA SUDAH DIKLAIM');
}

export function exportAllToExcel(records, periode, sheetTitle) {
  exportToExcel(records, 'all', periode, sheetTitle || 'REKAP QLOLA LENGKAP');
}

/** Print laporan */
export function printReport() {
  window.print();
}
