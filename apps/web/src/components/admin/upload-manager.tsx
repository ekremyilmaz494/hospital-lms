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

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadItem {
  uploadId: string;          // local UUID
  draftId: string;           // taslak training id'si
  contentItemId: number;     // wizard'daki video item id'si (callback eşleştirme için)
  fileName: string;
  fileSize: number;          // orijinal dosya boyutu
  kind: UploadKind;
  progress: number;          // 0-100 — XHR upload yüzdesi
  status: UploadStatus;
  errorMessage?: string;
  startedAt: number;
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
  // Pending durumda (PDF/audio meta tespiti sırasında) cancel basıldıysa
  // upload başlatılmadan önce bu Set'ten kontrol edilir.
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

  const startUpload = useCallback(async (uploadId: string, draftId: string, contentItemId: number, file: File, kind: UploadKind) => {
    try {
      // PDF sayfa sayısı tespiti — opsiyonel, hata yutulur
      let pageCount: number | undefined;
      if (kind === 'pdf') {
        try {
          const pdfjs = await import('pdfjs-dist');
          // Yerel worker (public/pdf.worker.min.mjs — exam/pdf-viewer.tsx ile aynı). unpkg CDN'i
          // (1) kapalı-ağ on-prem'de erişilemez → air-gap kırığı, (2) sabitlenmiş @4.9.155 kurulu
          // pdfjs-dist v5 ile uyuşmaz (pdfjs api==worker sürüm ister) → CDN'le bile bozuktu.
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          const buf = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
          pageCount = pdf.numPages;
        } catch { /* ignore — sayfa sayısı opsiyonel */ }
      }

      // Video/ses süresi tespiti — sınav video tamamlanma kapısı (%80 izleme)
      // bu süreye dayanır. Eskiden YALNIZ 'audio' ölçülüyordu; 'video' süresi
      // ölçülmeden kaydolup downstream tahmini default'lar (publish → 300 sn)
      // tamamlanma eşiğini bozuyordu — personel video ortasında "tamamlandı"
      // sayılıp akıştan atılıyordu. (Plan Faz 1, Adım 1.)
      let durationSeconds: number | undefined;
      if (kind === 'audio' || kind === 'video') {
        try {
          durationSeconds = await new Promise<number>((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const media: HTMLMediaElement = kind === 'video'
              ? document.createElement('video')
              : new Audio();
            media.preload = 'metadata';
            media.onloadedmetadata = () => {
              const d = Math.round(media.duration);
              URL.revokeObjectURL(url);
              // Sonlu ve pozitif değilse 0 dön — downstream guard 0'ı güvenli ele alır.
              resolve(Number.isFinite(d) && d > 0 ? d : 0);
            };
            media.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${kind} meta`)); };
            media.src = url;
          });
        } catch { /* ignore — süre opsiyonel; downstream guard 0'ı ele alır */ }
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
        // ----- Single PUT (küçük dosya) — Accelerated first, non-accelerated fallback -----
        // Müşteri kurum ağı *.s3-accelerate.amazonaws.com'u blokluyorsa accelerated XHR
        // status=0 ile fail eder; bu durumda standart regional endpoint'e tek seferlik
        // fallback yaparak çoğu hastane/proxy senaryosunu kurtarıyoruz.
        const performSinglePut = async (accelerate: boolean): Promise<void> => {
          const startTime = performance.now();
          const presignRes = await fetch('/api/upload/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, contentType: file.type, trainingId: draftId, accelerate }),
          });
          if (!presignRes.ok) {
            const err = await presignRes.json().catch(() => ({}));
            throw new Error(err.error || 'Yükleme URL alınamadı');
          }
          const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            abortMap.current.set(uploadId, { abort: () => { try { xhr.abort(); } catch { /* ignore */ } } });

            xhr.upload.onprogress = (ev) => {
              if (!ev.lengthComputable) return;
              const pct = Math.max(1, Math.round((ev.loaded / ev.total) * 99));
              updateUpload(uploadId, { progress: pct });
            };
            xhr.onload = () => {
              abortMap.current.delete(uploadId);
              if (xhr.status >= 200 && xhr.status < 300) {
                finalizeSuccess(key);
                resolve();
              } else {
                const body = (xhr.responseText || '').slice(0, 300);
                const host = (() => { try { return new URL(xhr.responseURL || uploadUrl).hostname; } catch { return '(unknown)'; } })();
                console.error('[upload] single PUT HTTP error', { status: xhr.status, host, accelerate, durationMs: Math.round(performance.now() - startTime), body });
                reject(new Error(`HTTP_${xhr.status}`));
              }
            };
            xhr.onerror = () => {
              const host = (() => { try { return new URL(xhr.responseURL || uploadUrl).hostname; } catch { return '(unknown)'; } })();
              console.error('[upload] single PUT network error', { status: xhr.status, host, accelerate, durationMs: Math.round(performance.now() - startTime), userAgent: navigator.userAgent });
              reject(new Error('NETWORK'));
            };
            xhr.ontimeout = () => reject(new Error('TIMEOUT'));

            xhr.open('PUT', uploadUrl);
            xhr.timeout = XHR_TIMEOUT_MS;
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
          });
        };

        try {
          await performSinglePut(true);
        } catch (err) {
          // Cancel edilmişse fallback denemeden çık
          if (canceledIds.current.has(uploadId)) return;
          const firstMsg = err instanceof Error ? err.message : String(err);
          console.warn('[upload] Accelerated single PUT failed, trying non-accelerated fallback', firstMsg);
          try {
            await performSinglePut(false);
          } catch (err2) {
            if (canceledIds.current.has(uploadId)) return;
            const msg2 = err2 instanceof Error ? err2.message : String(err2);
            if (msg2 === 'TIMEOUT') {
              failUpload('Bağlantı zaman aşımına uğradı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
            } else if (msg2.startsWith('HTTP_')) {
              failUpload(`Dosya yüklenemedi (${msg2.replace('HTTP_', 'HTTP ')}). Sunucu yanıt verdi ama isteği reddetti — dosya türü veya boyutu uygun olmayabilir.`);
            } else {
              failUpload('Kurum ağı S3 video yüklemesini engelliyor olabilir. Yükleme başarısız (ağ hatası). Bilgisayarınızın güvenlik duvarı, kurumsal proxy veya antivirüs AWS S3 erişimini engelliyor olabilir. IT yöneticinizden şu alanlara HTTPS erişimi isteyin: *.s3.eu-central-1.amazonaws.com ve *.s3-accelerate.amazonaws.com.');
            }
          }
        }
        return;
      }

      // ----- Multipart upload (büyük dosya) — paralel parçalar -----
      // createMultipart sunucu↔S3 arası; accelerate parametresi server-side için
      // bir DNS farkı yaratmaz, default'ta accelerated client kullanılır.
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

      // Parça URL'lerini imzalama — 100'lü batch. accelerate=true default;
      // fallback'te aynı fonksiyon accelerate=false ile yeniden çağrılır.
      const fetchPartUrls = async (partNos: number[], accelerate: boolean): Promise<{ partNumber: number; url: string }[]> => {
        const collected: { partNumber: number; url: string }[] = [];
        for (let i = 0; i < partNos.length; i += 100) {
          const batch = partNos.slice(i, i + 100);
          const signRes = await fetch('/api/upload/multipart/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, uploadId: s3UploadId, partNumbers: batch, accelerate }),
          });
          if (!signRes.ok) {
            const err = await signRes.json().catch(() => ({}));
            throw new Error(err.error || 'Parça URL imzalanamadı');
          }
          const { urls } = (await signRes.json()) as { urls: { partNumber: number; url: string }[] };
          collected.push(...urls);
        }
        return collected;
      };

      const allUrls = await fetchPartUrls(partNumbers, true);

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

      const results: { partNumber: number; etag: string }[] = [];
      // Hangi accelerated/non-accelerated attempt'te olduğumuzu hata loguna dahil etmek için.
      let currentAttemptAccelerated = true;

      const uploadPart = (partNumber: number, url: string): Promise<{ partNumber: number; etag: string }> => {
        return new Promise((resolve, reject) => {
          if (aborted) { reject(new Error('aborted')); return; }
          const start = (partNumber - 1) * PART_SIZE;
          const end = Math.min(start + PART_SIZE, file.size);
          const blob = file.slice(start, end);
          const partStartTime = performance.now();

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
              const host = (() => { try { return new URL(xhr.responseURL || url).hostname; } catch { return '(unknown)'; } })();
              console.error('[upload] part HTTP error', { partNumber, status: xhr.status, host, accelerated: currentAttemptAccelerated, durationMs: Math.round(performance.now() - partStartTime), body });
              reject(new Error(`Parça ${partNumber} HTTP ${xhr.status}: ${body.slice(0, 120)}`));
            }
          };
          xhr.onerror = () => {
            activeXhrs.delete(partNumber);
            const host = (() => { try { return new URL(xhr.responseURL || url).hostname; } catch { return '(unknown)'; } })();
            console.error('[upload] part network error', { partNumber, status: xhr.status, host, accelerated: currentAttemptAccelerated, durationMs: Math.round(performance.now() - partStartTime), userAgent: navigator.userAgent });
            reject(new Error(`Parça ${partNumber} ağ hatası (status=${xhr.status})`));
          };
          xhr.ontimeout = () => { activeXhrs.delete(partNumber); reject(new Error(`Parça ${partNumber} zaman aşımı`)); };
          xhr.open('PUT', url);
          xhr.timeout = XHR_TIMEOUT_MS;
          xhr.send(blob);
        });
      };

      // Concurrency limit'li worker pool. Verilen URL listesini paralel yükler,
      // her parça için PART_MAX_ATTEMPTS deneme + exponential backoff.
      const runWorkers = async (urlList: { partNumber: number; url: string }[]): Promise<Error | null> => {
        const queue = [...urlList];
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
                  await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
                }
              }
            }
            if (lastErr && !errorBox.value) errorBox.value = lastErr;
          }
        };

        await Promise.all(Array.from({ length: PART_CONCURRENCY }, () => worker()));
        return errorBox.value;
      };

      let firstError = await runWorkers(allUrls);

      // Non-accelerated fallback — accelerated endpoint engellenmişse standart
      // regional endpoint ile sadece eksik kalan parçalar yeniden denenir.
      let attemptedNonAccelerated = false;
      if (!aborted && firstError) {
        attemptedNonAccelerated = true;
        currentAttemptAccelerated = false;
        const successfulParts = new Set(results.map(r => r.partNumber));
        const missingPartNumbers = partNumbers.filter(n => !successfulParts.has(n));
        console.warn('[upload] Multipart accelerated fail, retrying missing parts via non-accelerated endpoint', {
          missingCount: missingPartNumbers.length,
          firstError: firstError.message,
        });
        try {
          const fallbackUrls = await fetchPartUrls(missingPartNumbers, false);
          firstError = await runWorkers(fallbackUrls);
        } catch (err) {
          firstError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (aborted) return; // cancel() zaten state'i 'canceled' yaptı
      if (firstError) {
        void fetch('/api/upload/multipart/abort', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
          body: JSON.stringify({ key, uploadId: s3UploadId }),
        }).catch(() => {});
        // Accelerated + non-accelerated her ikisi de fail olduysa kullanıcıya
        // kurum ağı talimatı ver — kod tarafında yapılabilecek her şey denenmiştir.
        const msg = attemptedNonAccelerated
          ? 'Kurum ağı S3 video yüklemesini engelliyor olabilir. Yükleme başarısız (ağ hatası). Bilgisayarınızın güvenlik duvarı, kurumsal proxy veya antivirüs AWS S3 erişimini engelliyor olabilir. IT yöneticinizden şu alanlara HTTPS erişimi isteyin: *.s3.eu-central-1.amazonaws.com ve *.s3-accelerate.amazonaws.com.'
          : firstError.message || 'Multipart yükleme başarısız';
        failUpload(msg);
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
