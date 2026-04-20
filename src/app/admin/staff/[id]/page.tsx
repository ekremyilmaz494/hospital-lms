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
  passed:      { label: 'Başarılı',     bg: '#eaf6ef', text: '#0a7a47', dot: '#0a7a47' },
  failed:      { label: 'Başarısız',    bg: '#fdf5f2', text: '#b3261e', dot: '#b3261e' },
  in_progress: { label: 'Devam Ediyor', bg: '#fef6e7', text: '#6a4e11', dot: '#b4820b' },
  assigned:    { label: 'Atandı',       bg: '#eef2fb', text: '#1f3a7a', dot: '#2c55b8' },
  locked:      { label: 'Kilitli',      bg: '#fdf5f2', text: '#b3261e', dot: '#b3261e' },
};

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { toast } = useToast();
  const { data: staff, isLoading, error, refetch } = useFetch<StaffDetail>(id ? `/api/admin/staff/${id}` : null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="sd-empty">
        <p className="sd-empty-msg">{error}</p>
      </div>
    );
  }

  if (!staff || !id) {
    return (
      <div className="sd-empty">
        <p className="sd-empty-msg">Personel bulunamadı.</p>
        <style jsx>{`
          .sd-empty {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 300px; gap: 12px; color: #6b6a63;
          }
          .sd-empty-msg { font-family: var(--font-editorial, serif); font-size: 18px; }
        `}</style>
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

  return (
    <div className="sd-page">
      {/* ── Editorial Header ── */}
      <header className="sd-header">
        <button onClick={() => router.back()} className="sd-back" aria-label="Geri dön">
          <ArrowLeft className="h-4 w-4" />
          <span>Personel</span>
        </button>

        <div className="sd-header-main">
          <Avatar className="sd-avatar">
            <AvatarFallback className="sd-avatar-fb">{staff.initials}</AvatarFallback>
          </Avatar>
          <div className="sd-identity">
            <span className="sd-eyebrow">Personel Profili</span>
            <h1 className="sd-name">{staff.name}</h1>
            <p className="sd-subtitle">
              {staff.title && <span>{staff.title}</span>}
              {staff.title && staff.department && <span className="sd-dot">·</span>}
              {staff.department && <span>{staff.department}</span>}
            </p>
          </div>
        </div>

        <div className="sd-actions">
          <Link href={`/admin/staff/${staff.id}/edit`} className="sd-btn sd-btn-outline">
            <Edit className="h-4 w-4" />
            <span>Düzenle</span>
          </Link>
          <button className="sd-btn sd-btn-primary" onClick={() => setAssignModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Eğitim Ata</span>
          </button>
        </div>
      </header>

      {/* ── Stats ── */}
      <section className="sd-stats" aria-label="Performans özeti">
        <StatTile label="Atanan Eğitim" value={staff.stats?.assignedTrainings ?? 0} suffix="eğitim" icon={<GraduationCap className="h-4 w-4" />} tone="ink" />
        <StatTile label="Tamamlanan" value={staff.stats?.completedTrainings ?? 0} suffix="bitti" icon={<TrendingUp className="h-4 w-4" />} tone="ok" />
        <StatTile label="Başarı Oranı" value={staff.stats?.successRate ?? '0%'} icon={<TrendingUp className="h-4 w-4" />} tone="emerald" />
        <StatTile label="Ortalama Puan" value={staff.stats?.avgScore ?? '0'} icon={<TrendingUp className="h-4 w-4" />} tone="amber" />
      </section>

      {/* ── Profile info + Training history (2-col on desktop) ── */}
      <div className="sd-grid">
        {/* Profile Info */}
        <aside className="sd-profile">
          <h2 className="sd-card-title">Kişisel Bilgiler</h2>
          <dl className="sd-info-list">
            {profileInfo.map((item) => (
              <div key={item.label} className="sd-info-row">
                <dt>
                  <span className="sd-info-icon"><item.icon className="h-3.5 w-3.5" /></span>
                  <span className="sd-info-label">{item.label}</span>
                </dt>
                <dd className={item.mono ? 'sd-info-val sd-info-mono' : 'sd-info-val'}>
                  {item.value || <em className="sd-info-empty">—</em>}
                </dd>
              </div>
            ))}
          </dl>
        </aside>

        {/* Training History */}
        <section className="sd-history">
          <div className="sd-history-head">
            <h2 className="sd-card-title">Eğitim Geçmişi</h2>
            {trainingHistory.length > 0 && (
              <span className="sd-history-count">
                <strong>{trainingHistory.length.toString().padStart(2, '0')}</strong> kayıt
              </span>
            )}
          </div>

          {trainingHistory.length === 0 ? (
            <div className="sd-empty-card">
              <div className="sd-empty-icon"><GraduationCap className="h-6 w-6" /></div>
              <h3>Henüz eğitim atanmamış</h3>
              <p>Bu personele ilk eğitimi ata ve performansı takip etmeye başla.</p>
              <button className="sd-btn sd-btn-primary" onClick={() => setAssignModalOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>Eğitim Ata</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="sd-table-wrap">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Eğitim</th>
                      <th>Deneme</th>
                      <th>Ön</th>
                      <th>Son</th>
                      <th>Durum</th>
                      <th>Tarih</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingHistory.map((t) => {
                      const st = statusMap[t.status] || statusMap.assigned;
                      return (
                        <tr key={t.trainingId}>
                          <td className="sd-td-title">{t.title}</td>
                          <td className="sd-td-num">{t.attempt}/{t.maxAttempts}</td>
                          <td className="sd-td-num">{t.preScore !== null ? `${t.preScore}%` : '—'}</td>
                          <td className="sd-td-num sd-td-post" style={{ color: t.status === 'passed' ? '#0a7a47' : '#0a0a0a' }}>
                            {t.postScore !== null ? `${t.postScore}%` : '—'}
                          </td>
                          <td>
                            <span className="sd-chip" style={{ background: st.bg, color: st.text }}>
                              <span className="sd-chip-dot" style={{ background: st.dot }} />
                              {st.label}
                            </span>
                          </td>
                          <td className="sd-td-date">{t.date}</td>
                          <td>
                            {(t.status === 'failed' || t.status === 'locked') && (
                              <button
                                className="sd-retry"
                                onClick={async () => {
                                  const confirmed = window.confirm(`"${t.title}" eğitimi için ${staff.name} adlı personele 1 ek deneme hakkı verilecek. Onaylıyor musunuz?`);
                                  if (!confirmed) return;
                                  try {
                                    const res = await fetch(`/api/admin/trainings/${t.trainingId}/assignments`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: id, additionalAttempts: 1 }),
                                    });
                                    if (!res.ok) {
                                      const body = await res.json().catch(() => ({}));
                                      throw new Error(body.error || 'İşlem başarısız');
                                    }
                                    toast('Ek deneme hakkı verildi', 'success');
                                    refetch();
                                  } catch (err) {
                                    toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
                                  }
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
                    <li key={t.trainingId} className="sd-history-card">
                      <div className="sd-history-card-head">
                        <h4>{t.title}</h4>
                        <span className="sd-chip" style={{ background: st.bg, color: st.text }}>
                          <span className="sd-chip-dot" style={{ background: st.dot }} />
                          {st.label}
                        </span>
                      </div>
                      <div className="sd-history-card-grid">
                        <div>
                          <span className="sd-info-label">Deneme</span>
                          <span className="sd-card-num">{t.attempt}/{t.maxAttempts}</span>
                        </div>
                        <div>
                          <span className="sd-info-label">Ön</span>
                          <span className="sd-card-num">{t.preScore !== null ? `${t.preScore}%` : '—'}</span>
                        </div>
                        <div>
                          <span className="sd-info-label">Son</span>
                          <span className="sd-card-num" style={{ color: t.status === 'passed' ? '#0a7a47' : '#0a0a0a' }}>
                            {t.postScore !== null ? `${t.postScore}%` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="sd-info-label">Tarih</span>
                          <span className="sd-card-num sd-card-date">{t.date}</span>
                        </div>
                      </div>
                      {(t.status === 'failed' || t.status === 'locked') && (
                        <button
                          className="sd-retry sd-retry-full"
                          onClick={async () => {
                            const confirmed = window.confirm(`"${t.title}" eğitimi için ${staff.name} adlı personele 1 ek deneme hakkı verilecek. Onaylıyor musunuz?`);
                            if (!confirmed) return;
                            try {
                              const res = await fetch(`/api/admin/trainings/${t.trainingId}/assignments`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: id, additionalAttempts: 1 }),
                              });
                              if (!res.ok) {
                                const body = await res.json().catch(() => ({}));
                                throw new Error(body.error || 'İşlem başarısız');
                              }
                              toast('Ek deneme hakkı verildi', 'success');
                              refetch();
                            } catch (err) {
                              toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
                            }
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

      <style jsx>{`
        .sd-page { display: flex; flex-direction: column; gap: 28px; }

        /* ── Header ── */
        .sd-header {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
          padding-bottom: 24px;
          border-bottom: 1px solid #ebe7df;
        }
        .sd-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px 0 10px;
          border-radius: 999px;
          background: #faf8f2;
          color: #6b6a63;
          border: none;
          cursor: pointer;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          transition: background 160ms ease, color 160ms ease;
        }
        .sd-back:hover { background: #0a0a0a; color: #fafaf7; }

        .sd-header-main { display: flex; align-items: center; gap: 18px; min-width: 0; }
        :global(.sd-avatar) {
          width: 64px !important;
          height: 64px !important;
          flex-shrink: 0;
          border: 1px solid #ebe7df;
          box-shadow: inset 0 0 0 3px #fff, 0 0 0 1px #ebe7df;
        }
        :global(.sd-avatar-fb) {
          background: #0a0a0a !important;
          color: #fafaf7 !important;
          font-family: var(--font-editorial, serif);
          font-size: 22px !important;
          font-weight: 500 !important;
          font-variation-settings: 'opsz' 36, 'SOFT' 50;
        }
        .sd-identity { min-width: 0; }
        .sd-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 4px;
        }
        .sd-name {
          font-family: var(--font-editorial, serif);
          font-size: clamp(24px, 3.5vw, 34px);
          font-weight: 500;
          font-variation-settings: 'opsz' 56, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
        }
        .sd-subtitle {
          font-size: 13px;
          color: #6b6a63;
          margin: 6px 0 0;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sd-dot { color: #c8c2b0; }

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
          height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1);
          text-decoration: none;
        }
        .sd-btn:active { transform: scale(0.97); }
        .sd-btn-outline { background: transparent; color: #0a0a0a; border-color: #d9d4c4; }
        .sd-btn-outline:hover { border-color: #0a0a0a; background: #faf8f2; }
        .sd-btn-primary { background: #0a0a0a; color: #fafaf7; }
        .sd-btn-primary:hover { background: #1a1a1a; }

        /* ── Stats ── */
        .sd-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        /* ── Grid ── */
        .sd-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 18px;
        }

        /* ── Profile card ── */
        .sd-profile {
          padding: 24px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .sd-card-title {
          font-family: var(--font-editorial, serif);
          font-size: 18px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.01em;
          margin: 0 0 20px;
        }
        .sd-info-list { display: flex; flex-direction: column; gap: 2px; margin: 0; }
        .sd-info-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: baseline;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px dashed #ebe7df;
        }
        .sd-info-row:last-child { border-bottom: none; }
        .sd-info-row dt {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }
        .sd-info-icon {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: #faf8f2;
          color: #6b6a63;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sd-info-label {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
        }
        .sd-info-val {
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          font-weight: 500;
          color: #0a0a0a;
          text-align: right;
          margin: 0;
          word-break: break-word;
        }
        .sd-info-mono { font-family: var(--font-mono, monospace); font-size: 12px; font-variant-numeric: tabular-nums; }
        .sd-info-empty { color: #c8c2b0; font-style: italic; }

        /* ── History card ── */
        .sd-history {
          padding: 24px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
          min-width: 0;
        }
        .sd-history-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .sd-history-count {
          font-size: 12px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }
        .sd-history-count strong {
          font-family: var(--font-editorial, serif);
          color: #0a0a0a;
          font-size: 14px;
          font-weight: 500;
        }

        /* Desktop table */
        .sd-table-wrap {
          overflow-x: auto;
        }
        .sd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sd-table thead th {
          text-align: left;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8578;
          padding: 10px 12px;
          border-bottom: 1px solid #ebe7df;
          white-space: nowrap;
        }
        .sd-table tbody td {
          padding: 14px 12px;
          border-bottom: 1px solid #f1ede3;
          vertical-align: middle;
        }
        .sd-table tbody tr:last-child td { border-bottom: none; }
        .sd-table tbody tr:hover { background: #faf8f2; }
        .sd-td-title {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          color: #0a0a0a;
          font-variation-settings: 'opsz' 28;
        }
        .sd-td-num {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }
        .sd-td-post { font-weight: 700; color: #0a0a0a; }
        .sd-td-date {
          font-size: 11px;
          color: #8a8578;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .sd-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .sd-chip-dot { width: 5px; height: 5px; border-radius: 50%; }

        .sd-retry {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 999px;
          background: #ffffff;
          color: #0a0a0a;
          border: 1px solid #d9d4c4;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-family: var(--font-display, system-ui);
          transition: border-color 160ms ease, background 160ms ease;
        }
        .sd-retry:hover { border-color: #0a0a0a; background: #faf8f2; }
        .sd-retry-full { width: 100%; justify-content: center; margin-top: 12px; padding: 10px; }

        /* Mobile cards */
        .sd-history-cards {
          list-style: none;
          padding: 0;
          margin: 0;
          display: none;
          flex-direction: column;
          gap: 10px;
        }
        .sd-history-card {
          padding: 16px;
          background: #faf8f2;
          border: 1px solid #ebe7df;
          border-radius: 12px;
        }
        .sd-history-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .sd-history-card-head h4 {
          font-family: var(--font-editorial, serif);
          font-size: 16px;
          font-weight: 500;
          color: #0a0a0a;
          margin: 0;
          flex: 1;
          min-width: 0;
        }
        .sd-history-card-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .sd-history-card-grid > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sd-card-num {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 600;
          color: #0a0a0a;
          font-variant-numeric: tabular-nums;
        }
        .sd-card-date { font-size: 10px; color: #6b6a63; font-weight: 500; }

        /* ── Empty state ── */
        .sd-empty-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 40px 20px;
        }
        .sd-empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: #faf8f2;
          color: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sd-empty-card h3 {
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          color: #0a0a0a;
          margin: 0;
        }
        .sd-empty-card p {
          font-size: 13px;
          color: #6b6a63;
          margin: 0 0 8px;
          max-width: 320px;
          line-height: 1.5;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .sd-grid { grid-template-columns: 1fr; }
          .sd-stats { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 700px) {
          .sd-header {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .sd-header-main { gap: 14px; }
          :global(.sd-avatar) { width: 56px !important; height: 56px !important; }
          .sd-actions { gap: 6px; flex-wrap: wrap; }
          .sd-actions .sd-btn { flex: 1; justify-content: center; padding: 0 14px; }
          .sd-profile, .sd-history { padding: 18px; }

          /* Swap table → cards */
          .sd-table-wrap { display: none; }
          .sd-history-cards { display: flex; }
        }

        @media (max-width: 420px) {
          .sd-stats { grid-template-columns: 1fr; }
          .sd-history-card-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        }
      `}</style>
    </div>
  );
}

// ── Editorial Stat Tile ──
function StatTile({
  label, value, suffix, icon, tone,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ReactNode;
  tone: 'ink' | 'ok' | 'amber' | 'emerald';
}) {
  const toneColors: Record<typeof tone, string> = {
    ink: '#0a0a0a',
    ok: '#0a7a47',
    amber: '#b4820b',
    emerald: '#0a7a47',
  };
  const accent = toneColors[tone];

  return (
    <div className="st-tile">
      <div className="st-rail" />
      <div className="st-head">
        <span className="st-icon">{icon}</span>
        <span className="st-label">{label}</span>
      </div>
      <div className="st-value">
        <span className="st-number">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</span>
        {suffix && <span className="st-suffix">{suffix}</span>}
      </div>
      <style jsx>{`
        .st-tile {
          position: relative;
          padding: 20px 22px 20px 26px;
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #ebe7df;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 2px rgba(10, 10, 10, 0.03);
          overflow: hidden;
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16,1,0.3,1);
        }
        .st-tile:hover { border-color: #d9d4c4; transform: translateY(-1px); }
        .st-rail {
          position: absolute;
          left: 0;
          top: 14px;
          bottom: 14px;
          width: 3px;
          background: ${accent};
          border-radius: 0 2px 2px 0;
        }
        .st-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .st-icon { display: inline-flex; color: ${accent}; opacity: 0.75; }
        .st-label {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b6a63;
        }
        .st-value { display: flex; align-items: baseline; gap: 6px; }
        .st-number {
          font-family: var(--font-editorial, serif);
          font-size: 32px;
          font-weight: 500;
          font-variation-settings: 'opsz' 48, 'SOFT' 50;
          color: #0a0a0a;
          line-height: 1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .st-suffix { font-size: 12px; color: #8a8578; }
      `}</style>
    </div>
  );
}
