'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseFetchOptions {
  /** Polling interval in milliseconds. Pass 0 or omit to disable. */
  interval?: number;
  /**
   * Opt-in 401 handler. Return `true` (sync or async) to indicate the caller
   * handled the auth error — useFetch will then skip the forced
   * `/auth/login` redirect and only set a Turkish error message.
   * Return `false`/`undefined`/throw → falls back to the default redirect.
   *
   * Use case: mid-exam (`/exam/[id]/*`) — losing the session shouldn't
   * silently throw the user out of an attempt; show an inline retry modal
   * instead. (See plan: FAZ 2.A8)
   */
  onAuthError?: () => boolean | Promise<boolean>;
  /**
   * Modül-level cache'i tamamen atla — her mount'ta sunucudan taze veri çek
   * (okuma VE yazma atlanır). Sunucu yanıtı `Cache-Control: no-store` olan ve
   * bayatlaması kabul edilemez veriler için.
   *
   * Use case: video resume pozisyonu (`/api/exam/[id]/videos`) — SPA geri
   * dönüşünde bayat `lastPosition: 0` servis edilirse onLoadedMetadata seek'i
   * atlanır ve video baştan başlar ("kaldığım yerden devam etmiyor" şikayeti).
   */
  noStore?: boolean;
}

// In-memory cache: URL → { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();
const STALE_TIME = 60_000; // 60 saniye — geri navigasyonda anında gösterim
const TIMEOUT_MS = 30_000; // 30 saniye — API timeout
const MAX_CACHE_SIZE = 300;

