'use client';

/**
 * PremiumModal — Editorial Clinical tasarım yönü
 *
 * Kullanım:
 *   <PremiumModal
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     eyebrow="Toplu İşlem"
 *     title="Eğitim Atama"
 *     subtitle="Birden fazla personele aynı anda eğitim tanımlayın"
 *     steps={[{ id: 'trainings', label: 'Eğitimler', caption: 'Ne atanacak?' }, ...]}
 *     activeStep="trainings"
 *     onStepChange={(id) => ...}
 *     footer={<PremiumModalFooter ... />}
 *   >
 *     {stepContent}
 *   </PremiumModal>
 *
 * Tasarım prensipleri:
 * - Fraunces (serif) display + Plus Jakarta body = editorial + modern denge
 * - Warm off-white surface (#fafaf7) — pure white yerine kağıt hissi
 * - Inset ring + layered shadow — flat card yerine katmanlı derinlik
 * - Sol step rail (desktop ≥768px), mobilde üstte horizontal
 * - Spring-eased entry, reduced-motion uyumlu
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface PremiumModalStep {
  id: string;
  label: string;
  caption?: string;
  complete?: boolean;
}

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  steps?: PremiumModalStep[];
  activeStep?: string;
  onStepChange?: (stepId: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Modal genişlik preset'i */
  size?: 'md' | 'lg' | 'xl';
  /** ESC ile kapama engellenirse (örn. loading durumunda) */
  disableEscape?: boolean;
}

