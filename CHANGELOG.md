# Changelog

Semua perubahan, penambahan fitur, perbaikan bug, dan optimasi performa pada project **QLola Filtering / Rekonsiliasi Transaksi** didokumentasikan di file ini. Format penulisan mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

---

## [0.2.0] - 2026-11-22

### Ditambahkan (Added)
- **Dukungan Sumber Data Blok Wanita**:
  - Input file opsional untuk data *Blok Wanita* (rekam/rekap data penarikan tunai).
  - Parser otomatis `parseBlokWanita` yang fleksibel mendeteksi kolom deskripsi, nominal, nama warga binaan/penerima, tanggal, dan nomor kamar.
  - Alur rekonsiliasi sekunder: jika mutasi QLola berstatus `BELUM_DIAMBIL` dari Buku Bank, sistem otomatis mencocokkan ke Blok Wanita.
  - Indikator asal sumber data (*Buku Bank*, *Blok Wanita*, atau *Keduanya*) pada badge status transaksi.
  - Kartu ringkasan metrik khusus Blok Wanita pada `SummaryCards`.
- **Kolom Tanggal & Jam Transaksi**:
  - Tampilan tanggal dan waktu mutasi (`Tgl & Waktu`) di tabel rekonsiliasi yang mendukung serial date Excel, ISO string, dan custom time format.

### Ditingkatkan (Changed & Optimized)
- **Optimasi Algoritma & Performa Matching Engine**:
  - Implementasi *precomputing index* (pemrosesan awal regex, tokenisasi, dan normalisasi) sehingga pencocokan ribuan baris data tidak melakukan evaluasi berulang.
  - Mekanisme *chunking async* dengan `MessageChannel` micro-task scheduling untuk memproses komputasi berat tanpa membekukan antarmuka browser (zero UI freezing).
  - Penambahan `useDeferredValue` dan *pre-indexed search string* pada tabel hasil rekonsiliasi untuk filter/pencarian real-time yang instan tanpa lag.
- **Ekspor Laporan Excel (.xlsx) Resmi**:
  - Migrasi format ekspor dari CSV sederhana menjadi file Excel (`.xlsx`) lengkap dengan header formal dinamis, styling kolom, dan baris total.
  - Ekspor terpisah per kategori tab: *Semua Hasil*, *Hanya Cocok*, *Hanya Perlu Review*, dan *Hanya Belum Diambil*.

---

## [0.1.5] - 2026-11-18

### Ditambahkan (Added)
- **Overlay Progres Interaktif (`ProcessingOverlay`)**:
  - Animasi progress bar persentase (0–100%) dan counter baris yang sedang diproses.
  - Indikator fase pemrosesan data (persiapan index, matching Buku Bank, matching Blok Wanita, hingga kalkulasi ringkasan).
- **Asynchronous Chunking**:
  - Pembagian beban komputasi per interval waktu (`MAX_WORK_MS`) agar browser tetap responsif.
- **Dynamic XLSX Lazy Loader**:
  - Modul `xlsxLoader.js` untuk penanganan parsing dan pembuatan file spreadsheet yang lebih efisien.

---

## [0.1.0] - 2026-11-17

### Ditambahkan (Added)
- **Inisialisasi Project**:
  - Setup React 18, Vite, dan Tailwind CSS.
  - Komponen inti: `Navbar`, `UploadSection`, `SummaryCards`, `ReconciliationTable`.
- **Logika Matching Inti**:
  - Ekstraksi deskripsi bersih dari Buku Bank (menghilangkan kode teller, strip pemisah, dan format nominal).
  - Pencocokan multi-tingkat: *Exact Match*, *Prefix Match* (penanganan pemotongan 112 karakter nomor FASTIDJA pada transaksi BFST), *Substring Match*, dan *Core Reference ID Match* (kode unik ESB, GoPay ID, DANA ID).
  - Penanganan kasus *Split Transaction* (>1 entri Buku Bank yang jika dijumlahkan tepat sama dengan 1 mutasi QLola).
- **State Management & Pemrosesan Lokal**:
  - Custom React hook `useReconciliationStorage` untuk mengelola state data secara in-memory.
  - Keamanan privasi penuh (100% Client-Side Processing tanpa pengiriman data ke server luar).
