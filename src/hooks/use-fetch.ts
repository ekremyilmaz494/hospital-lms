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
const MAX_CACHE_ENTRIES = 100; // Memory leak onlemi

/** Clear cached data for a specific URL (use before useFetch to prevent stale flash) */
export function clearFetchCache(url: string) {
  cache.delete(url);
}

/** Clear the entire cache — call on logout to prevent stale multi-tenant data */
export function clearAllFetchCache() {
  cache.clear();
}

export function useFetch<T>(url: string | null): UseFetchResult<T> {
  const cached = url ? cache.get(url) : null;
  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const fetchData = useCallback(async (background = false) => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      setIsLoading(false);
      return;
    }
    if (!background) {
      // Only show loading if no cached data
      const existing = cache.get(currentUrl);
      if (!existing) setIsLoading(true);
    }
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(currentUrl, { signal: controller.signal });
      // Auth hatalarini HTTP status uzerinden yakala (string esleme yerine)
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login?reason=session_expired';
        }
        return; // Yonlendirme yapiliyor, error set etmeye gerek yok
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (urlRef.current === currentUrl) {
        // LRU benzeri eviction: max entry sayisi asildiginda en eski kaydi sil
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }
        cache.set(currentUrl, { data: json, ts: Date.now() });
        setData(json);
      }
    } catch (err) {
      if (urlRef.current === currentUrl) {
        const msg = err instanceof Error ? err.message : 'Bir hata oluştu';
        if (msg.toLowerCase().includes('abort')) {
          // Timeout — kullanıcıya bildir
          setError('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
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
    if (!url) {
      setIsLoading(false);
      return;
    }
    const existing = cache.get(url);
    if (existing) {
      // Show cached data immediately
      setData(existing.data as T);
      setIsLoading(false);
      // If stale, revalidate in background
      if (Date.now() - existing.ts > STALE_TIME) {
        fetchData(true);
      }
    } else {
      setData(null);
      fetchData();
    }
  }, [url, fetchData]);

  const refetch = useCallback(() => {
    if (url) cache.delete(url);
    fetchData();
  }, [url, fetchData]);

  return { data, isLoading, error, refetch };
}
