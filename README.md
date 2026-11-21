# QLola Transaction Reconciliation & Filtering System

Aplikasi web modern berbasis **React 18**, **Vite**, dan **Tailwind CSS** yang dirancang khusus untuk mempermudah proses **rekonsiliasi mutasi rekening koran QLola (BRI)** dengan catatan pencatatan manual (**Buku Bank**) serta rekap penarikan tunai (**Blok Wanita**).

Sistem ini berjalan **100% Client-Side (di dalam browser Anda)**, menjamin kerahasiaan data perbankan karena tidak ada satu pun file atau data transaksi yang dikirim ke server luar.

---

## 📑 Daftar Isi
- [Latar Belakang & Fitur Utama](#-fitur-utama)
- [Arsitektur & Alur Kerja (Workflow)](#-alur-kerja-sistem)
- [Logika Pencocokan (Matching Engine)](#-logika-pencocokan-matching-engine)
- [Struktur Data Input](#-format-file-yang-didukung)
- [Struktur Proyek](#-struktur-proyek)
- [Teknologi yang Digunakan](#-teknologi)
- [Instalasi & Menjalankan Proyek](#-instalasi--penggunaan)
- [Keamanan & Privasi](#-keamanan--privasi)

---

## ✨ Fitur Utama

- **🚀 Pemrosesan Lokal Cepat & Aman**: Seluruh parsing dan pencocokan berlangsung di browser menggunakan Web API modern (`MessageChannel` chunking dan precomputed indexing).
- **🎯 Multi-Level Matching Engine**:
  - *Exact Match*: Pencocokan deskripsi identik.
  - *Prefix Match*: Mengatasi pemotongan batas 112 karakter (seperti pada transaksi `BFST` / nomor `FASTIDJA` di Buku Bank).
  - *Substring & Core Reference Match*: Pencocokan kode referensi unik (ID Transaksi ESB, nomor referensi GoPay, DANA, dsb).
  - *Split Transaction Detection*: Mendeteksi otomatis apabila 1 mutasi di QLola dicairkan menjadi beberapa catatan terpisah di Buku Bank dengan total nominal yang pas.
- **👩 Sumber Data Tambahan (Blok Wanita)**:
  - Dukungan upload file opsional Blok Wanita untuk memvalidasi transaksi yang belum terambil di Buku Bank reguler.
- **📊 Ringkasan Metrik Finansial (KPI Dashboard)**:
  - Menampilkan jumlah transaksi dan total nominal per kategori secara visual (*Total QLola*, *Cocok*, *Perlu Review*, *Belum Diambil*, dan metrik *Blok Wanita*).
- **🔍 Pencarian Real-Time Responsif**:
  - Dilengkapi fitur pencarian tanpa jeda (menggunakan `useDeferredValue` React 18) untuk ribuan baris data transaksi.
- **📥 Ekspor Laporan Excel (.xlsx) Siap Pakai**:
  - Menghasilkan file Excel berformat resmi dan rapi untuk kebutuhan pengarsipan maupun tindak lanjut klaim mutasi.

---

## 🔄 Alur Kerja Sistem

Berikut adalah siklus alur data di dalam aplikasi:

```
+--------------------------+     +--------------------------+     +--------------------------+
| 1. Upload File QLola    |     | 2. Upload Buku Bank      |     | 3. Upload Blok Wanita    |
| (Format .xlsx / .csv)    |     | (Format .xlsx / .csv)    |     | (Opsional .xlsx / .csv)  |
+--------------------------+     +--------------------------+     +--------------------------+
              \                               |                              /
               \                              |                             /
                v                             v                            v
        +--------------------------------------------------------------------------+
        |                  Dynamic File Parser (fileParser.js)                     |
        |      - Deteksi otomatis baris header                                     |
        |      - Normalisasi nominal angka & pembersihan karakter                   |
        +--------------------------------------------------------------------------+
                                              |
                                              v
        +--------------------------------------------------------------------------+
        |                 Intelligent Matching Engine (Async Chunked)              |
        |  Langkah 1: Pre-computing Index & Reference Tokenization                |
        |  Langkah 2: Matching QLola vs Buku Bank                                  |
        |             - Exact / Prefix / Substring / Core Ref                      |
        |             - Pengecekan Nominal & Split Transaksi                       |
        |  Langkah 3: Pengecekan Sekunder ke Blok Wanita (jika diupload)           |
        |             - Mencocokkan status BELUM_DIAMBIL dengan Blok Wanita         |
        |  Langkah 4: Rekapitulasi Metrik Summary                                  |
        +--------------------------------------------------------------------------+
                                              |
                                              v
        +--------------------------------------------------------------------------+
        |                       Tampilan Hasil & Laporan                           |
        |   - Summary Cards (KPI Total, Nominal, Persentase)                       |
        |   - Filter Tab: Semua | Cocok | Perlu Review | Belum Diambil             |
        |   - Pencarian Instan & Detail Ekspansi Baris                             |
        |   - Ekspor Laporan Excel (.xlsx) Resmi                                   |
        +--------------------------------------------------------------------------+
```

---

## 🧠 Logika Pencocokan (Matching Engine)

Setiap baris mutasi kredit pada data **QLola** diklasifikasikan ke dalam 3 status utama:

| Status | Indikator | Definisi & Kriteria |
| :--- | :--- | :--- |
| **Cocok** (`MATCHED`) | 🟢 Hijau | Ditemukan pasangan data dengan nominal yang persis sama. Jika terdapat beberapa catatan di Buku Bank, total nominal gabungannya sama persis (*Split Transaction*). Atau transaksi berhasil dicocokkan melalui data Blok Wanita. |
| **Perlu Review** (`PERLU_REVIEW`) | 🟡 Kuning | Deskripsi/referensi transaksi ditemukan cocok, namun nominal uangnya berbeda (selisih lebih/kurang), atau jumlah split transaksi tidak seimbang. |
| **Belum Diambil** (`BELUM_DIAMBIL`) | 🔴 Merah | Mutasi masuk pada rekening koran QLola sama sekali tidak ditemukan pada Buku Bank maupun Blok Wanita (belum ada yang mengklaim/mencatat). |

---

## 📁 Format File yang Didukung

Aplikasi mengenali kolom secara dinamis berdasarkan pola nama header (case-insensitive):

### 1. Data QLola (`parseDataQlola`)
- **Deskripsi Transaksi**: Terdeteksi via kolom `DESK_TRAN` atau `DESKRIPSI` (biasanya kolom `J`).
- **Nominal Transaksi**: Terdeteksi via kolom `MUTASI_KREDIT`, `MUTASI`, atau `KREDIT` (biasanya kolom `M`).
- **Tanggal & Jam**: Kolom `DATE` / `TANGGAL` dan `JAM_TRAN`.

### 2. Buku Bank (`parseBukuBank`)
- **Nomor Voucher**: Kolom `VOUCHER` / `NO VOUCHER` (kolom `B`).
- **Deskripsi**: Kolom `DESKRIPSI` (kolom `C`) — otomatis dibersihkan dari format teller & nominal di akhir kalimat.
- **Nama Penerima**: Kolom `NAMA`, `NARAPIDANA`, atau `PENERIMA` (kolom `E`).
- **Nominal**: Kolom `NOMINAL` (kolom `F`).

### 3. Blok Wanita (`parseBlokWanita` - Opsional)
- **Deskripsi/Keterangan**: Kolom `DESKRIPSI`, `KETERANGAN`, atau `URAIAN`.
- **Nama WBP**: Kolom `NAMA`, `WARGA BINAAN`, `NARAPIDANA`, `PENERIMA`.
- **Nominal**: Kolom `NOMINAL` atau `JUMLAH`.
- **Kamar / Tanggal**: Kolom `KAMAR` dan `TANGGAL`.

---

## 📂 Struktur Proyek

```text
qlola-filtering/
├── public/                 # Static assets
├── src/
│   ├── components/         # Komponen UI React
│   │   ├── Navbar.jsx              # Navigasi atas, tab filter, tombol reset & panduan
│   │   ├── ProcessingOverlay.jsx   # Progress bar & modal saat proses matching berjalan
│   │   ├── ReconciliationTable.jsx # Tabel hasil rekonsiliasi, pencarian, badge status
│   │   ├── SummaryCards.jsx        # Kartu ringkasan metrik / KPI data
│   │   └── UploadSection.jsx       # Formulir upload file (QLola, Buku Bank, Blok Wanita)
│   ├── hooks/
│   │   └── useReconciliationStorage.js # State management & orkestrasi pemrosesan
│   ├── utils/
│   │   ├── exportReport.js         # Generator dokumen laporan Excel (.xlsx) resmi
│   │   ├── fileParser.js           # Parser cerdas file Excel/CSV ke format JavaScript object
│   │   ├── matchingEngine.js       # Algoritma inti pencocokan multi-tingkat (async chunking)
│   │   ├── normalizer.js           # Fungsi bantu format Rupiah dan normalisasi teks
│   │   └── xlsxLoader.js           # Pustaka pembacaan XLSX
│   ├── App.jsx             # Root layout aplikasi
│   ├── index.css           # Konfigurasi Tailwind CSS
│   └── main.jsx            # Entry point aplikasi
├── CHANGELOG.md            # Catatan riwayat update & perubahan fitur
├── package.json            # Daftar dependensi & npm scripts
├── tailwind.config.js      # Konfigurasi Tailwind CSS
├── vite.config.js          # Konfigurasi build Vite
└── README.md               # Dokumentasi lengkap proyek
```

---

## 🛠️ Teknologi

- **Framework**: [React 18](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Spreadsheet Processing**: [SheetJS (xlsx)](https://docs.sheetjs.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Instalasi & Penggunaan

### Prasyarat
Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (versi 16 atau lebih baru) di sistem Anda.

### 1. Clone Repositori
```bash
git clone https://github.com/syarifyahya/qlola-filtering.git
cd qlola-filtering
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Jalankan Server Pengembangan (Dev Mode)
```bash
npm run dev
```
Buka browser dan akses alamat lokal yang muncul di terminal (biasanya `http://localhost:5173`).

### 4. Build untuk Produksi
```bash
npm run build
```
Hasil build siap saji akan dibuat di folder `dist/` dan dapat di-*deploy* ke hosting statis manapun (GitHub Pages, Vercel, Netlify, Cloudflare Pages, atau intranet lokal).

---

## 🔒 Keamanan & Privasi

Aplikasi ini dirancang dengan prinsip **Privacy by Design**:
1. File Excel/CSV yang diunggah hanya dibaca langsung ke dalam memori RAM browser Anda melalui HTML5 FileReader / ArrayBuffer API.
2. Tidak ada transmisi jaringan (AJAX/Fetch/WebSocket) ke server backend mana pun.
3. Menutup tab browser atau menekan tombol **Reset Data** akan langsung mengosongkan seluruh memori data transaksi.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE).
