'use client';

/**
 * Değerlendirmeler — "Clinical Editorial" redesign.
 * Staff paneli 360° yetkinlik listesi. Functionality korundu, sadece görsel
 * tabaka editorial dile taşındı (cream + ink + gold + serif display + mono caps).
 */

import { Clock, CheckCircle, ArrowRight, Award } from 'lucide-react';
import Link from 'next/link';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import {
  INK, INK_SOFT, CREAM, GOLD, RULE, OLIVE, CARD_BG,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, TONE_TOKENS,
} from '@/lib/editorial-palette';

interface PendingEval {
  id: string;
  evaluatorType: string;
  createdAt: string;
  form: { id: string; title: string; periodEnd: string };
  subject: { firstName: string; lastName: string; departmentRel: { name: string } | null };
}

interface SubjectEval {
  id: string;
  status: string;
  form: { id: string; title: string; periodEnd: string };
  _count: { answers: number };
}

interface EvalData {
  pending: PendingEval[];
  mySubjectEvals: SubjectEval[];
}

const EVALUATOR_LABELS: Record<string, string> = {
  SELF: 'Öz Değerlendirme', MANAGER: 'Yönetici', PEER: 'Akran', SUBORDINATE: 'Ast',
};

export default function StaffEvaluationsPage() {
  const { data, isLoading } = useFetch<EvalData>('/api/staff/evaluations');
  if (isLoading && !data) return <PageLoading />;

  const pending = data?.pending ?? [];
  const mySubjectEvals = data?.mySubjectEvals ?? [];

  return (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{ backgroundColor: CREAM, color: INK, fontFamily: FONT_BODY }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16">
        {/* ───── Masthead ───── */}
        <BlurFade delay={0}>
          <header
            className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b pb-5"
            style={{ borderColor: INK }}
          >
            <div className="flex items-end gap-4">
              <h1
                className="text-[36px] sm:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                360° <span style={{ fontStyle: 'italic', color: OLIVE }}>yetkinlik</span>
                <span style={{ color: GOLD }}>.</span>
              </h1>
            </div>
          </header>
          <p
            className="mt-3 text-[12px] uppercase tracking-[0.16em]"
            style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
          >
            Değerlendirme görevleriniz ve hakkınızdaki sonuçlar
          </p>
        </BlurFade>

        {/* ───── Bekleyen Değerlendirmeler ───── */}
        <BlurFade delay={0.05}>
          <section
            className="mt-8"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}` }}
          >
            <div
              className="flex items-center gap-2 px-5 py-4 border-b"
              style={{ borderColor: RULE }}
            >
              <Clock className="h-4 w-4" style={{ color: TONE_TOKENS.warning.border }} />
              <h2
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: INK, fontFamily: FONT_MONO }}
              >
                Bekleyen Değerlendirmelerim
              </h2>
              {pending.length > 0 && (
                <span
                  className="ml-auto text-[10px] font-semibold px-2 py-0.5"
                  style={{
                    backgroundColor: TONE_TOKENS.warning.bg,
                    color: TONE_TOKENS.warning.ink,
                    border: `1px solid ${TONE_TOKENS.warning.border}`,
                    fontFamily: FONT_MONO,
                  }}
                >
                  {String(pending.length).padStart(2, '0')}
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <div
                className="py-10 text-center text-[12px] uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
              >
                Bekleyen değerlendirme yok.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: RULE }}>
                {pending.map((ev, i) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between px-5 py-4 gap-4"
                    style={{ borderColor: RULE }}
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <span
                        className="text-[11px] font-semibold mt-0.5 tabular-nums"
                        style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-[15px] font-semibold"
                          style={{ color: INK, fontFamily: FONT_DISPLAY }}
                        >
                          {ev.subject.firstName} {ev.subject.lastName}
                          <span
                            className="ml-2 text-[10px] font-semibold uppercase tracking-[0.16em] px-1.5 py-0.5"
                            style={{
                              color: INK_SOFT,
                              border: `1px solid ${RULE}`,
                              fontFamily: FONT_MONO,
                            }}
                          >
                            {EVALUATOR_LABELS[ev.evaluatorType] ?? ev.evaluatorType}
                          </span>
                        </p>
                        <p
                          className="text-[12px] mt-1 truncate"
                          style={{ color: INK_SOFT }}
                        >
                          {ev.form.title}
                          <span
                            className="ml-2"
                            style={{ fontFamily: FONT_MONO }}
                          >
                            · Son: {new Date(ev.form.periodEnd).toLocaleDateString('tr-TR')}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/staff/evaluations/${ev.id}`}
                      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] px-4 py-2 flex-shrink-0"
                      style={{
                        backgroundColor: OLIVE,
                        color: CREAM,
                        fontFamily: FONT_MONO,
                      }}
                    >
                      Başla <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </BlurFade>

        {/* ───── Hakkımdaki Değerlendirmeler ───── */}
        <BlurFade delay={0.1}>
          <section
            className="mt-6"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}` }}
          >
            <div
              className="flex items-center gap-2 px-5 py-4 border-b"
              style={{ borderColor: RULE }}
            >
              <Award className="h-4 w-4" style={{ color: GOLD }} />
              <h2
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: INK, fontFamily: FONT_MONO }}
              >
                Hakkımdaki Değerlendirmeler
              </h2>
            </div>
            {mySubjectEvals.length === 0 ? (
              <div
                className="py-10 text-center text-[12px] uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
              >
                Henüz hakkınızda bir değerlendirme başlatılmadı.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: RULE }}>
                {mySubjectEvals.map((ev, i) => {
                  const isDone = ev.status === 'COMPLETED';
                  const tone = isDone ? TONE_TOKENS.success : TONE_TOKENS.warning;
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between px-5 py-4 gap-4"
                      style={{ borderColor: RULE }}
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <span
                          className="text-[11px] font-semibold mt-0.5 tabular-nums"
                          style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="text-[15px] font-semibold"
                            style={{ color: INK, fontFamily: FONT_DISPLAY }}
                          >
                            {ev.form.title}
                          </p>
                          <p
                            className="text-[12px] mt-1"
                            style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                          >
                            Son: {new Date(ev.form.periodEnd).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2 py-1 flex-shrink-0"
                        style={{
                          backgroundColor: tone.bg,
                          color: tone.ink,
                          border: `1px solid ${tone.border}`,
                          fontFamily: FONT_MONO,
                        }}
                      >
                        {isDone ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {isDone ? 'Tamamlandı' : 'Devam Ediyor'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </BlurFade>
      </div>
    </div>
  );
}