function cacheSet(url: string, data: unknown) {
  cache.set(url, { data, ts: Date.now() });
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

/** Clear cached data for a specific URL (use before useFetch to prevent stale flash) */
export function clearFetchCache(url: string) {
  cache.delete(url);
}

/** Clear all cache entries whose key contains the given pattern.
 *  Use after POST/PATCH/DELETE to invalidate list caches.
 *  Example: invalidateFetchCache('/api/admin/staff') clears all staff-related entries.
 */
export function invalidateFetchCache(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

export function useFetch<T>(url: string | null, options?: UseFetchOptions): UseFetchResult<T> {
  const normalizedUrl = url?.trim() || null;
  const noStore = options?.noStore === true;
  const cached = normalizedUrl && !noStore ? cache.get(normalizedUrl) : null;
  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(normalizedUrl);
  urlRef.current = normalizedUrl;

  const forceRef = useRef(false);

  // FAZ 2.A8 — opt-in 401 handler kept in a ref so fetchData stays referentially
  // stable across renders (changing onAuthError shouldn't invalidate the callback).
  const onAuthErrorRef = useRef(options?.onAuthError);
  onAuthErrorRef.current = options?.onAuthError;

  // noStore da ref'te — fetchData ([] deps, stabil) ve URL effect'i içinden okunur.
  const noStoreRef = useRef(noStore);
  noStoreRef.current = noStore;

  const fetchData = useCallback(async (background = false) => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      setIsLoading(false);
      return;
    }
    if (!background) {
      const existing = noStoreRef.current ? undefined : cache.get(currentUrl);
      if (!existing) setIsLoading(true);
    }
    if (!background) setError(null);
    // Deduplication: aynı URL zaten fetch ediliyorsa sonucunu bekle
    const existing = inflight.get(currentUrl);
    if (existing) {
      try {
        const json = await existing;
        if (urlRef.current === currentUrl) {
          if (!noStoreRef.current) cacheSet(currentUrl, json);
          setData(json as T);
        }
      } catch {
        // Orijinal fetch hata handle ediyor
      } finally {
        if (urlRef.current === currentUrl) setIsLoading(false);
      }
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const bypassHttpCache = forceRef.current;
    forceRef.current = false;

    const fetchPromise = (async () => {
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        ...(bypassHttpCache && { cache: 'reload' as RequestCache }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    })();

    inflight.set(currentUrl, fetchPromise);

    try {
      const json = await fetchPromise;
      if (urlRef.current === currentUrl) {
        if (!noStoreRef.current) cacheSet(currentUrl, json);
        setData(json);
      }
    } catch (err) {
      if (urlRef.current === currentUrl) {
        if (background) return;

        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`[useFetch] Timeout: ${currentUrl} (>${TIMEOUT_MS}ms)`);
          setError('Sunucu yanıt vermedi, lütfen sayfayı yenileyin.');
          return;
        }

        const msg = err instanceof Error ? err.message : 'Bir hata oluştu';
        // 401 = session expired → login'e yönlendir (agresif loop korumalı)
        // 403 = authenticated ama yetkisiz → login'e yönlendirME, hata mesajı göster
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          // FAZ 2.A8 — opt-in handler chance to suppress the forced redirect
          // (e.g. mid-exam: show inline retry modal instead of throwing user out).
          const handler = onAuthErrorRef.current;
          if (handler) {
            try {
              const handled = await handler();
              if (handled) {
                setError('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.');
                return;
              }
            } catch {
              // Caller threw → fall through to default redirect behaviour.
            }
          }
          if (typeof window !== 'undefined') {
            // Loop koruması: 30 saniye içinde 2+ redirect → döngü tespit, durdur
            const now = Date.now();
            const lastRedirect = Number(sessionStorage.getItem('auth_redirect_at') || '0');
            const redirectCount = Number(sessionStorage.getItem('auth_redirect_count') || '0');

            if (now - lastRedirect < 30000) {
              // 30s içinde tekrar 401 aldık
              if (redirectCount >= 1) {
                // 2. kez → döngü tespit edildi, redirect YAPMA
                console.error('[useFetch] Auth redirect loop tespit edildi — durduruldu');
                sessionStorage.removeItem('auth_redirect_count');
                setError('Oturum doğrulanamadı. Lütfen sayfayı yenileyin veya tekrar giriş yapın.');
                return;
              }
              sessionStorage.setItem('auth_redirect_count', String(redirectCount + 1));
            } else {
              // 30s geçmiş — sayacı sıfırla
              sessionStorage.setItem('auth_redirect_count', '1');
            }

            sessionStorage.setItem('auth_redirect_at', String(now));
            window.location.href = '/auth/login?reason=session_expired';
          }
          return;
        }
        if (msg.includes('403')) {
          setError('Bu sayfaya erişim yetkiniz bulunmuyor.');
          return;
        }
        if (msg.includes('404')) {
          setError('İstenen kaynak bulunamadı');
        } else if (msg.includes('500')) {
          setError('Sunucu hatası oluştu, lütfen sayfayı yenileyin');
        } else if (msg.includes('503')) {
          setError('Servis geçici olarak kullanılamıyor, lütfen sayfayı yenileyin');
        } else {
          setError(msg);
        }
      }
    } finally {
      inflight.delete(currentUrl);
      clearTimeout(timeout);
      if (urlRef.current === currentUrl) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!normalizedUrl) {
      setIsLoading(false);
      return;
    }
    // noStore: cache'i hiç okuma — her zaman taze fetch (bayat lastPosition koruması).
    const existing = noStoreRef.current ? undefined : cache.get(normalizedUrl);
    if (existing) {
      // Aynı data reference'ı koruyarak gereksiz re-render önle
      setData((prev) => (prev === existing.data ? prev : (existing.data as T)));
      setIsLoading(false);
      if (Date.now() - existing.ts > STALE_TIME) {
        fetchData(true);
      }
    } else {
      // keepPreviousData davranışı: URL değişiminde eski veriyi STALE olarak
      // ekranda tutuyoruz, yeni fetch arka planda çalışır. setData(null)
      // yapmıyoruz çünkü search/sayfalama/filtre gibi sık-tetiklenen URL
      // değişimlerinde tablonun "boş" flash'lanması "sayfa yenileniyor"
      // hissi yaratıyor. İlk mount'ta data zaten useState(null) ile null
      // başlar — no-op risk yok.
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedUrl]);

  // Interval-based background polling
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalMs = options?.interval;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!normalizedUrl || !intervalMs || intervalMs <= 0) return;

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchData(true), intervalMs);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        fetchData(true);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedUrl, intervalMs]);

  const refetch = useCallback(() => {
    forceRef.current = true;
    // Reset interval timer to avoid double-fetch
    if (intervalRef.current && intervalMs && intervalMs > 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchData(true), intervalMs);
    }
    // Background fetch: keep existing data visible until new data arrives → no loading flash
    fetchData(true);
  }, [fetchData, intervalMs]);

  return { data, isLoading, error, refetch };
}
