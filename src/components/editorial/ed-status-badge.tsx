/**
 * Status rozeti — STATUS_TOKENS sözlüğüne bağlanır.
 * Dot + bg + ink üçlüsü; label çağıran tarafından geçilir
 * (TR sayfada "DEVAM EDİYOR", başka yerde "DEVAM" olabilir).
 */
import { FONT_MONO, STATUS_TOKENS } from '@/lib/editorial-palette';

type Status = keyof typeof STATUS_TOKENS;

interface EdStatusBadgeProps {
  status: Status;
  label: string;
  /** Daha az yer kaplaması gereken yerlerde dot'u gizle. */
  hideDot?: boolean;
}

export function EdStatusBadge({ status, label, hideDot = false }: EdStatusBadgeProps) {
  const t = STATUS_TOKENS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 leading-none"
      style={{
        color: t.ink,
        backgroundColor: t.bg,
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {!hideDot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: t.dot }}
        />
      )}
      {label}
    </span>
  );
}
