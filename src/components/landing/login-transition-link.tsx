'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTransitionStore } from '@/store/transition-store';

interface LoginTransitionLinkProps {
  href?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Landing → Login geçişinde emerald curtain animasyonu tetikler.
 * Root layout'taki PageTransitionOverlay ile koordineli çalışır.
 */
export function LoginTransitionLink({
  href = '/auth/login',
  children,
  className,
  style,
}: LoginTransitionLinkProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const store = useTransitionStore.getState();
      if (store.isActive) return;

      router.prefetch(href);
      store.trigger();

      // Perde ekranı kapattıktan sonra navigate et (500ms sonra perde tam kapalı)
      const navTimer = setTimeout(() => router.push(href), 480);

      // Login sayfası yüklendikten sonra perdeyi kaldır
      const resetTimer = setTimeout(() => store.reset(), 880);

      return () => {
        clearTimeout(navTimer);
        clearTimeout(resetTimer);
      };
    },
    [router, href],
  );

  return (
    // <a> kullanıyoruz: sağ-tık "yeni sekmede aç" davranışı korunur
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}
