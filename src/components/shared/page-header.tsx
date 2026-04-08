'use client';

import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    href?: string;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
  };
}

export function PageHeader({ title, subtitle, badge, action, secondaryAction }: PageHeaderProps) {
  return (
    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {badge && (
          <BlurFade delay={0}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--color-primary)' }}
              />
              {badge}
            </span>
          </BlurFade>
        )}
        <BlurFade delay={0.05}>
          <h2 className="text-balance">{title}</h2>
        </BlurFade>
        {subtitle && (
          <BlurFade delay={0.1}>
            <p
              className="max-w-lg text-[0.9rem] leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {subtitle}
            </p>
          </BlurFade>
        )}
      </div>
      {(action || secondaryAction) && (
        <BlurFade delay={0.15}>
          <div className="mt-4 flex items-center gap-3 sm:mt-0">
            {secondaryAction && (
              <Button
                variant="outline"
                onClick={secondaryAction.onClick}
                className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
                {secondaryAction.label}
              </Button>
            )}
            {action && (
              action.href ? (
                <Link
                  href={action.href}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                    boxShadow: '0 4px 14px rgba(var(--color-primary-rgb), 0.3)',
                  }}
                >
                  {action.icon && <action.icon className="h-4 w-4" />}
                  {action.label}
                </Link>
              ) : (
                <button
                  onClick={action.onClick}
                  disabled={action.loading}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                    boxShadow: '0 4px 14px rgba(var(--color-primary-rgb), 0.3)',
                  }}
                >
                  {action.icon && <action.icon className={`h-4 w-4${action.loading ? ' animate-spin' : ''}`} />}
                  {action.label}
                </button>
              )
            )}
          </div>
        </BlurFade>
      )}
    </div>
  );
}
