import React, { useRef, useState } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, PlayCircle, Database, Sparkles } from 'lucide-react';

export default function UploadSection({
  qlData,
  bbData,
  bwData,
  onUploadQlola,
  onUploadBukuBank,
  onUploadBlokWanita,
  onProcess,
  canProcess,
  hasProcessed,
  isLoading,
  uploadError,
}) {
  const qlRef = useRef(null);
  const bbRef = useRef(null);
  const bwRef = useRef(null);
  const [qlFileName, setQlFileName] = useState('');
  const [bbFileName, setBbFileName] = useState('');
  const [bwFileName, setBwFileName] = useState('');

  const handleQlChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQlFileName(file.name);
    onUploadQlola(file);
    e.target.value = '';
  };

  const handleBbChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBbFileName(file.name);
    onUploadBukuBank(file);
    e.target.value = '';
  };

  const handleBwChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBwFileName(file.name);
    onUploadBlokWanita(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Instruction Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-900">
        <div className="font-bold text-base mb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Cara Penggunaan
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-blue-800 text-xs">
          <li>Upload file <strong>DataQlola</strong> (kolom J = Deskripsi, kolom M = Nominal/MUTASI_KREDIT)</li>
          <li>Upload file <strong>Buku Bank</strong> (kolom C = Deskripsi, kolom E = Nama Penerima, kolom F = Nominal)</li>
          <li>Opsional: upload file <strong>Blok Wanita</strong> untuk mengecek apakah transaksi tercatat pada rekap penarikan tunai</li>
          <li>Klik <strong>Proses Rekonsiliasi</strong>, lalu lihat hasil di tab <strong>Semua</strong>, <strong>Cocok</strong>, <strong>Perlu Review</strong>, dan <strong>Belum Diambil</strong></li>
        </ol>
      </div>

      {/* Error */}
      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Upload Cards — wajib */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* DataQlola */}
        <input ref={qlRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleQlChange} />
        <button
          type="button"
          onClick={() => qlRef.current?.click()}
          disabled={isLoading}
          className="group relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all
            border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-white text-left w-full"
        >
          {qlData.length > 0 ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <div className="text-center">
                <div className="font-bold text-emerald-700 text-sm">DataQlola Termuat</div>
                <div className="text-xs text-slate-500 mt-1 max-w-[180px] truncate">{qlFileName}</div>
                <div className="text-xs text-emerald-600 font-semibold mt-1">{qlData.length.toLocaleString('id-ID')} transaksi</div>
              </div>
              <div className="text-[11px] text-blue-500 group-hover:text-blue-700">Klik untuk ganti file</div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-800 text-sm">Upload DataQlola</div>
                <div className="text-xs text-slate-500 mt-1">File Excel (.xlsx / .xls) atau .csv</div>
              </div>
              <div className="text-[11px] text-blue-500">Kolom J (Deskripsi) · Kolom M (Nominal)</div>
            </>
          )}
          {isLoading && <Loader2 className="absolute top-3 right-3 w-4 h-4 text-blue-500 animate-spin" />}
        </button>

        {/* BukuBank */}
        <input ref={bbRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBbChange} />
        <button
          type="button"
          onClick={() => bbRef.current?.click()}
          disabled={isLoading}
          className="group relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all
            border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 bg-white text-left w-full"
        >
          {bbData.length > 0 ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <div className="text-center">
                <div className="font-bold text-emerald-700 text-sm">Buku Bank Termuat</div>
                <div className="text-xs text-slate-500 mt-1 max-w-[180px] truncate">{bbFileName}</div>
                <div className="text-xs text-emerald-600 font-semibold mt-1">{bbData.length.toLocaleString('id-ID')} transaksi</div>
              </div>
              <div className="text-[11px] text-indigo-500 group-hover:text-indigo-700">Klik untuk ganti file</div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-800 text-sm">Upload Buku Bank</div>
                <div className="text-xs text-slate-500 mt-1">File Excel (.xlsx / .xls) atau .csv</div>
              </div>
              <div className="text-[11px] text-indigo-500">Kolom C (Deskripsi) · Kolom E (Nama) · Kolom F (Nominal)</div>
            </>
          )}
          {isLoading && <Loader2 className="absolute top-3 right-3 w-4 h-4 text-indigo-500 animate-spin" />}
        </button>
      </div>

      {/* Upload Card — opsional: Blok Wanita */}
      <input ref={bwRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBwChange} />
      <button
        type="button"
        onClick={() => bwRef.current?.click()}
        disabled={isLoading}
        className="group relative w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed transition-all
          border-violet-300 hover:border-violet-500 hover:bg-violet-50 bg-white text-left"
      >
        <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
          bwData.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600 group-hover:bg-violet-200'
        }`}>
          {bwData.length > 0 ? <CheckCircle2 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-800">
              {bwData.length > 0 ? 'Blok Wanita Termuat' : 'Upload Blok Wanita'}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">
              Opsional
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {bwData.length > 0
              ? `${bwFileName} · ${bwData.length.toLocaleString('id-ID')} baris — klik untuk ganti file`
              : 'Rekap Penarikan Tunai Blok Wanita — kolom B (Deskripsi) · kolom D (Nominal)'}
          </div>
        </div>

        {isLoading && <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />}
      </button>

      {/* Tombol Proses */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onProcess}
          disabled={!canProcess || isLoading}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all ${
            canProcess && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-[0.99]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <PlayCircle className="w-4 h-4" />
          {hasProcessed ? 'Proses Ulang Rekonsiliasi' : 'Proses Rekonsiliasi'}
        </button>
        <p className="text-center text-[11px] text-slate-400">
          {!canProcess
            ? 'Upload DataQlola dan Buku Bank terlebih dahulu untuk mengaktifkan tombol proses.'
            : bwData.length > 0
              ? 'QLola akan dicocokkan dengan Buku Bank, lalu dicek juga ke data Blok Wanita.'
              : 'QLola akan dicocokkan dengan Buku Bank saja. Upload Blok Wanita bila ingin pengecekan tambahan.'}
        </p>
      </div>
    </div>
  );
}
