import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, Layers, Sparkles } from 'lucide-react';
import { formatRupiah } from '../utils/normalizer';

function SummaryCards({ summary }) {
  const {
    totalTransaksi,
    matched,
    perluReview,
    belumDiambil,
    totalNominal,
    matchedNominal,
    reviewNominal,
    unmatchedNominal,
    matchPercentage,
    blokWanita,
  } = summary;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Total QLola */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total QLola</span>
          <Layers className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-2xl font-extrabold text-slate-900">{totalTransaksi.toLocaleString('id-ID')}</div>
        <div className="text-xs text-slate-500 mt-1 font-mono">{formatRupiah(totalNominal)}</div>
        {/* progress bar */}
        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${matchPercentage}%` }} />
        </div>
        <div className="text-[11px] text-slate-400 mt-1">{matchPercentage}% cocok</div>
      </div>

      {/* Cocok / Matched */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Cocok</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-extrabold text-emerald-700">{matched.toLocaleString('id-ID')}</div>
        <div className="text-xs text-emerald-700 mt-1 font-mono">{formatRupiah(matchedNominal)}</div>
        <div className="text-[11px] text-emerald-500 mt-3">
          {blokWanita?.checked ? 'Termasuk yang cocok via Blok Wanita' : 'Nama penerima terisi'}
        </div>
      </div>

      {/* Perlu Review */}
      <div className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-xs ${perluReview > 0 ? 'border-amber-300' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${perluReview > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
            Perlu Review
          </span>
          <AlertTriangle className={`w-4 h-4 ${perluReview > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-extrabold ${perluReview > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
          {perluReview.toLocaleString('id-ID')}
        </div>
        <div className={`text-xs mt-1 font-mono ${perluReview > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
          {formatRupiah(reviewNominal)}
        </div>
        <div className={`text-[11px] mt-3 ${perluReview > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
          {perluReview > 0 ? '>1 nama penerima ditemukan' : 'Tidak ada'}
        </div>
      </div>

      {/* Belum Diambil */}
      <div className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-xs ${belumDiambil > 0 ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${belumDiambil > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
            Belum Diambil
          </span>
          <Clock className={`w-4 h-4 ${belumDiambil > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-extrabold ${belumDiambil > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
          {belumDiambil.toLocaleString('id-ID')}
        </div>
        <div className={`text-xs mt-1 font-mono ${belumDiambil > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
          {formatRupiah(unmatchedNominal)}
        </div>
        <div className={`text-[11px] mt-3 ${belumDiambil > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
          {belumDiambil > 0 ? 'Tidak ada di Buku Bank' : 'Semua terpetakan'}
        </div>
      </div>

      {/* Ringkasan Blok Wanita (opsional) */}
      {blokWanita?.checked && (
        <div className="col-span-2 lg:col-span-4 bg-white rounded-2xl border border-violet-200 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Cek Blok Wanita</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {blokWanita.totalRows.toLocaleString('id-ID')} baris · {formatRupiah(blokWanita.totalNominal)}
              </span>
            </div>
            {blokWanita.unlinkedRows > 0 && (
              <span className="text-[11px] text-amber-600 font-semibold">
                {blokWanita.unlinkedRows.toLocaleString('id-ID')} baris Blok Wanita tidak ditemukan di QLola
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Tercatat</div>
              <div className="text-lg font-extrabold text-emerald-700">{blokWanita.tercatat.toLocaleString('id-ID')}</div>
              <div className="text-[10px] text-emerald-600 font-mono">{formatRupiah(blokWanita.tercatatNominal)}</div>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${blokWanita.nominalBeda > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${blokWanita.nominalBeda > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Nominal Beda</div>
              <div className={`text-lg font-extrabold ${blokWanita.nominalBeda > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {blokWanita.nominalBeda.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-400">nominal tidak sama</div>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${blokWanita.tidakTercatat > 0 ? 'bg-slate-50 border-slate-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tidak Tercatat</div>
              <div className={`text-lg font-extrabold ${blokWanita.tidakTercatat > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                {blokWanita.tidakTercatat.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-400">tidak ada di Blok Wanita</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SummaryCards);

