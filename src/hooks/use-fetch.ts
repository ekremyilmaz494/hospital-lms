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
  const cached = normalizedUrl ? cache.get(normalizedUrl) : null;
  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(normalizedUrl);
  urlRef.current = normalizedUrl;

  const forceRef = useRef(false);

  const fetchData = useCallback(async (background = false) => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      setIsLoading(false);
      return;
    }
    if (!background) {
      const existing = cache.get(currentUrl);
      if (!existing) setIsLoading(true);
    }
    if (!background) setError(null);
    // Deduplication: aynı URL zaten fetch ediliyorsa sonucunu bekle
    const existing = inflight.get(currentUrl);
    if (existing) {
      try {
        const json = await existing;
        if (urlRef.current === currentUrl) {
          cacheSet(currentUrl, json);
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
        cacheSet(currentUrl, json);
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
    const existing = cache.get(normalizedUrl);
    if (existing) {
      // Aynı data reference'ı koruyarak gereksiz re-render önle
      setData(prev => prev === existing.data ? prev : existing.data as T);
      setIsLoading(false);
      if (Date.now() - existing.ts > STALE_TIME) {
        fetchData(true);
      }
    } else {
      setData(null);
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
    if (normalizedUrl) cache.delete(normalizedUrl);
    forceRef.current = true;
    // Reset interval timer to avoid double-fetch
    if (intervalRef.current && intervalMs && intervalMs > 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchData(true), intervalMs);
    }
    fetchData();
  }, [normalizedUrl, fetchData, intervalMs]);

  return { data, isLoading, error, refetch };
}