const SIZE_MAP = {
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

export function PremiumModal({
  isOpen,
  onClose,
  eyebrow,
  title,
  subtitle,
  steps,
  activeStep,
  onStepChange,
  children,
  footer,
  size = 'lg',
  disableEscape = false,
}: PremiumModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscape) onClose();
    };
    document.addEventListener('keydown', onKey);

    // Focus ilk focusable elementi
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, disableEscape]);

  if (!isOpen || typeof window === 'undefined') return null;

  const hasSteps = steps && steps.length > 0;

  return createPortal(
    <div
      className="pm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-title"
      onMouseDown={(e) => {
        // Dışarı tıklama → kapat (sadece backdrop'ta)
        if (e.target === e.currentTarget && !disableEscape) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`pm-dialog ${SIZE_MAP[size]}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Kapatma — köşede minimal, tasarımı bozmasın */}
        <button
          type="button"
          onClick={onClose}
          className="pm-close"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className={`pm-body ${hasSteps ? 'pm-body-with-rail' : ''}`}>
          {hasSteps && (
            <aside className="pm-rail" aria-label="Adımlar">
              {eyebrow && <span className="pm-eyebrow">{eyebrow}</span>}
              <h2 id="pm-title" className="pm-title">{title}</h2>
              {subtitle && <p className="pm-subtitle">{subtitle}</p>}

              <ol className="pm-steps">
                {steps.map((s, i) => {
                  const isActive = s.id === activeStep;
                  const isDone = !!s.complete && !isActive;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onStepChange?.(s.id)}
                        disabled={!onStepChange}
                        className={`pm-step ${isActive ? 'pm-step-active' : ''} ${isDone ? 'pm-step-done' : ''}`}
                        aria-current={isActive ? 'step' : undefined}
                      >
                        <span className="pm-step-index">
                          {isDone ? (
                            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                              <path
                                d="M2.5 6.5l2.5 2.5 5-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            String(i + 1).padStart(2, '0')
                          )}
                        </span>
                        <span className="pm-step-text">
                          <span className="pm-step-label">{s.label}</span>
                          {s.caption && <span className="pm-step-caption">{s.caption}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>
          )}

          <div className="pm-main">
            {!hasSteps && (
              <header className="pm-header">
                {eyebrow && <span className="pm-eyebrow">{eyebrow}</span>}
                <h2 id="pm-title" className="pm-title">{title}</h2>
                {subtitle && <p className="pm-subtitle">{subtitle}</p>}
              </header>
            )}
            <div className="pm-content">{children}</div>
          </div>
        </div>

        {footer && <footer className="pm-footer">{footer}</footer>}
      </div>

      <style jsx>{`
        .pm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          /* Katmanlı backdrop: warm tint + blur + vignette */
          background:
            radial-gradient(ellipse at center, rgba(30, 41, 59, 0.35) 0%, rgba(15, 23, 42, 0.62) 100%);
          backdrop-filter: blur(10px) saturate(120%);
          -webkit-backdrop-filter: blur(10px) saturate(120%);
          animation: pm-backdrop-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pm-dialog {
          position: relative;
          width: 100%;
          max-height: calc(100vh - 2.5rem);
          display: flex;
          flex-direction: column;
          background: #fafaf7; /* warm paper */
          border-radius: 20px;
          /* Inset ring + layered shadow: düz kart yerine katmanlı derinlik */
          box-shadow:
            0 0 0 1px rgba(15, 23, 42, 0.04),
            0 1px 0 0 rgba(255, 255, 255, 0.9) inset,
            0 18px 48px -12px rgba(15, 23, 42, 0.18),
            0 40px 96px -24px rgba(15, 23, 42, 0.22);
          overflow: hidden;
          animation: pm-dialog-in 340ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pm-close {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.04);
          color: #6b6a63;
          border: none;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pm-close:hover {
          background: rgba(15, 23, 42, 0.08);
          color: #0a0a0a;
        }
        .pm-close:active {
          transform: scale(0.94);
        }
        .pm-close:focus-visible {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }

        .pm-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .pm-body-with-rail {
          flex-direction: column;
        }

        @media (min-width: 768px) {
          .pm-body-with-rail {
            flex-direction: row;
          }
        }

        .pm-rail {
          flex-shrink: 0;
          padding: 28px 28px 20px;
          border-bottom: 1px solid #ebe7df;
        }

        @media (min-width: 768px) {
          .pm-rail {
            width: 280px;
            padding: 36px 28px 28px;
            border-bottom: none;
            border-right: 1px solid #ebe7df;
            /* Rail'e ince warm texture */
            background: linear-gradient(180deg, #faf8f2 0%, #fafaf7 100%);
          }
        }

        .pm-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 10px;
        }
        .pm-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px;
          height: 1px;
          background: #c9c4b4;
          vertical-align: middle;
          margin-right: 10px;
          margin-bottom: 2px;
        }

        .pm-title {
          font-family: var(--font-editorial, Georgia, serif);
          font-size: 28px;
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: #0a0a0a;
          margin: 0 0 8px;
          /* Fraunces optical sizing: büyük display */
          font-variation-settings: 'opsz' 48, 'SOFT' 50;
        }

        @media (min-width: 768px) {
          .pm-title {
            font-size: 32px;
          }
        }

        .pm-subtitle {
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          line-height: 1.55;
          color: #6b6a63;
          margin: 0 0 24px;
        }

        .pm-steps {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: row;
          gap: 8px;
          overflow-x: auto;
        }

        @media (min-width: 768px) {
          .pm-steps {
            flex-direction: column;
            gap: 4px;
            overflow: visible;
          }
        }

        .pm-step {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 10px;
          text-align: left;
          cursor: pointer;
          transition: background 180ms ease, color 180ms ease;
          color: #8a8578;
          white-space: nowrap;
        }
        .pm-step:hover:not(:disabled) {
          background: rgba(15, 23, 42, 0.03);
        }
        .pm-step:disabled {
          cursor: default;
        }
        .pm-step-active {
          background: rgba(13, 150, 104, 0.06);
          color: #0a0a0a;
        }
        .pm-step-done {
          color: #0a0a0a;
        }

        .pm-step-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          margin-top: 1px;
          border-radius: 50%;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          background: rgba(15, 23, 42, 0.05);
          color: inherit;
          transition: background 180ms ease, color 180ms ease;
        }
        .pm-step-active .pm-step-index {
          background: var(--color-primary);
          color: #ffffff;
        }
        .pm-step-done .pm-step-index {
          background: rgba(13, 150, 104, 0.15);
          color: var(--color-primary);
        }

        .pm-step-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .pm-step-label {
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.005em;
        }
        .pm-step-caption {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 400;
          color: #8a8578;
          margin-top: 2px;
          display: none;
        }
        @media (min-width: 768px) {
          .pm-step-caption {
            display: block;
          }
        }

        .pm-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .pm-header {
          padding: 36px 36px 20px;
          border-bottom: 1px solid #ebe7df;
        }

        .pm-content {
          flex: 1;
          overflow-y: auto;
          padding: 28px 36px;
          scroll-behavior: smooth;
        }
        /* Custom scrollbar: warm, ince */
        .pm-content::-webkit-scrollbar {
          width: 10px;
        }
        .pm-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .pm-content::-webkit-scrollbar-thumb {
          background: #e0dcd0;
          border-radius: 10px;
          border: 3px solid #fafaf7;
        }
        .pm-content::-webkit-scrollbar-thumb:hover {
          background: #c9c4b4;
        }

        .pm-footer {
          flex-shrink: 0;
          padding: 18px 28px;
          border-top: 1px solid #ebe7df;
          background: linear-gradient(180deg, #fafaf7 0%, #f5f2e9 100%);
        }

        @keyframes pm-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pm-dialog-in {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .pm-backdrop,
          .pm-dialog {
            animation: none;
          }
          .pm-close,
          .pm-step,
          .pm-step-index {
            transition: none;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

/**
 * Footer helper — premium modallar için tutarlı aksiyon bar
 */
interface PremiumModalFooterProps {
  /** Sol tarafta özet bilgisi (tabular-nums otomatik) */
  summary?: ReactNode;
  /** Sağ tarafta aksiyon butonları */
  actions: ReactNode;
}

export function PremiumModalFooter({ summary, actions }: PremiumModalFooterProps) {
  return (
    <div className="pmf-root">
      {summary && <div className="pmf-summary">{summary}</div>}
      <div className="pmf-actions">{actions}</div>
      <style jsx>{`
        .pmf-root {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .pmf-summary {
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
        }
        .pmf-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}

/**
 * Primary button — editorial aksan, spring press
 */
interface PremiumButtonProps {
  variant?: 'primary' | 'ghost' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: ReactNode;
  icon?: ReactNode;
}

export function PremiumButton({
  variant = 'primary',
  disabled,
  loading,
  onClick,
  type = 'button',
  children,
  icon,
}: PremiumButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`pb-btn pb-${variant}`}
    >
      {loading && (
        <svg className="pb-spinner" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <path d="M14 8a6 6 0 00-6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {!loading && icon}
      <span>{children}</span>
      <style jsx>{`
        .pb-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.005em;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pb-btn:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .pb-btn:active:not(:disabled) {
          transform: scale(0.96);
        }
        .pb-btn:focus-visible {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }

        .pb-primary {
          background: #0a0a0a;
          color: #fafaf7;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .pb-primary:hover:not(:disabled) {
          background: #1a1a1a;
        }

        .pb-ghost {
          background: transparent;
          color: #6b6a63;
        }
        .pb-ghost:hover:not(:disabled) {
          background: rgba(15, 23, 42, 0.05);
          color: #0a0a0a;
        }

        .pb-outline {
          background: transparent;
          color: #0a0a0a;
          border-color: #d9d4c4;
        }
        .pb-outline:hover:not(:disabled) {
          background: rgba(15, 23, 42, 0.03);
          border-color: #b8b1a0;
        }

        .pb-spinner {
          width: 14px;
          height: 14px;
          animation: pb-spin 700ms linear infinite;
        }
        @keyframes pb-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
