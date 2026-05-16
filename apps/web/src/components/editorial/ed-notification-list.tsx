/**
 * Editorial bildirim listesi — unread satıra olive 2.5% tint.
 * Server component; hover background CSS-only.
 */
import type { ReactNode } from 'react';
import { CARD_BG, FONT_BODY, FONT_MONO, GOLD, INK, INK_SOFT, RULE } from '@/lib/editorial-palette';

export interface EdNotificationItemData {
  /** Üst kicker — "ACİL — SON 1 GÜN", "SERTİFİKA", "TAKVİM" gibi. */
  kicker?: string;
  title: string;
  time?: string;
  unread?: boolean;
  /** Lucide ikon — Bell, AlertTriangle, Award, Calendar... */
  icon?: ReactNode;
}

interface EdNotificationListProps {
  items: EdNotificationItemData[];
  /** Maksimum gösterilecek bildirim sayısı; 0 = sınırsız. */
  limit?: number;
  /** Boş durumda gösterilecek node. */
  empty?: ReactNode;
}

export function EdNotificationList({ items, limit = 0, empty }: EdNotificationListProps) {
  const list = limit > 0 ? items.slice(0, limit) : items;
  if (list.length === 0 && empty) return <>{empty}</>;
  if (list.length === 0) return null;

  return (
    <ul
      className="ed-notif-list"
      style={{
        background: CARD_BG,
        border: `1px solid ${RULE}`,
        borderRadius: 4,
        overflow: 'hidden',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {list.map((n, i) => (
        <li key={i}>
          <div
            className="ed-notif-row grid items-center gap-3.5 px-4 py-3.5"
            style={{
              gridTemplateColumns: '36px 1fr max-content',
              background: n.unread ? 'rgba(26, 58, 40, 0.025)' : 'transparent',
              borderTop: i === 0 ? 'none' : `1px solid ${RULE}`,
              transition: 'background-color 180ms ease',
              cursor: 'pointer',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: 'var(--ed-cream, #f4ead5)',
                color: 'var(--ed-olive, #1a3a28)',
              }}
            >
              {n.icon}
            </div>
            <div className="min-w-0">
              {n.kicker && (
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    color: n.unread ? GOLD : INK_SOFT,
                    marginBottom: 4,
                  }}
                >
                  {n.kicker}
                </div>
              )}
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13.5,
                  color: INK,
                  fontWeight: n.unread ? 500 : 400,
                  lineHeight: 1.4,
                }}
              >
                {n.title}
              </div>
            </div>
            {n.time && (
              <div
                className="flex items-center gap-2 whitespace-nowrap"
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  color: INK_SOFT,
                  letterSpacing: '0.05em',
                }}
              >
                {n.unread && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: GOLD }}
                  />
                )}
                {n.time}
              </div>
            )}
          </div>
        </li>
      ))}
      <style>{`
        .ed-notif-list .ed-notif-row:hover {
          background-color: var(--ed-cream, #f4ead5) !important;
        }
      `}</style>
    </ul>
  );
}
