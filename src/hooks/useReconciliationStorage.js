import { useState, useCallback, useEffect, useRef } from 'react';
import { parseBlokWanita, parseBukuBank, parseDataQlola } from '../utils/fileParser';
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
  blokWanita: null,
};

/** Jalankan callback setelah frame berikutnya selesai dilukis. */
function afterNextPaint(cb) {
  if (typeof requestAnimationFrame === 'undefined') {
    setTimeout(cb, 0);
    return;
  }

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };

  requestAnimationFrame(() => requestAnimationFrame(run));
  // Fallback: requestAnimationFrame di-throttle saat tab tidak aktif,
  // sehingga overlay tidak boleh bergantung penuh pada rAF.
  setTimeout(run, 250);
}

/**
 * Hook utama manajemen state rekonsiliasi.
 * Data disimpan dalam state memori (tidak di-persist ke localStorage karena ukuran file bisa besar).
 *
 * Rekonsiliasi TIDAK berjalan otomatis setelah upload. User harus menekan
 * tombol "Proses" karena Blok Wanita bersifat opsional: bisa memproses
 * QLola vs Buku Bank saja, atau sekaligus mengecek ke data Blok Wanita.
 */
export function useReconciliationStorage() {
  const [qlData, setQlData] = useState([]);         // array hasil parseDataQlola
  const [bbData, setBbData] = useState([]);         // array hasil parseBukuBank
  const [bwData, setBwData] = useState([]);         // array hasil parseBlokWanita (opsional)
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
  const [phase, setPhase] = useState('matching');

  const abortRef = useRef(null);

  // Batalkan proses yang sedang berjalan saat komponen unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Hapus hasil lama (dipanggil setiap ada data baru diupload). */
  const resetProcessed = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResults([]);
    setSummary(EMPTY_SUMMARY);
    setIsReconciling(false);
    setProgress(0);
    setProcessed(0);
    setTotalRows(0);
    setPhase('matching');
  }, []);

  const handleUploadQlola = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseDataQlola(buffer);
      setQlData(parsed);
      resetProcessed();
    } catch (err) {
      setUploadError(`Gagal membaca DataQlola: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [resetProcessed]);

  const handleUploadBukuBank = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseBukuBank(buffer);
      setBbData(parsed);
      resetProcessed();
    } catch (err) {
      setUploadError(`Gagal membaca BukuBank: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [resetProcessed]);

  const handleUploadBlokWanita = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseBlokWanita(buffer);
      setBwData(parsed);
      resetProcessed();
    } catch (err) {
      setUploadError(`Gagal membaca Blok Wanita: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [resetProcessed]);

  /** Jalankan rekonsiliasi secara manual (dipicu tombol Proses). */
  const processReconciliation = useCallback(async () => {
    if (!qlData.length || !bbData.length || isLoading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsReconciling(true);
    setProgress(0);
    setProcessed(0);
    setTotalRows(qlData.length);
    setPhase('matching');

    try {
      const res = await reconcileAsync(qlData, bbData, {
        blokWanita: bwData,
        signal: controller.signal,
        onProgress: (pct, done, total, currentPhase) => {
          if (controller.signal.aborted) return;
          setProgress(pct);
          setProcessed(done);
          setTotalRows(total);
          setPhase(currentPhase || 'matching');
        },
      });

      if (controller.signal.aborted) return;
      setResults(res.results);
      setSummary(res.summary);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setUploadError(`Gagal melakukan rekonsiliasi: ${err.message}`);
    } finally {
      if (!controller.signal.aborted) {
        // Tahan overlay sampai tabel sempat dilukis, supaya tidak ada
        // jeda "blank"/freeze sesaat setelah progres mencapai 100%.
        afterNextPaint(() => {
          if (!controller.signal.aborted) setIsReconciling(false);
        });
      }
    }
  }, [qlData, bbData, bwData, isLoading]);

  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setQlData([]);
    setBbData([]);
    setBwData([]);
    setUploadError('');
    setActiveTab('upload');
    setResults([]);
    setSummary(EMPTY_SUMMARY);
    setIsReconciling(false);
    setProgress(0);
    setProcessed(0);
    setTotalRows(0);
    setPhase('matching');
  }, []);

  const processing = {
    active: isLoading || isReconciling,
    // null = indeterminate (hanya saat membaca file); setelah rekonsiliasi
    // selesai nilainya tetap 100 agar overlay yang masih linger tidak berkedip.
    progress: isLoading ? null : progress,
    label: isLoading
      ? 'Membaca File...'
      : phase === 'blok-wanita'
        ? 'Mencocokkan Blok Wanita...'
        : 'Mencocokkan Transaksi',
    detail: isReconciling
      ? `${processed.toLocaleString('id-ID')} / ${totalRows.toLocaleString('id-ID')} transaksi diproses`
      : 'Menyiapkan data...',
  };

  const canProcess = qlData.length > 0 && bbData.length > 0;
  const hasProcessed = results.length > 0;

  return {
    qlData,
    bbData,
    bwData,
    activeTab,
    setActiveTab,
    isLoading,
    uploadError,
    results,
    summary,
    processing,
    canProcess,
    hasProcessed,
    handleUploadQlola,
    handleUploadBukuBank,
    handleUploadBlokWanita,
    processReconciliation,
    clearAll,
  };
}
