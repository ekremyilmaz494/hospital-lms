'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, TrendingUp, Briefcase, Edit, Mail, Phone, Building2, RotateCcw, Plus } from 'lucide-react';
import { AssignTrainingModal } from '../assign-training-modal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

// ── Klinova palette ──
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface StaffDetail {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string;
  phone: string;
  initials: string;
  stats: { assignedTrainings: number; completedTrainings: number; successRate: string; avgScore: string };
  trainingHistory: { trainingId: string; title: string; attempt: number; maxAttempts: number; preScore: number | null; postScore: number | null; status: string; date: string }[];
}

const statusMap: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  passed:      { label: 'Başarılı',     bg: K.PRIMARY_LIGHT, text: K.PRIMARY,    dot: K.PRIMARY },
  failed:      { label: 'Başarısız',    bg: K.ERROR_BG,      text: '#b91c1c',    dot: K.ERROR },
  in_progress: { label: 'Devam Ediyor', bg: K.WARNING_BG,    text: '#b45309',    dot: K.WARNING },
  assigned:    { label: 'Atandı',       bg: K.INFO_BG,       text: '#1e40af',    dot: K.INFO },
  locked:      { label: 'Kilitli',      bg: K.ERROR_BG,      text: '#b91c1c',    dot: K.ERROR },
};

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { toast } = useToast();
  const { data: staff, isLoading, error, refetch } = useFetch<StaffDetail>(id ? `/api/admin/staff/${id}` : null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [grantTarget, setGrantTarget] = useState<{ trainingId: string; title: string } | null>(null);
  const [grantCount, setGrantCount] = useState(1);
  const [granting, setGranting] = useState(false);

  const handleGrant = async () => {
    if (!grantTarget || !id) return;
    setGranting(true);
    try {
      const res = await fetch(`/api/admin/trainings/${grantTarget.trainingId}/assignments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, additionalAttempts: grantCount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'İşlem başarısız');
      }
      toast(`${grantCount} ek deneme hakkı verildi`, 'success');
      setGrantTarget(null);
      setGrantCount(1);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setGranting(false);
    }
  };

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: K.TEXT_MUTED }}>
        <p style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, color: K.ERROR }}>{error}</p>
      </div>
    );
  }

  if (!staff || !id) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: K.TEXT_MUTED }}>
        <p style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18 }}>Personel bulunamadı.</p>
      </div>
    );
  }

  const profileInfo = [
    { icon: Mail,      label: 'E-posta',   value: staff.email,      mono: false },
    { icon: Phone,     label: 'Telefon',   value: staff.phone,      mono: true  },
    { icon: Building2, label: 'Departman', value: staff.department, mono: false },
    { icon: Briefcase, label: 'Unvan',     value: staff.title,      mono: false },
  ];

  const trainingHistory = staff.trainingHistory ?? [];

  const cardStyle: React.CSSProperties = {
    padding: 24,
    background: K.SURFACE,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 14,
    boxShadow: K.SHADOW_CARD,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: K.FONT_DISPLAY,
    fontSize: 18,
    fontWeight: 700,
    color: K.TEXT_PRIMARY,
    letterSpacing: '-0.01em',
    margin: '0 0 20px',
  };

  const eyebrowStyle: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: K.FONT_DISPLAY,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: K.TEXT_MUTED,
    marginBottom: 4,
  };

  return (
    <div className="sd-page">
      {/* ── Header ── */}
      <header className="sd-header">
        <button
          onClick={() => router.back()}
          className="sd-back"
          aria-label="Geri dön"
          style={{
            background: K.SURFACE,
            color: K.TEXT_SECONDARY,
            border: `1px solid ${K.BORDER}`,
            fontFamily: K.FONT_DISPLAY,
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Personel</span>
        </button>

        <div className="sd-header-main">
          <Avatar className="sd-avatar">
            <AvatarFallback
              className="sd-avatar-fb"
              style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}
            >
              {staff.initials}
            </AvatarFallback>
          </Avatar>
          <div className="sd-identity">
            <span style={eyebrowStyle}>Personel Profili</span>
            <h1 style={{
              fontFamily: K.FONT_DISPLAY,
              fontSize: 'clamp(24px, 3.5vw, 32px)',
              fontWeight: 700,
              color: K.TEXT_PRIMARY,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: 0,
            }}>
              {staff.name}
            </h1>
            <p style={{
              fontSize: 13,
              color: K.TEXT_MUTED,
              margin: '6px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}>
              {staff.title && <span>{staff.title}</span>}
              {staff.title && staff.department && <span style={{ color: K.BORDER }}>·</span>}
              {staff.department && <span>{staff.department}</span>}
            </p>
          </div>
        </div>

        <div className="sd-actions">
          <Link
            href={`/admin/staff/${staff.id}/edit`}
            className="sd-btn"
            style={{
              background: K.SURFACE,
              color: K.TEXT_SECONDARY,
              border: `1px solid ${K.BORDER}`,
              fontFamily: K.FONT_DISPLAY,
            }}
          >
            <Edit className="h-4 w-4" />
            <span>Düzenle</span>
          </Link>
          <button
            className="sd-btn"
            onClick={() => setAssignModalOpen(true)}
            style={{
              background: K.PRIMARY,
              color: '#fff',
              border: `1px solid ${K.PRIMARY}`,
              fontFamily: K.FONT_DISPLAY,
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Eğitim Ata</span>
          </button>
        </div>
      </header>

      {/* ── Stats ── */}
      <section className="sd-stats" aria-label="Performans özeti">
        <StatTile label="Atanan Eğitim" value={staff.stats?.assignedTrainings ?? 0} suffix="eğitim" icon={<GraduationCap className="h-4 w-4" />} accent={K.INFO} />
        <StatTile label="Tamamlanan" value={staff.stats?.completedTrainings ?? 0} suffix="bitti" icon={<TrendingUp className="h-4 w-4" />} accent={K.PRIMARY} />
        <StatTile label="Başarı Oranı" value={staff.stats?.successRate ?? '0%'} icon={<TrendingUp className="h-4 w-4" />} accent={K.SUCCESS} />
        <StatTile label="Ortalama Puan" value={staff.stats?.avgScore ?? '0'} icon={<TrendingUp className="h-4 w-4" />} accent={K.WARNING} />
      </section>

      {/* ── Profile info + Training history (2-col on desktop) ── */}
      <div className="sd-grid">
        {/* Profile Info */}
        <aside style={cardStyle}>
          <h2 style={sectionTitleStyle}>Kişisel Bilgiler</h2>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: 0 }}>
            {profileInfo.map((item, idx) => (
              <div
                key={item.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: idx === profileInfo.length - 1 ? 'none' : `1px dashed ${K.BORDER_LIGHT}`,
                }}
              >
                <dt style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: K.BG, color: K.TEXT_MUTED,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <span style={{
                    fontFamily: K.FONT_DISPLAY,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: K.TEXT_MUTED,
                  }}>
                    {item.label}
                  </span>
                </dt>
                <dd style={{
                  fontFamily: item.mono ? 'var(--font-mono, monospace)' : K.FONT_DISPLAY,
                  fontSize: item.mono ? 12 : 13,
                  fontWeight: 500,
                  color: K.TEXT_PRIMARY,
                  textAlign: 'right',
                  margin: 0,
                  wordBreak: 'break-word',
                  fontVariantNumeric: item.mono ? 'tabular-nums' : 'normal',
                }}>
                  {item.value || <em style={{ color: K.TEXT_MUTED, fontStyle: 'italic' }}>—</em>}
                </dd>
              </div>
            ))}
          </dl>
        </aside>

        {/* Training History */}
        <section style={{ ...cardStyle, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={sectionTitleStyle}>Eğitim Geçmişi</h2>
            {trainingHistory.length > 0 && (
              <span style={{ fontSize: 12, color: K.TEXT_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                <strong style={{ fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, fontSize: 14, fontWeight: 700 }}>
                  {trainingHistory.length.toString().padStart(2, '0')}
                </strong> kayıt
              </span>
            )}
          </div>

          {trainingHistory.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '40px 20px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 999,
                background: K.PRIMARY_LIGHT, color: K.PRIMARY,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY, margin: 0 }}>
                Henüz eğitim atanmamış
              </h3>
              <p style={{ fontSize: 13, color: K.TEXT_SECONDARY, margin: '0 0 8px', maxWidth: 320, lineHeight: 1.5 }}>
                Bu personele ilk eğitimi ata ve performansı takip etmeye başla.
              </p>
              <button
                className="sd-btn"
                onClick={() => setAssignModalOpen(true)}
                style={{
                  background: K.PRIMARY,
                  color: '#fff',
                  border: `1px solid ${K.PRIMARY}`,
                  fontFamily: K.FONT_DISPLAY,
                }}
              >
                <Plus className="h-4 w-4" />
                <span>Eğitim Ata</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="sd-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Eğitim', 'Deneme', 'Ön', 'Son', 'Durum', 'Tarih', ''].map((h, i) => (
                        <th
                          key={i}
                          style={{
                            textAlign: 'left',
                            fontFamily: K.FONT_DISPLAY,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: K.TEXT_MUTED,
                            padding: '10px 12px',
                            borderBottom: `1px solid ${K.BORDER_LIGHT}`,
                            background: K.BG,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trainingHistory.map((t, idx) => {
                      const st = statusMap[t.status] || statusMap.assigned;
                      const isLast = idx === trainingHistory.length - 1;
                      return (
                        <tr key={t.trainingId}>
                          <td style={{
                            padding: '14px 12px',
                            borderBottom: isLast ? 'none' : `1px solid ${K.BORDER_LIGHT}`,
                            verticalAlign: 'middle',
                            fontFamily: K.FONT_DISPLAY,
                            fontSize: 14,
                            fontWeight: 600,
                            color: K.TEXT_PRIMARY,
                          }}>
                            {t.title}
                          </td>
                          <td style={tdNum(K, isLast)}>{t.attempt}/{t.maxAttempts}</td>
                          <td style={tdNum(K, isLast)}>{t.preScore !== null ? `${t.preScore}%` : '—'}</td>
                          <td style={{
                            ...tdNum(K, isLast),
                            fontWeight: 700,
                            color: t.status === 'passed' ? K.PRIMARY : K.TEXT_PRIMARY,
                          }}>
                            {t.postScore !== null ? `${t.postScore}%` : '—'}
                          </td>
                          <td style={{ padding: '14px 12px', borderBottom: isLast ? 'none' : `1px solid ${K.BORDER_LIGHT}`, verticalAlign: 'middle' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 10px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                              background: st.bg,
                              color: st.text,
                              whiteSpace: 'nowrap',
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
                              {st.label}
                            </span>
                          </td>
                          <td style={{
                            padding: '14px 12px',
                            borderBottom: isLast ? 'none' : `1px solid ${K.BORDER_LIGHT}`,
                            verticalAlign: 'middle',
                            fontSize: 11,
                            color: K.TEXT_MUTED,
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {t.date}
                          </td>
                          <td style={{ padding: '14px 12px', borderBottom: isLast ? 'none' : `1px solid ${K.BORDER_LIGHT}`, verticalAlign: 'middle' }}>
                            {(t.status === 'failed' || t.status === 'locked') && (
                              <button
                                onClick={() => {
                                  setGrantTarget({ trainingId: t.trainingId, title: t.title });
                                  setGrantCount(1);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '5px 10px',
                                  borderRadius: 999,
                                  background: K.SURFACE,
                                  color: K.TEXT_SECONDARY,
                                  border: `1px solid ${K.BORDER}`,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  fontFamily: K.FONT_DISPLAY,
                                }}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Yeni Hak
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="sd-history-cards">
                {trainingHistory.map((t) => {
                  const st = statusMap[t.status] || statusMap.assigned;
                  return (
                    <li
                      key={t.trainingId}
                      style={{
                        padding: 16,
                        background: K.BG,
                        border: `1px solid ${K.BORDER_LIGHT}`,
                        borderRadius: 12,
                        listStyle: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                        <h4 style={{
                          fontFamily: K.FONT_DISPLAY,
                          fontSize: 15,
                          fontWeight: 700,
                          color: K.TEXT_PRIMARY,
                          margin: 0,
                          flex: 1,
                          minWidth: 0,
                        }}>
                          {t.title}
                        </h4>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: st.bg,
                          color: st.text,
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
                          {st.label}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {[
                          { lbl: 'Deneme', val: `${t.attempt}/${t.maxAttempts}` },
                          { lbl: 'Ön', val: t.preScore !== null ? `${t.preScore}%` : '—' },
                          { lbl: 'Son', val: t.postScore !== null ? `${t.postScore}%` : '—', color: t.status === 'passed' ? K.PRIMARY : K.TEXT_PRIMARY },
                          { lbl: 'Tarih', val: t.date, small: true },
                        ].map((c, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{
                              fontFamily: K.FONT_DISPLAY,
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              color: K.TEXT_MUTED,
                            }}>
                              {c.lbl}
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: c.small ? 10 : 12,
                              fontWeight: 600,
                              color: c.color || K.TEXT_PRIMARY,
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              {c.val}
                            </span>
                          </div>
                        ))}
                      </div>
                      {(t.status === 'failed' || t.status === 'locked') && (
                        <button
                          onClick={() => {
                            setGrantTarget({ trainingId: t.trainingId, title: t.title });
                            setGrantCount(1);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            width: '100%',
                            marginTop: 12,
                            padding: 10,
                            borderRadius: 999,
                            background: K.SURFACE,
                            color: K.TEXT_SECONDARY,
                            border: `1px solid ${K.BORDER}`,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: K.FONT_DISPLAY,
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Yeni Hak Ver
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      <AssignTrainingModal
        staffId={staff.id}
        staffName={staff.name}
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        onSuccess={refetch}
      />

      {grantTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !granting && setGrantTarget(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, background: K.SURFACE,
              borderRadius: 16, border: `1px solid ${K.BORDER}`,
              boxShadow: K.SHADOW_CARD, padding: 24,
              fontFamily: K.FONT_DISPLAY,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY }}>
              Ek deneme hakkı ver
            </h3>
            <p style={{ marginTop: 8, fontSize: 13, color: K.TEXT_MUTED, lineHeight: 1.5 }}>
              <strong style={{ color: K.TEXT_SECONDARY }}>{staff.name}</strong> personeline,
              <strong style={{ color: K.TEXT_SECONDARY }}> "{grantTarget.title}"</strong> eğitimi için kaç ek deneme hakkı verilsin?
            </p>

            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED, marginBottom: 8 }}>
                Ek deneme sayısı
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setGrantCount((c) => Math.max(1, c - 1))}
                  disabled={granting || grantCount <= 1}
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: `1px solid ${K.BORDER}`,
                    background: K.SURFACE, fontSize: 18, fontWeight: 700, cursor: 'pointer',
                    color: K.TEXT_SECONDARY,
                    opacity: grantCount <= 1 ? 0.4 : 1,
                  }}
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={grantCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setGrantCount(Math.min(Math.max(v, 1), 10));
                  }}
                  disabled={granting}
                  style={{
                    flex: 1, height: 40, textAlign: 'center', borderRadius: 10,
                    border: `1px solid ${K.BORDER}`, fontSize: 16, fontWeight: 700,
                    color: K.TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setGrantCount((c) => Math.min(10, c + 1))}
                  disabled={granting || grantCount >= 10}
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: `1px solid ${K.BORDER}`,
                    background: K.SURFACE, fontSize: 18, fontWeight: 700, cursor: 'pointer',
                    color: K.TEXT_SECONDARY,
                    opacity: grantCount >= 10 ? 0.4 : 1,
                  }}
                >+</button>
              </div>
              <p style={{ marginTop: 8, fontSize: 11, color: K.TEXT_MUTED }}>
                En fazla 10 ek hak verilebilir.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setGrantTarget(null)}
                disabled={granting}
                style={{
                  height: 38, padding: '0 16px', borderRadius: 999,
                  border: `1px solid ${K.BORDER}`, background: K.SURFACE,
                  fontSize: 13, fontWeight: 600, color: K.TEXT_SECONDARY, cursor: 'pointer',
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleGrant}
                disabled={granting}
                style={{
                  height: 38, padding: '0 18px', borderRadius: 999,
                  background: K.PRIMARY, color: '#fff', border: `1px solid ${K.PRIMARY}`,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: granting ? 0.6 : 1,
                }}
              >
                {granting ? 'Veriliyor…' : `${grantCount} hak ver`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .sd-page { display: flex; flex-direction: column; gap: 28px; }

        .sd-header {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
          padding-bottom: 24px;
          border-bottom: 1px solid ${K.BORDER_LIGHT};
        }
        .sd-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 14px 0 12px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .sd-back:hover { background: ${K.SURFACE_HOVER}; color: ${K.TEXT_PRIMARY}; }

        .sd-header-main { display: flex; align-items: center; gap: 18px; min-width: 0; }
        :global(.sd-avatar) {
          width: 64px !important;
          height: 64px !important;
          flex-shrink: 0;
          border: 1.5px solid ${K.BORDER};
        }
        :global(.sd-avatar-fb) {
          font-size: 22px !important;
          font-weight: 700 !important;
        }
        .sd-identity { min-width: 0; }

        .sd-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .sd-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1);
          text-decoration: none;
        }
        .sd-btn:active { transform: scale(0.97); }

        /* Stats */
        .sd-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        /* Grid */
        .sd-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 18px;
        }

        /* Mobile cards: hidden by default */
        .sd-history-cards {
          padding: 0;
          margin: 0;
          display: none;
          flex-direction: column;
          gap: 10px;
        }

        @media (max-width: 1024px) {
          .sd-grid { grid-template-columns: 1fr; }
          .sd-stats { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 700px) {
          .sd-header { grid-template-columns: 1fr; gap: 14px; }
          .sd-header-main { gap: 14px; }
          :global(.sd-avatar) { width: 56px !important; height: 56px !important; }
          .sd-actions { gap: 6px; flex-wrap: wrap; }
          .sd-actions :global(.sd-btn) { flex: 1; justify-content: center; padding: 0 14px; }

          .sd-table-wrap { display: none; }
          .sd-history-cards { display: flex; }
        }

        @media (max-width: 420px) {
          .sd-stats { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function tdNum(K: { BORDER_LIGHT: string; TEXT_SECONDARY: string }, isLast: boolean): React.CSSProperties {
  return {
    padding: '14px 12px',
    borderBottom: isLast ? 'none' : `1px solid ${K.BORDER_LIGHT}`,
    verticalAlign: 'middle',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 12,
    color: K.TEXT_SECONDARY,
    fontVariantNumeric: 'tabular-nums',
  };
}

// ── Stat Tile ──
function StatTile({
  label, value, suffix, icon, accent,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '20px 22px 20px 26px',
        background: K.SURFACE,
        borderRadius: 14,
        border: `1.5px solid ${K.BORDER}`,
        boxShadow: K.SHADOW_CARD,
        overflow: 'hidden',
        transition: 'border-color 200ms ease, transform 260ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div style={{
        position: 'absolute',
        left: 0,
        top: 14,
        bottom: 14,
        width: 3,
        background: accent,
        borderRadius: '0 2px 2px 0',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', color: accent }}>{icon}</span>
        <span style={{
          fontFamily: K.FONT_DISPLAY,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: K.TEXT_MUTED,
        }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: K.FONT_DISPLAY,
          fontSize: 30,
          fontWeight: 700,
          color: K.TEXT_PRIMARY,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
        </span>
        {suffix && <span style={{ fontSize: 12, color: K.TEXT_MUTED }}>{suffix}</span>}
      </div>
    </div>
  );
}
