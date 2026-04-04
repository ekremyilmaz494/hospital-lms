'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertTriangle, Info, XCircle, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  href: string;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', text: 'var(--color-success)', icon: 'var(--color-success)' },
  error: { bg: 'var(--color-error-bg)', border: 'var(--color-error)', text: 'var(--color-error)', icon: 'var(--color-error)' },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', text: 'var(--color-warning)', icon: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info)', text: 'var(--color-info)', icon: 'var(--color-info)' },
};

function ToastActionButton({ action, onClose }: { action: ToastAction; onClose: () => void }) {
  const router = useRouter();
  return (
    <button
      onClick={() => { router.push(action.href); onClose(); }}
      className="mt-1.5 flex items-center gap-1 text-xs font-bold underline-offset-2 hover:underline"
      style={{ color: 'var(--color-primary)' }}
    >
      {action.label}
      <ArrowRight className="h-3 w-3" />
    </button>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
    const id = ++idCounter.current;
    setToasts(prev => [...prev, { id, message, type, action }]);
    const duration = action ? 8000 : 4000;
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.type];
            const c = colors[t.type];
            return (
              <motion.div
                key={t.id}
                role="alert"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg"
                style={{
                  background: 'var(--color-surface)',
                  border: `1px solid ${c.border}`,
                  borderLeft: `4px solid ${c.border}`,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                }}
              >
                <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: c.icon }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{t.message}</p>
                  {t.action && <ToastActionButton action={t.action} onClose={() => removeToast(t.id)} />}
                </div>
                <button onClick={() => removeToast(t.id)} className="shrink-0 rounded p-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
