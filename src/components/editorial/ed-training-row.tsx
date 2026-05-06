/**
 * Editorial eğitim satırı — 4px sol-accent bar + başlık + bölüm/dk + progress + deadline pill.
 * Hover (CSS-only): translateY(-1px) + 0 2px 0 0 ink box-shadow.
 *
 * Bu component **görsel sunum**dan sorumlu. Eğitim akışı state machine'i
 * (`calculateTrainingProgress`, examId fallback) çağıran tarafta kalır —
 * burada sadece props ile gelen değerler render edilir.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CARD_BG, FONT_DISPLAY, FONT_MONO, GOLD, INK, INK_SOFT, RULE, STATUS_TOKENS } from '@/lib/editorial-palette';

export type EdTrainingRowStatus = 'urgent' | 'progress' | 'assigned' | 'completed' | 'failed';

const ROW_STATUS_TOKENS: Record<EdTrainingRowStatus, { accent: string; bg: string; ink: string; label: string }> = {
  urgent:    { accent: '#b3261e', bg: '#fdf5f2', ink: '#7a1e18', label: 'Acil' },
  progress:  { accent: STATUS_TOKENS.in_progress.dot, bg: STATUS_TOKENS.in_progress.bg, ink: STATUS_TOKENS.in_progress.ink, label: 'Devam' },
  assigned:  { accent: STATUS_TOKENS.assigned.dot,    bg: STATUS_TOKENS.assigned.bg,    ink: STATUS_TOKENS.assigned.ink,    label: 'Atandı' },
  completed: { accent: STATUS_TOKENS.completed.dot,   bg: STATUS_TOKENS.completed.bg,   ink: STATUS_TOKENS.completed.ink,   label: 'Tamam' },
  failed:    { accent: STATUS_TOKENS.failed.dot,      bg: STATUS_TOKENS.failed.bg,      ink: STATUS_TOKENS.failed.ink,      label: 'Başarısız' },
};

interface EdTrainingRowProps {
  status: EdTrainingRowStatus;
  title: string;
  href?: string;
  /** Bölüm sayısı (videolu eğitim için). */
  chapters?: number;
  /** Toplam dk. */
  duration?: number;
  /** 0–100 ilerleme; null/undefined = "Başlanmadı". */
  percent?: number | null;
  /** "Son N gün" / "Atandı" / "Tamam" / "Süresi doldu" gibi metin. */
  deadline?: string;
  /** Pill yerine custom label (override). */
  deadlineLabel?: string;
}

export function EdTrainingRow({
  status,
  title,
  href,
  chapters,
  duration,
  percent,
  deadline,
  deadlineLabel,
}: EdTrainingRowProps) {
  const t = ROW_STATUS_TOKENS[status];
  const showProgress = percent != null;

  const inner = (
    <div
      className="ed-training-row group relative grid items-center gap-[18px]"
      style={{
        gridTemplateColumns: '1fr 160px 110px',
        background: CARD_BG,
        border: `1px solid ${RULE}`,
        borderLeftWidth: 4,
        borderLeftColor: t.accent,
        borderRadius: 4,
        padding: '14px 18px',
        transition: 'box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="min-w-0">
        <div
          className="truncate"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 15,
            fontWeight: 600,
            color: INK,
            marginBottom: 6,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        {(chapters != null || duration != null) && (
          <div
            className="flex items-center gap-2.5"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: INK_SOFT,
            }}
          >
            {chapters != null && <span>{chapters} BÖLÜM</span>}
            {chapters != null && duration != null && <span aria-hidden>·</span>}
            {duration != null && <span>{duration} DK</span>}
          </div>
        )}
      </div>

      <div
        className="flex flex-col gap-1.5"
        style={{ fontFamily: FONT_MONO, fontSize: 11, color: INK_SOFT, letterSpacing: '0.05em' }}
      >
        <span>{showProgress ? `%${percent}` : 'Başlanmadı'}</span>
        <div
          className="h-[4px] overflow-hidden"
          style={{ background: RULE, borderRadius: 2 }}
        >
          {showProgress && (
            <div
              style={{
                height: 4,
                width: `${percent}%`,
                background: t.accent,
                borderRadius: 2,
                transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {(deadline || deadlineLabel) && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              padding: '5px 10px',
              borderRadius: 2,
              fontWeight: 600,
              textAlign: 'center',
              background: t.bg,
              color: t.ink,
            }}
          >
            {deadlineLabel ?? deadline}
          </span>
        )}
        {href && (
          <ArrowRight
            className="h-3.5 w-3.5 ed-training-row__arrow"
            style={{
              color: GOLD,
              transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        )}
      </div>

      <style>{`
        .ed-training-row:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 0 0 ${INK};
        }
        .ed-training-row:hover .ed-training-row__arrow {
          transform: translateX(2px);
        }
      `}</style>
    </div>
  );

  if (!href) return inner;
  return (
    <Link
      href={href}
      className="block focus:outline-none"
      style={{ borderRadius: 4 }}
    >
      {inner}
    </Link>
  );
}
