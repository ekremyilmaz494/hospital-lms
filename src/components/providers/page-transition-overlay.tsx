'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTransitionStore } from '@/store/transition-store';

const EASE = [0.76, 0, 0.24, 1] as const;

export function PageTransitionOverlay() {
  const isActive = useTransitionStore((s) => s.isActive);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="page-transition-root"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 9998 }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
          aria-hidden
        >
          {/* Katman 1: Emerald — ilk düşer */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: '#0d9668', transformOrigin: 'top' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
          />
          {/* Katman 2: Krem — hemen arkadan */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: '#fafaf9', transformOrigin: 'top' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.40, delay: 0.10, ease: EASE }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
