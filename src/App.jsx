import React from 'react';
import Navbar from './components/Navbar';
import SummaryCards from './components/SummaryCards';
import UploadSection from './components/UploadSection';
import ReconciliationTable from './components/ReconciliationTable';
import { useReconciliationStorage } from './hooks/useReconciliationStorage';

export default function App() {
  const {
    qlData,
    bbData,
    activeTab,
    setActiveTab,
    isLoading,
    uploadError,
    results,
    summary,
    handleUploadQlola,
    handleUploadBukuBank,
    clearAll,
  } = useReconciliationStorage();

  // Map activeTab ke filter untuk ReconciliationTable
  const tableFilter = activeTab === 'matched' ? 'matched'
    : activeTab === 'review' ? 'review'
    : activeTab === 'belum' ? 'belum'
    : 'all';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-800">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        summary={summary}
        onReset={clearAll}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* KPI Summary Cards — tampil bila ada data */}
        {results.length > 0 && (
          <SummaryCards summary={summary} />
        )}

        {/* Tab Content */}
        {activeTab === 'upload' ? (
          <UploadSection
            qlData={qlData}
            bbData={bbData}
            onUploadQlola={handleUploadQlola}
            onUploadBukuBank={handleUploadBukuBank}
            onGoToResult={() => setActiveTab('matching')}
            isLoading={isLoading}
            uploadError={uploadError}
          />
        ) : (
          <ReconciliationTable
            results={results}
            activeFilter={tableFilter}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-slate-400">
          <span>QLola Transaction Reconciliation — Frontend-Only</span>
          <span>Data tidak dikirim ke server manapun</span>
        </div>
      </footer>
    </div>
  );
}
