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
  fileSize: number;
  kind: UploadKind;
  progress: number;          // 0-100
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

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

const inferKind = (file: File): UploadKind => {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf' || file.type.includes('presentation')) return 'pdf';
  return 'video';
};

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  // XHR referansları state'e konmaz (re-render tetiklemesin); cancel için ref.
  const xhrMap = useRef<Map<string, XMLHttpRequest>>(new Map());
  const callbackMap = useRef<Map<string, { onComplete?: EnqueueArgs['onComplete']; onError?: EnqueueArgs['onError'] }>>(new Map());

  const updateUpload = useCallback((uploadId: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => (u.uploadId === uploadId ? { ...u, ...patch } : u)));
  }, []);

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

      updateUpload(uploadId, { progress: 5, status: 'uploading' });

      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          trainingId: draftId,
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || 'Yükleme URL alınamadı');
      }
      const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

      const xhr = new XMLHttpRequest();
      xhrMap.current.set(uploadId, xhr);

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.max(5, Math.round((ev.loaded / ev.total) * 95));
        updateUpload(uploadId, { progress: pct });
      };

      xhr.onload = () => {
        xhrMap.current.delete(uploadId);
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = { key, durationSeconds, pageCount };
          updateUpload(uploadId, { progress: 100, status: 'done', result });

          // Server-side persistence: kullanıcı wizard'da değil bile olsa
          // tamamlanan upload draftData.videos'a kalıcı yazılmalı. Aksi halde
          // wizard'a dönüldüğünde hydration boş gelir ve dosya kaybolmuş gözükür.
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
        } else {
          const msg = `Dosya yüklenemedi (HTTP ${xhr.status}). Yetki/CORS hatası olabilir.`;
          updateUpload(uploadId, { status: 'error', errorMessage: msg });
          callbackMap.current.get(uploadId)?.onError?.(msg);
        }
      };

      xhr.onerror = () => {
        xhrMap.current.delete(uploadId);
        const msg = 'Dosya yüklenemedi — S3 CORS yetkisi reddedildi olabilir.';
        updateUpload(uploadId, { status: 'error', errorMessage: msg });
        callbackMap.current.get(uploadId)?.onError?.(msg);
      };
      xhr.ontimeout = () => {
        xhrMap.current.delete(uploadId);
        const msg = 'Bağlantı zaman aşımına uğradı.';
        updateUpload(uploadId, { status: 'error', errorMessage: msg });
        callbackMap.current.get(uploadId)?.onError?.(msg);
      };

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Yükleme başarısız';
      updateUpload(uploadId, { status: 'error', errorMessage: msg });
      callbackMap.current.get(uploadId)?.onError?.(msg);
    }
  }, [updateUpload]);

  const cancel = useCallback((uploadId: string) => {
    const xhr = xhrMap.current.get(uploadId);
    if (xhr) {
      try { xhr.abort(); } catch { /* ignore */ }
      xhrMap.current.delete(uploadId);
    }
    updateUpload(uploadId, { status: 'canceled' });
  }, [updateUpload]);

  const dismiss = useCallback((uploadId: string) => {
    setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
    callbackMap.current.delete(uploadId);
  }, []);

  const getByDraft = useCallback((draftId: string) => uploads.filter(u => u.draftId === draftId), [uploads]);

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
