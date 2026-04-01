'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// In-memory cache: URL → { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>();
const STALE_TIME = 30_000; // 30 saniye — bu süre içinde cache'den anında göster
const TIMEOUT_MS = 30_000; // 30 saniye — API timeout

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

export function useFetch<T>(url: string | null): UseFetchResult<T> {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const bypassHttpCache = forceRef.current;
    forceRef.current = false;
    try {
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        ...(bypassHttpCache && { cache: 'reload' as RequestCache }),
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (urlRef.current === currentUrl) {
        cache.set(currentUrl, { data: json, ts: Date.now() });
        setData(json);
      }
    } catch (err) {
      if (urlRef.current === currentUrl) {
        // Background revalidation başarısız olursa mevcut cache'i koru, hata gösterme
        if (background) return;

        // AbortError (timeout) — açıkça kontrol et
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`[useFetch] Timeout: ${currentUrl} (>${TIMEOUT_MS}ms)`);
          setError('Sunucu yanıt vermedi, lütfen sayfayı yenileyin.');
          return;
        }

        const msg = err instanceof Error ? err.message : 'Bir hata oluştu';
        if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('403')) {
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?reason=session_expired';
          }
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
      setData(existing.data as T);
      setIsLoading(false);
      if (Date.now() - existing.ts > STALE_TIME) {
        fetchData(true);
      }
    } else {
      setData(null);
      fetchData();
    }
  }, [normalizedUrl, fetchData]);

  const refetch = useCallback(() => {
    if (normalizedUrl) cache.delete(normalizedUrl);
    forceRef.current = true;
    fetchData();
  }, [normalizedUrl, fetchData]);

  return { data, isLoading, error, refetch };
}
