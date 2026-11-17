import { useState, useCallback, useEffect } from 'react';
import { parseBukuBank, parseDataQlola } from '../utils/fileParser';
import { reconcileAsync } from '../utils/matchingEngine';

const EMPTY_SUMMARY = {
  totalTransaksi: 0,
  matched: 0,
  perluReview: 0,
  belumDiambil: 0,
  totalNominal: 0,
  matchedNominal: 0,
  reviewNominal: 0,
  unmatchedNominal: 0,
  matchPercentage: 0,
};

/** Jalankan callback setelah frame berikutnya selesai dilukis. */
function afterNextPaint(cb) {
  if (typeof requestAnimationFrame === 'undefined') {
    setTimeout(cb, 0);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(cb));
}

/**
 * Hook utama manajemen state rekonsiliasi.
 * Data disimpan dalam state memori (tidak di-persist ke localStorage karena ukuran file bisa besar).
 *
 * Rekonsiliasi dijalankan secara asinkron (chunked) supaya UI tetap responsif
 * untuk file dengan ribuan transaksi, dan progresnya dilaporkan via `processing`.
 */
export function useReconciliationStorage() {
  const [qlData, setQlData] = useState([]);         // array hasil parseDataQlola
  const [bbData, setBbData] = useState([]);         // array hasil parseBukuBank
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'matching' | 'belum' | 'review'
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Hasil rekonsiliasi + status progres
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [isReconciling, setIsReconciling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  // Jalankan rekonsiliasi setiap kali data berubah (async + progress)
  useEffect(() => {
    if (!qlData.length || !bbData.length) {
      setResults([]);
      setSummary(EMPTY_SUMMARY);
      setIsReconciling(false);
      setProgress(0);
      setProcessed(0);
      setTotalRows(0);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsReconciling(true);
    setProgress(0);
    setProcessed(0);
    setTotalRows(qlData.length);

    reconcileAsync(qlData, bbData, {
      signal: controller.signal,
      onProgress: (pct, done, total) => {
        if (cancelled) return;
        setProgress(pct);
        setProcessed(done);
        setTotalRows(total);
      },
    })
      .then(res => {
        if (cancelled) return;
        setResults(res.results);
        setSummary(res.summary);
      })
      .catch(err => {
        if (cancelled || err.name === 'AbortError') return;
        setUploadError(`Gagal melakukan rekonsiliasi: ${err.message}`);
      })
      .finally(() => {
        if (cancelled) return;
        // Tahan overlay sampai tabel sempat dilukis, supaya tidak ada
        // jeda "blank"/freeze sesaat setelah progres mencapai 100%.
        afterNextPaint(() => {
          if (cancelled) return;
          setIsReconciling(false);
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [qlData, bbData]);

  const handleUploadQlola = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseDataQlola(buffer);
      setQlData(parsed);
    } catch (err) {
      setUploadError(`Gagal membaca DataQlola: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUploadBukuBank = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseBukuBank(buffer);
      setBbData(parsed);
    } catch (err) {
      setUploadError(`Gagal membaca BukuBank: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAll = useCallback(() => {
    setQlData([]);
    setBbData([]);
    setUploadError('');
    setActiveTab('upload');
    setResults([]);
    setSummary(EMPTY_SUMMARY);
    setProgress(0);
    setProcessed(0);
    setTotalRows(0);
  }, []);

  const processing = {
    active: isLoading || isReconciling,
    // null = indeterminate (hanya saat membaca file); setelah rekonsiliasi
    // selesai nilainya tetap 100 agar overlay yang masih linger tidak berkedip.
    progress: isLoading ? null : progress,
    label: isLoading ? 'Membaca File...' : 'Mencocokkan Transaksi',
    detail: isReconciling
      ? `${processed.toLocaleString('id-ID')} / ${totalRows.toLocaleString('id-ID')} transaksi diproses`
      : 'Menyiapkan data...',
  };

  return {
    qlData,
    bbData,
    activeTab,
    setActiveTab,
    isLoading,
    uploadError,
    results,
    summary,
    processing,
    handleUploadQlola,
    handleUploadBukuBank,
    clearAll,
  };
}
