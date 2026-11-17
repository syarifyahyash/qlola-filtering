import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, ArrowRight, Database } from 'lucide-react';

export default function UploadSection({ qlData, bbData, onUploadQlola, onUploadBukuBank, onGoToResult, isLoading, uploadError }) {
  const qlRef = useRef(null);
  const bbRef = useRef(null);
  const [qlFileName, setQlFileName] = useState('');
  const [bbFileName, setBbFileName] = useState('');

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

  const bothLoaded = qlData.length > 0 && bbData.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Instruction Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-900">
        <div className="font-bold text-base mb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Cara Penggunaan
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-blue-800 text-xs">
          <li>Upload file <strong>DataQlola</strong> (kolom J = Deskripsi, kolom M = Nominal/MUTASI_KREDIT)</li>
          <li>Upload file <strong>Buku Bank</strong> (kolom C = Deskripsi, kolom E = Nama Penerima, kolom F = Nominal)</li>
          <li>Sistem otomatis mencocokkan: transaksi yang deskripsi <em>dan</em> nominal-nya sama persis</li>
          <li>Lihat hasil di tab <strong>"Hasil Matching"</strong>, <strong>"Perlu Review"</strong>, dan <strong>"Belum Diambil"</strong></li>
        </ol>
      </div>

      {/* Error */}
      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Upload Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* DataQlola */}
        <input ref={qlRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleQlChange} />
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
                <div className="text-xs text-slate-500 mt-1 max-w-[160px] truncate">{qlFileName}</div>
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
                <div className="text-xs text-slate-500 mt-1">File Excel (.xlsx / .xls)</div>
              </div>
              <div className="text-[11px] text-blue-500">Kolom J (Deskripsi) · Kolom M (Nominal)</div>
            </>
          )}
          {isLoading && <Loader2 className="absolute top-3 right-3 w-4 h-4 text-blue-500 animate-spin" />}
        </button>

        {/* BukuBank */}
        <input ref={bbRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBbChange} />
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
                <div className="text-xs text-slate-500 mt-1 max-w-[160px] truncate">{bbFileName}</div>
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
                <div className="text-xs text-slate-500 mt-1">File Excel (.xlsx / .xls)</div>
              </div>
              <div className="text-[11px] text-indigo-500">Kolom C (Deskripsi) · Kolom E (Nama) · Kolom F (Nominal)</div>
            </>
          )}
          {isLoading && <Loader2 className="absolute top-3 right-3 w-4 h-4 text-indigo-500 animate-spin" />}
        </button>
      </div>

      {/* CTA Lihat Hasil */}
      {bothLoaded && (
        <button
          type="button"
          onClick={onGoToResult}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 active:scale-98 transition-all"
        >
          Lihat Hasil Rekonsiliasi
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
