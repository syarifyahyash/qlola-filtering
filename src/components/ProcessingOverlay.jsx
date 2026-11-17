import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Overlay progres saat file sedang dibaca / direkonsiliasi.
 * progress === null berarti indeterminate (mis. saat parsing file).
 */
export default function ProcessingOverlay({ active, progress, label, detail }) {
  // Tahan overlay sebentar saat `active` berubah false, supaya tidak berkedip
  // di jeda singkat antara selesai parsing dan mulai rekonsiliasi.
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  const indeterminate = progress === null || progress === undefined;
  const finished = !indeterminate && progress >= 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-7 animate-scale-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 text-sm truncate">
              {finished ? 'Menyusun Hasil...' : label}
            </div>
            <div className="text-[11px] text-slate-500">DataQlola × Buku Bank</div>
          </div>
        </div>

        {/* Persentase */}
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Progres
          </span>
          <span className="text-lg font-extrabold text-blue-600 tabular-nums leading-none">
            {indeterminate ? '…' : `${progress}%`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          {indeterminate ? (
            <div className="h-full w-full bg-blue-300 animate-pulse rounded-full" />
          ) : (
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          )}
        </div>

        {/* Detail */}
        <div className="mt-2 text-[11px] text-slate-500 font-medium tabular-nums">
          {detail}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          Mohon jangan tutup atau refresh halaman ini.
        </div>
      </div>
    </div>
  );
}
