import React, { useState, useMemo } from 'react';
import { Search, Download, X, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatRupiah } from '../utils/normalizer';
import { exportAllToCSV, exportBelumDiambilToCSV, exportPerluReviewToCSV, exportMatchedToCSV, exportToCSV } from '../utils/exportReport';

const STATUS_CONFIG = {
  MATCHED: {
    label: 'Cocok',
    bgRow: '',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  PERLU_REVIEW: {
    label: 'Perlu Review',
    bgRow: 'bg-amber-50/40',
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  BELUM_DIAMBIL: {
    label: 'Belum Diambil',
    bgRow: 'bg-rose-50/30',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.BELUM_DIAMBIL;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function ReconciliationTable({ results, activeFilter }) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Filter by activeFilter tab + search
  const filtered = useMemo(() => {
    return results
      .filter(r => {
        if (activeFilter === 'matched') return r.status === 'MATCHED';
        if (activeFilter === 'review') return r.status === 'PERLU_REVIEW';
        if (activeFilter === 'belum') return r.status === 'BELUM_DIAMBIL';
        return true; // 'all'
      })
      .filter(r => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
          r.deskripsi.toLowerCase().includes(q) ||
          r.namaPenerima.toLowerCase().includes(q) ||
          String(r.nominal).includes(q)
        );
      });
  }, [results, activeFilter, search]);

  const handleExport = () => {
    if (search.trim()) {
      return exportToCSV(filtered, activeFilter);
    }
    if (activeFilter === 'belum') return exportBelumDiambilToCSV(results);
    if (activeFilter === 'review') return exportPerluReviewToCSV(results);
    if (activeFilter === 'matched') return exportMatchedToCSV(results);
    return exportAllToCSV(results);
  };

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
        Upload kedua file terlebih dahulu untuk melihat hasil rekonsiliasi.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + Export Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari deskripsi, nama penerima, atau nominal..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-start">
          <span className="text-xs text-slate-500 font-semibold">
            {filtered.length.toLocaleString('id-ID')} baris
          </span>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3 min-w-[260px]">Deskripsi QLola</th>
                <th className="py-3 px-3 min-w-[120px] text-right">Nominal</th>
                <th className="py-3 px-3 min-w-[200px]">Nama Penerima</th>
                <th className="py-3 px-3 w-32 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                    Tidak ada transaksi yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.BELUM_DIAMBIL;
                  const isExpanded = expandedId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`transition-colors hover:bg-slate-50 ${cfg.bgRow} cursor-pointer`}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        {/* No */}
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                        {/* Deskripsi */}
                        <td className="py-3 px-3">
                          <div className="font-mono text-xs text-slate-700 truncate max-w-[300px]" title={item.deskripsi}>
                            {item.deskripsi}
                          </div>
                        </td>

                        {/* Nominal */}
                        <td className="py-3 px-3 text-right font-bold font-mono whitespace-nowrap text-slate-900">
                          {formatRupiah(item.nominal)}
                        </td>

                        {/* Nama Penerima */}
                        <td className="py-3 px-3">
                          {item.status === 'MATCHED' && (
                            <span className="font-semibold text-slate-900">{item.namaPenerima}</span>
                          )}
                          {item.status === 'PERLU_REVIEW' && (
                            <span className="text-amber-700 font-medium text-xs">{item.namaPenerima}</span>
                          )}
                          {item.status === 'BELUM_DIAMBIL' && (
                            <span className="text-rose-400 italic text-xs">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusBadge status={item.status} />
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row: detail BukuBank matches */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="px-6 py-4 border-t border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                              Detail Transaksi
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-slate-400 block mb-1">Deskripsi Lengkap (QLola):</span>
                                <span className="font-mono text-slate-800 break-all text-[11px]">{item.deskripsi}</span>
                              </div>
                              {item.bbMatches?.length > 0 && (
                                <div>
                                  <span className="text-slate-400 block mb-1">Kecocokan di Buku Bank ({item.bbMatches.length}):</span>
                                  {item.bbMatches.map((bb, bi) => (
                                    <div key={bi} className="bg-white rounded-xl border border-slate-200 p-2.5 mb-1.5">
                                      <div className="font-semibold text-slate-900">{bb.namaPenerima || '(Nama kosong)'}</div>
                                      <div className="text-slate-500 text-[11px]">Voucher: {bb.nomorVoucher}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
