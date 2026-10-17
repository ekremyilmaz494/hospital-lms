'use client';

/**
 * İşlem Geçmişim — KVKK şeffaflık gereği, kendi veri değişimlerini görme.
 * Clinical Editorial dil: cream + ink + mono caps timeline.
 */

import { useState } from 'react';
import { History, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import Link from 'next/link';
import { useFetch } from '@/hooks/use-fetch';
import {
  INK, INK_SOFT, CREAM, RULE, CARD_BG,
  FONT_DISPLAY, FONT_MONO, TONE_TOKENS,
} from '@/lib/editorial-palette';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
}

interface AuditResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const ACTION_TR: Record<string, string> = {
  'user.login':             'Oturum açıldı',
  'user.logout':            'Oturum kapatıldı',
  'user.profile_updated':   'Profil güncellendi',
  'user.password_changed':  'Şifre değiştirildi',
  'user.avatar_updated':    'Avatar güncellendi',
  'kvkk_request.created':   'KVKK talebi oluşturuldu',
  'certificate.downloaded': 'Sertifika indirildi',
  'exam.started':           'Sınav başlatıldı',
  'exam.submitted':         'Sınav tamamlandı',
};

function labelAction(action: string): string {
  return ACTION_TR[action] ?? action;
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function ProfileActivityPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useFetch<AuditResponse>(
    `/api/staff/audit-logs/me?page=${page}&limit=20`,
  );

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-3xl mx-auto" style={{ background: CREAM }}>
      <header className="mb-6">
        <Link
          href="/staff/profile"
          className="inline-flex items-center gap-1 text-[13px] mb-4"
          style={{ color: INK_SOFT }}
        >
          <ChevronLeft className="h-4 w-4" />
          Profilime dön
        </Link>
        <p className="text-[11px] tracking-[0.18em] mb-2" style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
          HESABIM
        </p>
        <h1
          className="text-[28px] font-bold leading-tight"
          style={{ color: INK, fontFamily: FONT_DISPLAY }}
        >
          İşlem Geçmişim
        </h1>
        <p className="text-[13px] mt-2" style={{ color: INK_SOFT }}>
          Hesabınızda gerçekleşen işlemlerin kaydı — KVKK kapsamında şeffaflık için.
        </p>
      </header>

      <div
        className="rounded-2xl p-4 mb-6 flex items-start gap-3"
        style={{ background: TONE_TOKENS.info.bg, border: `1px solid ${TONE_TOKENS.info.border}`, color: TONE_TOKENS.info.ink }}
      >
        <Info className="h-5 w-5 shrink-0 mt-[1px]" />
        <p className="text-[13px]">
          Bu liste yalnızca kendi hesabınızdaki işlemleri gösterir. Detaylı veri erişim talebinde bulunmak için
          {' '}<Link href="/staff/kvkk" className="underline">KVKK hak talebi</Link>{' '}oluşturabilirsiniz.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-2xl p-8 text-center text-[14px]"
          style={{ background: CARD_BG, border: `1px solid ${RULE}`, color: INK_SOFT }}>
          Yükleniyor…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-2xl p-6" style={{ background: TONE_TOKENS.danger.bg, border: `1px solid ${TONE_TOKENS.danger.border}`, color: TONE_TOKENS.danger.ink }}>
          <p className="text-[13px] font-semibold">İşlem geçmişi alınamadı</p>
          <p className="text-[13px] mt-1">Lütfen sayfayı yenileyin.</p>
        </div>
      )}

      {!isLoading && !error && logs.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={{ background: CARD_BG, border: `1px solid ${RULE}` }}>
          <History className="h-10 w-10 mx-auto mb-3" style={{ color: INK_SOFT }} />
          <p className="text-[14px]" style={{ color: INK_SOFT }}>Henüz kayıtlı işlem yok.</p>
        </div>
      )}

      {!isLoading && !error && logs.length > 0 && (
        <>
          <ul className="flex flex-col gap-2 mb-6">
            {logs.map(log => {
              const { date, time } = formatDateTime(log.createdAt);
              return (
                <li
                  key={log.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-4"
                  style={{ background: CARD_BG, border: `1px solid ${RULE}` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate" style={{ color: INK }}>
                      {labelAction(log.action)}
                    </p>
                    <p className="text-[11px] mt-[2px] tracking-[0.06em]" style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
                      {date} · {time}{log.ipAddress ? ` · ${log.ipAddress}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] disabled:opacity-40"
                style={{ background: CARD_BG, border: `1px solid ${RULE}`, color: INK }}
              >
                <ChevronLeft className="h-4 w-4" /> Önceki
              </button>
              <p className="text-[13px]" style={{ color: INK_SOFT, fontFamily: FONT_MONO }}>
                {page} / {totalPages}
              </p>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] disabled:opacity-40"
                style={{ background: CARD_BG, border: `1px solid ${RULE}`, color: INK }}
              >
                Sonraki <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
