'use client';

/**
 * UploadManagerProvider — admin layout köküne mount edilen singleton context.
 *
 * Niçin layout'a: Wizard sayfasından (örn. /admin/trainings/new/[id]) başka
 * admin sayfasına geçildiğinde provider unmount olmaz; XMLHttpRequest yaşar
 * ve dosya S3'e yüklenmeye devam eder. Eski yaklaşım (XHR'i wizard component'inde
 * tutmak) navigasyon anında abort yapıyordu.
 *
 * Akış:
 *   enqueue(file, draftId, kind, onComplete)
 *     → POST /api/upload/presign
 *     → XHR PUT to S3 (progress event'leri state'e yazılır)
 *     → onComplete({ key, durationSeconds?, pageCount? }) callback
 *
 * Active upload varken sayfayı kapatmaya çalışmak `beforeunload` confirm dialog'u
 * tetikler — kullanıcı yanlışlıkla kapatmasın.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type UploadKind = 'video' | 'pdf' | 'audio';

export type UploadStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadItem {
  uploadId: string;          // local UUID
  draftId: string;           // taslak training id'si
  contentItemId: number;     // wizard'daki video item id'si (callback eşleştirme için)
  fileName: string;
  fileSize: number;          // orijinal dosya boyutu
  kind: UploadKind;
  progress: number;          // 0-100 — status'a göre upload veya compress yüzdesi
  status: UploadStatus;
  errorMessage?: string;
  startedAt: number;
  /** Sıkıştırılmış dosya boyutu — compression yapıldıysa doludur. */
  compressedBytes?: number;
  /** Tamamlanma sonucu — done iken doludur. */
  result?: {
    key: string;
    durationSeconds?: number;
    pageCount?: number;
  };
}

export interface EnqueueArgs {
  draftId: string;
  contentItemId: number;
  file: File;
  /**
   * Tamamlanınca çağrılır. Kullanıcı wizard sayfasından çıkmış olabilir; bu yüzden
   * callback hiçbir component state'ine bağlanmamalı. Pratikte bu callback'i wizard
   * unmount-safe ayrı bir `pendingCompletion` listesine yazıp, wizard remount'ta
   * UploadManager state'inden okumak yeterli — bu provider zaten UploadItem.result'ı
   * tutar.
   */
  onComplete?: (result: UploadItem['result']) => void;
  onError?: (message: string) => void;
}

interface UploadManagerContextValue {
  uploads: UploadItem[];
  enqueue: (args: EnqueueArgs) => string;
  cancel: (uploadId: string) => void;
  /** Tamamlanmış/hatalı/iptal edilmiş bir kaydı listeden kaldır (UI temizliği için). */
  dismiss: (uploadId: string) => void;
  /** Belirli draftId'ye ait upload'ları döner — wizard remount'ta hydration için. */
  getByDraft: (draftId: string) => UploadItem[];
}

/** Bu boyutun üzerindeki video dosyaları client-side sıkıştırılır (ffmpeg.wasm).
 *  Türkiye→Frankfurt upload bandwidth ~7 Mbps fiziksel limit; 20+ MB dosyalarda
 *  H.264 720p/CRF28 transcode upload süresini ~%50 azaltır. Audio/PDF ve küçük
 *  video'lar atlanır (transcode CPU maliyeti kazanca değmez). */
const COMPRESS_THRESHOLD = 20 * 1024 * 1024; // 20 MB
/** Multipart eşiği: bu boyutun üstündeki dosyalar parça parça yüklenir. */
const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB
/** Multipart parça boyutu — S3 minimum 5 MB. 8 MB Türkiye/Frankfurt RTT için iyi denge. */
const PART_SIZE = 8 * 1024 * 1024; // 8 MB
/** Aynı anda kaç parça yüklensin — TCP slow-start'ı maskeler, NIC'i doyurur.
 *  Browser aynı origin'e ~6 paralel socket açıyor; birden fazla dosya aynı anda
 *  yüklenirse 3+3=6 sınırı yakalanır, daha yüksek concurrency soketleri kuyruğa
 *  iter ve "ağ hatası" olarak görünür. */
