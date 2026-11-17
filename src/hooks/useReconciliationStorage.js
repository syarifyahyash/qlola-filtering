import { useState, useCallback, useMemo } from 'react';
import { parseBukuBank, parseDataQlola } from '../utils/fileParser';
import { reconcile } from '../utils/matchingEngine';

/**
 * Hook utama manajemen state rekonsiliasi.
 * Data disimpan dalam state memori (tidak di-persist ke localStorage karena ukuran file bisa besar).
 * Hanya status tab yang di-persist ke localStorage.
 */
export function useReconciliationStorage() {
  const [qlData, setQlData] = useState([]);         // array hasil parseDataQlola
  const [bbData, setBbData] = useState([]);         // array hasil parseBukuBank
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'matching' | 'belum' | 'review'
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Jalankan rekonsiliasi setiap kali data berubah
  const { results, summary } = useMemo(() => {
    if (!qlData.length || !bbData.length) {
      return { results: [], summary: { totalTransaksi: 0, matched: 0, perluReview: 0, belumDiambil: 0, totalNominal: 0, matchedNominal: 0, reviewNominal: 0, unmatchedNominal: 0, matchPercentage: 0 } };
    }
    return reconcile(qlData, bbData);
  }, [qlData, bbData]);

  const handleUploadQlola = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError('');
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseDataQlola(buffer);
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
      const parsed = parseBukuBank(buffer);
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
  }, []);

  return {
    qlData,
    bbData,
    activeTab,
    setActiveTab,
    isLoading,
    uploadError,
    results,
    summary,
    matchedResults: results.filter(r => r.status === 'MATCHED'),
    reviewResults: results.filter(r => r.status === 'PERLU_REVIEW'),
    unmatchedResults: results.filter(r => r.status === 'BELUM_DIAMBIL'),
    handleUploadQlola,
    handleUploadBukuBank,
    clearAll,
  };
}
