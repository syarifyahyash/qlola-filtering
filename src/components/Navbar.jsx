import React from 'react';
import { Upload, CheckCircle2, AlertTriangle, Clock, RotateCcw, Printer } from 'lucide-react';
import { printReport } from '../utils/exportReport';

export default function Navbar({ activeTab, setActiveTab, summary, onReset }) {
  const { matched, perluReview, belumDiambil, totalTransaksi } = summary;
  const hasData = totalTransaksi > 0;

  const tabs = [
    {
      key: 'upload',
      label: 'Upload Data',
      icon: <Upload className="w-3.5 h-3.5" />,
      count: null,
      alwaysShow: true,
    },
    {
      key: 'matching',
      label: 'Semua',
      icon: null,
      count: hasData ? totalTransaksi : null,
    },
    {
      key: 'matched',
      label: 'Cocok',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      count: hasData ? matched : null,
      badgeClass: 'bg-emerald-100 text-emerald-700',
    },
    {
      key: 'review',
      label: 'Perlu Review',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
      count: hasData ? perluReview : null,
      badgeClass: perluReview > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
    },
    {
      key: 'belum',
      label: 'Belum Diambil',
      icon: <Clock className="w-3.5 h-3.5 text-rose-500" />,
      count: hasData ? belumDiambil : null,
      badgeClass: belumDiambil > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Brand Row */}
        <div className="flex items-center justify-between h-14 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              Q
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base">
                QLola<span className="text-blue-600">Recon</span>
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline ml-2">
                Rekonsiliasi & Matching Transaksi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={printReport}
              title="Print Laporan"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { if (window.confirm('Reset semua data dan mulai dari awal?')) onReset(); }}
              title="Reset semua"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Row */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              disabled={!hasData && tab.key !== 'upload'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all
                ${activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : (tab.badgeClass || 'bg-slate-100 text-slate-600')
                }`}>
                  {tab.count.toLocaleString('id-ID')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
