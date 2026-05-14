'use client'

import { useEffect, useState } from 'react'

/**
 * Bir değerin değişmesi durunca (delay süresince sabit kalınca) güncellenen
 * sürümünü döner. Tipik kullanım: arama input'unu her tuşta API'ye gönderme,
 * 300ms duraklama bekle.
 *
 * @example
 *   const [query, setQuery] = useState('')
 *   const debouncedQuery = useDebounce(query, 300)
 *   // debouncedQuery API çağrılarında kullanılır, query input'a bağlıdır
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
