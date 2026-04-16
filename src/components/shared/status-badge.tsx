'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

/**
 * Sistem durum rozeti — Betterstack veya Instatus status sayfasından çeker.
 *
 * Kurulum:
 *   - Betterstack: https://betterstack.com/status — ücretsiz plan mevcut
 *   - Instatus: https://instatus.com — ücretsiz plan mevcut
 *
 * .env.local veya Vercel environment variables:
 *   NEXT_PUBLIC_STATUS_PAGE_URL=https://status.hastaneniz.com
 *   NEXT_PUBLIC_STATUS_API_URL=https://hastaneniz.betteruptime.com/api/v2/status-pages/YOUR_ID/status
 *
 * API_URL yoksa statik "Tüm sistemler çalışıyor" gösterilir.
 */

type StatusLevel = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'unknown';

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  Icon: typeof CheckCircle2;
}

const STATUS_MAP: Record<StatusLevel, StatusConfig> = {
  operational:     { label: 'Tüm sistemler çalışıyor', color: 'var(--brand-500)', bg: 'rgba(16,185,129,0.08)',  Icon: CheckCircle2 },
  degraded:        { label: 'Performans sorunu',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  Icon: AlertTriangle },
  partial_outage:  { label: 'Kısmi kesinti',            color: '#f97316', bg: 'rgba(249,115,22,0.08)',  Icon: AlertTriangle },
  major_outage:    { label: 'Sistem kesintisi',         color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   Icon: XCircle },
  unknown:         { label: 'Durum bilinmiyor',         color: '#64748b', bg: 'rgba(100,116,139,0.08)', Icon: AlertTriangle },
};

function resolveStatus(apiResponse: unknown): StatusLevel {
  if (!apiResponse || typeof apiResponse !== 'object') return 'unknown';
  const r = apiResponse as Record<string, unknown>;

  // Betterstack format: { data: { attributes: { aggregate_state: "operational" } } }
  const betterstack = r?.data as Record<string, unknown> | undefined;
  if (betterstack?.attributes) {
    const attrs = betterstack.attributes as Record<string, unknown>;
    const state = String(attrs.aggregate_state ?? '');
    if (state in STATUS_MAP) return state as StatusLevel;
  }

  // Instatus format: { page: { status: "UP" } }
  const page = r?.page as Record<string, unknown> | undefined;
  if (page?.status) {
    const s = String(page.status).toLowerCase();
    if (s === 'up' || s === 'operational') return 'operational';
    if (s === 'hasissues' || s === 'has_issues') return 'partial_outage';
    if (s === 'undermaintenance' || s === 'under_maintenance') return 'degraded';
  }

  return 'unknown';
}

export function StatusBadge({ className }: { className?: string }) {
  const [status, setStatus] = useState<StatusLevel>('operational');
  const statusPageUrl = process.env.NEXT_PUBLIC_STATUS_PAGE_URL;
  const apiUrl = process.env.NEXT_PUBLIC_STATUS_API_URL;

  useEffect(() => {
    if (!apiUrl) return;

    const controller = new AbortController();
    fetch(apiUrl, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setStatus(resolveStatus(data)))
      .catch(() => {/* ağ hatası — varsayılanı koru */});

    return () => controller.abort();
  }, [apiUrl]);

  const cfg = STATUS_MAP[status];
  const Icon = cfg.Icon;

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${className ?? ''}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );

  if (statusPageUrl) {
    return (
      <a
        href={statusPageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
      >
        {badge}
      </a>
    );
  }

  return badge;
}
