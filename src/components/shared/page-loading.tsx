'use client';

import { motion } from 'framer-motion';

export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Yükleniyor">
      <div className="flex flex-col items-center gap-4">
        {/* Animated spinner */}
        <div className="relative h-12 w-12">
          <motion.div
            className="absolute inset-0 rounded-full border-[3px]"
            style={{
              borderColor: 'var(--color-border)',
              borderTopColor: 'var(--color-primary)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-1.5 rounded-full border-[3px]"
            style={{
              borderColor: 'transparent',
              borderTopColor: 'var(--color-accent)',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Pulsing text */}
        <motion.p
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-muted)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          Yükleniyor...
        </motion.p>

        {/* Animated dots bar */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--color-primary)' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