const PART_CONCURRENCY = 3;
/** Parça başına maksimum deneme — 1 ilk girişim + 2 retry. Transient ağ hataları
 *  ve S3 Transfer Acceleration edge node warm-up gecikmelerine karşı tampon. */
const PART_MAX_ATTEMPTS = 3;
/** XHR timeout — bir TCP bağlantısı bu süre boyunca byte taşımazsa fail eder.
 *  Türkiye→Frankfurt 8 MB parça en kötü 2 Mbps'de ~32 sn; 5 dk bol tampon.
 *  Tek-PUT branch'inde 10 MB altı dosyalar için aynı limit yeterli (default 0
 *  = sınırsız stuck TCP'lerde sonsuza dek bekliyordu — bug fix). */
const XHR_TIMEOUT_MS = 5 * 60_000;

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

const inferKind = (file: File): UploadKind => {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf' || file.type.includes('presentation')) return 'pdf';
  return 'video';
};

/** Tamamlanmış (done/error/canceled) kayıtların state'te kalma süresi.
 *  Widget bunları görsel olarak 4 sn sonra gizliyor; provider 60 sn sonra
 *  array'den de düşürüyor — yoksa uzun admin oturumlarında array sınırsız büyür. */
const TERMINAL_RETENTION_MS = 60_000;

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  // Aktif upload'lar için abort handle'ları. Single PUT'ta tek XHR'i,
  // multipart'ta tüm parça XHR'lerini + abort API çağrısını sarar.
  const abortMap = useRef<Map<string, { abort: () => void }>>(new Map());
  // Compression sırasında veya pending'de cancel basıldıysa ffmpeg.wasm'ı kesemeyiz,
  // ama bu Set'e yazıp sonraki aşamadan önce kontrol ederek upload'u başlatmayız.
  const canceledIds = useRef<Set<string>>(new Set());
  const callbackMap = useRef<Map<string, { onComplete?: EnqueueArgs['onComplete']; onError?: EnqueueArgs['onError'] }>>(new Map());
  // Terminal state'e gelen upload'ların kuyruktan otomatik düşürülme zamanları.
  const reapTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleReap = useCallback((uploadId: string) => {
    const existing = reapTimers.current.get(uploadId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
      callbackMap.current.delete(uploadId);
      reapTimers.current.delete(uploadId);
      canceledIds.current.delete(uploadId);
    }, TERMINAL_RETENTION_MS);
    reapTimers.current.set(uploadId, timer);
  }, []);

  const updateUpload = useCallback((uploadId: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => (u.uploadId === uploadId ? { ...u, ...patch } : u)));
    // Terminal state'e geçtiyse otomatik kırpma kuyruğuna ekle.
    if (patch.status === 'done' || patch.status === 'error' || patch.status === 'canceled') {
      scheduleReap(uploadId);
    }
  }, [scheduleReap]);

  const enqueue = useCallback((args: EnqueueArgs): string => {
    const uploadId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const kind = inferKind(args.file);
    const item: UploadItem = {
      uploadId,
      draftId: args.draftId,
      contentItemId: args.contentItemId,
      fileName: args.file.name,
      fileSize: args.file.size,
      kind,
      progress: 0,
      status: 'pending',
      startedAt: Date.now(),
    };
    setUploads(prev => [...prev, item]);
    callbackMap.current.set(uploadId, { onComplete: args.onComplete, onError: args.onError });

    // Async başlat — fetch presign ardından XHR PUT
    void startUpload(uploadId, args.draftId, args.contentItemId, args.file, kind);

    return uploadId;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startUpload = useCallback(async (uploadId: string, draftId: string, contentItemId: number, originalFile: File, kind: UploadKind) => {
    // `file` upload sırasında compression sonucuyla değişebilir; `originalFile`
    // metadata tespitinde (PDF page count, audio duration) referans olarak kalır.
    let file = originalFile;
    try {
      // PDF sayfa sayısı tespiti — opsiyonel, hata yutulur
      let pageCount: number | undefined;
      if (kind === 'pdf') {
        try {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs`;
          const buf = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
          pageCount = pdf.numPages;
        } catch { /* ignore — sayfa sayısı opsiyonel */ }
      }

      // Audio süresi tespiti
      let durationSeconds: number | undefined;
      if (kind === 'audio') {
        try {
          durationSeconds = await new Promise<number>((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const audio = new Audio(url);
            audio.onloadedmetadata = () => {
              const d = Math.round(audio.duration);
              URL.revokeObjectURL(url);
              resolve(Number.isFinite(d) ? d : 0);
            };
            audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio meta')); };
          });
        } catch { /* ignore */ }
      }

      // Video sıkıştırma — bandwidth fiziksel limit (Türkiye-Frankfurt ~7 Mbps).
      // 20+ MB video'larda H.264 720p/CRF28 transcode upload süresini ~%50 azaltır.
      // Hata durumunda fallback: orijinal dosya upload edilir, kullanıcı süreçte kalır.
      if (kind === 'video' && file.size > COMPRESS_THRESHOLD) {
        try {
          updateUpload(uploadId, { status: 'compressing', progress: 0 });
          const { compressVideo } = await import('@/lib/video-compressor');
          const result = await compressVideo(file, (pct) => {
            if (canceledIds.current.has(uploadId)) return; // cancel'dan sonra UI güncellemesi yapma
            updateUpload(uploadId, { progress: pct });
          });
          if (canceledIds.current.has(uploadId)) return; // compression sırasında iptal edilmişse upload başlatma
          // Sıkıştırılmış blob'u File gibi kullan — uzantı .mp4'e zorlanır (output her zaman mp4)
          const newName = file.name.replace(/\.[^.]+$/, '.mp4');
          file = new File([result.blob], newName, { type: 'video/mp4' });
          updateUpload(uploadId, { compressedBytes: result.compressedBytes });
          console.log(`[upload] sıkıştırıldı: ${result.originalBytes} → ${result.compressedBytes} bytes (${Math.round((1 - result.compressedBytes / result.originalBytes) * 100)}% azaldı)`);
        } catch (err) {
          if (canceledIds.current.has(uploadId)) return;
          console.warn('[upload] sıkıştırma başarısız, orijinal dosya yüklenecek', err);
          // file değişmedi, orijinal upload devam eder
        }
      }

      if (canceledIds.current.has(uploadId)) return; // PDF/audio meta tespiti sırasında iptal de mümkün

      updateUpload(uploadId, { progress: 1, status: 'uploading' });

      const useMultipart = file.size > MULTIPART_THRESHOLD;

      const finalizeSuccess = (key: string) => {
        const result = { key, durationSeconds, pageCount };
        updateUpload(uploadId, { progress: 100, status: 'done', result });

        // Server-side persistence: kullanıcı wizard'da değil bile olsa
        // tamamlanan upload draftData.videos'a kalıcı yazılmalı.
        void fetch(`/api/admin/trainings/${draftId}/draft/append-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            id: contentItemId,
            title: file.name.replace(/\.[^.]+$/, ''),
            url: key,
            contentType: kind,
            durationSeconds,
            pageCount,
          }),
        }).catch(() => { /* best-effort */ });

        callbackMap.current.get(uploadId)?.onComplete?.(result);
      };

      const failUpload = (msg: string) => {
        abortMap.current.delete(uploadId);
        updateUpload(uploadId, { status: 'error', errorMessage: msg });
        callbackMap.current.get(uploadId)?.onError?.(msg);
      };

      if (!useMultipart) {
        // ----- Single PUT (küçük dosya) — Transfer Acceleration ile presigned -----
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, contentType: file.type, trainingId: draftId }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err.error || 'Yükleme URL alınamadı');
        }
        const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

        const xhr = new XMLHttpRequest();
        abortMap.current.set(uploadId, { abort: () => { try { xhr.abort(); } catch { /* ignore */ } } });

        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = Math.max(1, Math.round((ev.loaded / ev.total) * 99));
          updateUpload(uploadId, { progress: pct });
        };
        xhr.onload = () => {
          abortMap.current.delete(uploadId);
          if (xhr.status >= 200 && xhr.status < 300) finalizeSuccess(key);
          else {
            const body = (xhr.responseText || '').slice(0, 300);
            console.error('[upload] single PUT HTTP error', { status: xhr.status, responseURL: xhr.responseURL, body });
            failUpload(`Dosya yüklenemedi (HTTP ${xhr.status}). ${body.slice(0, 120)}`);
          }
        };
        xhr.onerror = () => {
          console.error('[upload] single PUT network error', { status: xhr.status, responseURL: xhr.responseURL });
          failUpload(`Dosya yüklenemedi (status=${xhr.status}). S3 CORS reddi veya bağlantı kesintisi.`);
        };
        xhr.ontimeout = () => failUpload('Bağlantı zaman aşımına uğradı.');

        xhr.open('PUT', uploadUrl);
        xhr.timeout = XHR_TIMEOUT_MS;
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
        return;
      }

      // ----- Multipart upload (büyük dosya) — paralel parçalar -----
      const createRes = await fetch('/api/upload/multipart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, trainingId: draftId }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || 'Multipart upload başlatılamadı');
      }
      const { uploadId: s3UploadId, key } = (await createRes.json()) as { uploadId: string; key: string };

      const totalParts = Math.ceil(file.size / PART_SIZE);
      const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);

      // Tüm parça URL'lerini tek istekte al — 100 parça limiti var, daha büyük dosyalar için batch'le.
      const allUrls: { partNumber: number; url: string }[] = [];
      for (let i = 0; i < partNumbers.length; i += 100) {
        const batch = partNumbers.slice(i, i + 100);
        const signRes = await fetch('/api/upload/multipart/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, uploadId: s3UploadId, partNumbers: batch }),
        });
        if (!signRes.ok) {
          const err = await signRes.json().catch(() => ({}));
          throw new Error(err.error || 'Parça URL imzalanamadı');
        }
        const { urls } = (await signRes.json()) as { urls: { partNumber: number; url: string }[] };
        allUrls.push(...urls);
      }

      // İlerleme: her parçanın yüklenmiş byte'ı ayrı tutulur, toplam dosya boyutuna oranlanır.
      const partLoaded = new Map<number, number>();
      const activeXhrs = new Map<number, XMLHttpRequest>();
      let aborted = false;

      abortMap.current.set(uploadId, {
        abort: () => {
          aborted = true;
          activeXhrs.forEach(x => { try { x.abort(); } catch { /* ignore */ } });
          activeXhrs.clear();
          void fetch('/api/upload/multipart/abort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ key, uploadId: s3UploadId }),
          }).catch(() => { /* best-effort */ });
        },
      });

      const updateProgress = () => {
        let loaded = 0;
        partLoaded.forEach(v => { loaded += v; });
        const pct = Math.max(1, Math.min(99, Math.round((loaded / file.size) * 99)));
        updateUpload(uploadId, { progress: pct });
      };

      const uploadPart = (partNumber: number, url: string): Promise<{ partNumber: number; etag: string }> => {
        return new Promise((resolve, reject) => {
          if (aborted) { reject(new Error('aborted')); return; }
          const start = (partNumber - 1) * PART_SIZE;
          const end = Math.min(start + PART_SIZE, file.size);
          const blob = file.slice(start, end);

          const xhr = new XMLHttpRequest();
          activeXhrs.set(partNumber, xhr);
          xhr.upload.onprogress = (ev) => {
            if (!ev.lengthComputable) return;
            partLoaded.set(partNumber, ev.loaded);
            updateProgress();
          };
          xhr.onload = () => {
            activeXhrs.delete(partNumber);
            if (xhr.status >= 200 && xhr.status < 300) {
              // ETag header'ı tırnak içinde döner; CompleteMultipartUpload aynen kabul eder.
              const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag');
              if (!etag) { reject(new Error(`Parça ${partNumber}: ETag header yok (CORS ExposeHeaders kontrol et)`)); return; }
              partLoaded.set(partNumber, end - start); // tam boyut
              updateProgress();
              resolve({ partNumber, etag });
            } else {
              const body = (xhr.responseText || '').slice(0, 300);
              console.error('[upload] part HTTP error', { partNumber, status: xhr.status, responseURL: xhr.responseURL, body });
              reject(new Error(`Parça ${partNumber} HTTP ${xhr.status}: ${body.slice(0, 120)}`));
            }
          };
          xhr.onerror = () => {
            activeXhrs.delete(partNumber);
            console.error('[upload] part network error', { partNumber, status: xhr.status, responseURL: xhr.responseURL });
            reject(new Error(`Parça ${partNumber} ağ hatası (status=${xhr.status})`));
          };
          xhr.ontimeout = () => { activeXhrs.delete(partNumber); reject(new Error(`Parça ${partNumber} zaman aşımı`)); };
          xhr.open('PUT', url);
          xhr.timeout = XHR_TIMEOUT_MS;
          xhr.send(blob);
        });
      };

      // Concurrency limit'li worker pool. Her parça PART_MAX_ATTEMPTS kez denenir;
      // başarısızlık aralarında exponential backoff (500ms, 1500ms) bekler.
      const queue = [...allUrls];
      const results: { partNumber: number; etag: string }[] = [];
      // Hata referansını ref-cell'de tut — closure'da type narrowing'i bozmaz.
      const errorBox: { value: Error | null } = { value: null };

      const worker = async () => {
        while (queue.length > 0 && !errorBox.value && !aborted) {
          const next = queue.shift();
          if (!next) break;
          let lastErr: Error | null = null;
          for (let attempt = 1; attempt <= PART_MAX_ATTEMPTS; attempt++) {
            if (aborted) return;
            try {
              const res = await uploadPart(next.partNumber, next.url);
              results.push(res);
              lastErr = null;
              break;
            } catch (err) {
              lastErr = err instanceof Error ? err : new Error(String(err));
              if (attempt < PART_MAX_ATTEMPTS) {
                // Exponential backoff: 500ms, 1500ms — edge node warm-up ve transient'lere zaman tanı.
                await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
              }
            }
          }
          if (lastErr && !errorBox.value) errorBox.value = lastErr;
        }
      };

      await Promise.all(Array.from({ length: PART_CONCURRENCY }, () => worker()));

      if (aborted) return; // cancel() zaten state'i 'canceled' yaptı
      if (errorBox.value) {
        void fetch('/api/upload/multipart/abort', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
          body: JSON.stringify({ key, uploadId: s3UploadId }),
        }).catch(() => {});
        failUpload(errorBox.value.message || 'Multipart yükleme başarısız');
        return;
      }

      // Birleştir
      const completeRes = await fetch('/api/upload/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, uploadId: s3UploadId, parts: results }),
      });
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(err.error || 'Multipart tamamlanamadı');
      }
      abortMap.current.delete(uploadId);
      finalizeSuccess(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Yükleme başarısız';
      abortMap.current.delete(uploadId);
      updateUpload(uploadId, { status: 'error', errorMessage: msg });
      callbackMap.current.get(uploadId)?.onError?.(msg);
    }
  }, [updateUpload]);

  const cancel = useCallback((uploadId: string) => {
    canceledIds.current.add(uploadId);
    const handle = abortMap.current.get(uploadId);
    if (handle) {
      try { handle.abort(); } catch { /* ignore */ }
      abortMap.current.delete(uploadId);
    }
    updateUpload(uploadId, { status: 'canceled' });
  }, [updateUpload]);

  const dismiss = useCallback((uploadId: string) => {
    setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
    callbackMap.current.delete(uploadId);
    const t = reapTimers.current.get(uploadId);
    if (t) { clearTimeout(t); reapTimers.current.delete(uploadId); }
  }, []);

  const getByDraft = useCallback((draftId: string) => uploads.filter(u => u.draftId === draftId), [uploads]);

  // Provider unmount'ta tüm reap timer'larını temizle (memory leak önleme)
  useEffect(() => {
    const timers = reapTimers.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // beforeunload — aktif yükleme varsa kullanıcıyı uyar
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const active = uploads.some(u => u.status === 'uploading' || u.status === 'pending');
      if (active) {
        e.preventDefault();
        // Modern browser'larda mesaj override edilemez ama yine de set ediyoruz.
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploads]);

  return (
    <UploadManagerContext.Provider value={{ uploads, enqueue, cancel, dismiss, getByDraft }}>
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager(): UploadManagerContextValue {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) {
    throw new Error('useUploadManager must be used within an UploadManagerProvider');
  }
  return ctx;
}
