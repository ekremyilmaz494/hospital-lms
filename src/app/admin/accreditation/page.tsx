'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Download, Plus, ChevronDown, Loader2, FileText,
  Pencil, Trash2, Lock, X,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useToast } from '@/components/shared/toast';

// ── Tipler ──

type StandardBody = 'JCI' | 'ISO_9001' | 'ISO_15189' | 'TJC' | 'OSHA';

interface AccreditationStandard {
  id: string;
  code: string;
  title: string;
  description: string | null;
  standardBody: string;
  requiredTrainingCategories: string[];
  requiredCompletionRate: number;
  isCustom?: boolean;
  organizationId?: string | null;
}

const TRAINING_CATEGORY_OPTIONS = [
  { value: 'enfeksiyon', label: 'Enfeksiyon' },
  { value: 'is-guvenligi', label: 'İş Güvenliği' },
  { value: 'hasta-haklari', label: 'Hasta Hakları' },
  { value: 'radyoloji', label: 'Radyoloji' },
  { value: 'laboratuvar', label: 'Laboratuvar' },
  { value: 'eczane', label: 'Eczane' },
  { value: 'acil', label: 'Acil Servis' },
  { value: 'genel', label: 'Genel Eğitim' },
] as const;

interface FindingRecord {
  standardCode: string;
  standardTitle: string;
  requiredRate: number;
  actualRate: number;
  missingStaffCount: number;
  totalStaff: number;
  categories: string[];
  status: 'compliant' | 'at_risk' | 'non_compliant';
}

interface ComplianceResult {
  organizationId: string;
  standardBody: StandardBody;
  periodStart: string;
  periodEnd: string;
  overallComplianceRate: number;
  findings: FindingRecord[];
  compliantCount: number;
  atRiskCount: number;
  nonCompliantCount: number;
}

interface AccreditationReport {
  id: string;
  title: string;
  standardBody: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  overallComplianceRate: number;
}

// ── Sabitler ──

const STANDARD_BODIES: { value: StandardBody; label: string }[] = [
  { value: 'JCI', label: 'JCI Akreditasyonu' },
  { value: 'ISO_9001', label: 'ISO 9001 Kalite Yönetimi' },
  { value: 'ISO_15189', label: 'ISO 15189 Laboratuvar' },
  { value: 'TJC', label: 'The Joint Commission' },
  { value: 'OSHA', label: 'OSHA İş Güvenliği' },
];

type TabId = 'standards' | 'simulation' | 'reports';

// ── Status Helpers ──

const STATUS_CONFIG = {
  compliant: { label: 'Uyumlu', color: 'var(--color-success)', bg: 'rgba(22,163,74,0.08)' },
  at_risk: { label: 'Risk Altında', color: 'var(--color-warning, #d97706)', bg: 'rgba(217,119,6,0.08)' },
  non_compliant: { label: 'Uyumsuz', color: 'var(--color-destructive, #dc2626)', bg: 'rgba(220,38,38,0.08)' },
};

function StatusBadge({ status }: { status: FindingRecord['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 12, color: cfg.color, background: cfg.bg,
    }}>
      {status === 'compliant' ? <CheckCircle2 size={11} /> : status === 'at_risk' ? <AlertTriangle size={11} /> : <XCircle size={11} />}
      {cfg.label}
    </span>
  );
}

function RateBar({ actual, required }: { actual: number; required: number }) {
  const pct = Math.min(100, actual);
  const color = actual >= required ? 'var(--color-success)' : actual >= required * 0.8 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--color-border, #e2e8f0)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>{actual}%</span>
    </div>
  );
}

// ── Ana Sayfa ──

export default function AccreditationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('standards');
  const [selectedBody, setSelectedBody] = useState<StandardBody>('JCI');

  // Tab 1: Standartlar
  const [standards, setStandards] = useState<AccreditationStandard[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [editingStandard, setEditingStandard] = useState<AccreditationStandard | null>(null);
  const [showStandardModal, setShowStandardModal] = useState(false);

  // Tab 2: Simülasyon
  const [simPeriodStart, setSimPeriodStart] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [simPeriodEnd, setSimPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionPlanCategories, setActionPlanCategories] = useState<string[]>([]);
  const [actionPlanDueDate, setActionPlanDueDate] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);

  // Tab 3: Raporlar
  const [reports, setReports] = useState<AccreditationReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Veri Yükleme ──

  const loadStandards = useCallback(async () => {
    setLoadingStandards(true);
    try {
      const res = await fetch(`/api/admin/accreditation/standards?standardBody=${selectedBody}`);
      const json = await res.json();
      setStandards(json.standards ?? []);
    } catch {
      toast('Standartlar yüklenemedi', 'error');
    } finally {
      setLoadingStandards(false);
    }
  }, [selectedBody, toast]);

  const handleDeleteStandard = useCallback(async (id: string) => {
    if (!window.confirm('Bu standardı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/admin/accreditation/standards/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Silme başarısız');
      }
      toast('Standart silindi', 'success');
      loadStandards();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    }
  }, [toast, loadStandards]);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/admin/accreditation/reports?standardBody=${selectedBody}&limit=50`);
      const json = await res.json();
      setReports(json.reports ?? []);
    } catch {
      toast('Raporlar yüklenemedi', 'error');
    } finally {
      setLoadingReports(false);
    }
  }, [selectedBody, toast]);

  useEffect(() => {
    if (activeTab === 'standards') loadStandards();
    if (activeTab === 'reports') loadReports();
  }, [activeTab, loadStandards, loadReports]);

  // ── Simülasyon ──

  const runSimulation = async () => {
    setLoadingCompliance(true);
    setCompliance(null);
    try {
      const res = await fetch(`/api/admin/accreditation/compliance?standardBody=${selectedBody}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setCompliance(json.compliance);

      // Eksik kategorileri aksiyon planı için ön-doldur
      const missing = new Set<string>();
      for (const f of (json.compliance?.findings ?? []) as FindingRecord[]) {
        if (f.status !== 'compliant') f.categories.forEach(c => missing.add(c));
      }
      setActionPlanCategories(Array.from(missing));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Simülasyon başarısız', 'error');
    } finally {
      setLoadingCompliance(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/accreditation/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standardBody: selectedBody,
          periodStart: new Date(simPeriodStart).toISOString(),
          periodEnd: new Date(simPeriodEnd).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      toast('Rapor oluşturuldu ve kaydedildi');
      // Raporlar tabına geç
      setActiveTab('reports');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Rapor oluşturulamadı', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const createActionPlan = async () => {
    if (actionPlanCategories.length === 0) {
      toast('En az bir kategori seçin', 'error');
      return;
    }
    setCreatingPlan(true);
    try {
      const res = await fetch('/api/admin/accreditation/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standardBody: selectedBody,
          categories: actionPlanCategories,
          ...(actionPlanDueDate ? { dueDate: new Date(actionPlanDueDate).toISOString() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      toast(json.message ?? 'Aksiyon planı oluşturuldu');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Aksiyon planı oluşturulamadı', 'error');
    } finally {
      setCreatingPlan(false);
    }
  };

  const downloadPdf = async (report: AccreditationReport) => {
    setDownloadingId(report.id);
    try {
      const res = await fetch(`/api/admin/accreditation/reports/${report.id}/pdf`);
      if (!res.ok) throw new Error('PDF indirilemedi');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('PDF indirilemedi', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── UI Render ──

  const overallRate = compliance?.overallComplianceRate ?? 0;
  const rateColor = overallRate >= 80 ? 'var(--color-success)' : overallRate >= 60 ? '#d97706' : '#dc2626';

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto' }}>
      <BlurFade delay={0.05}>
        {/* ── Premium Hero Header ── */}
        <div style={{
          position: 'relative',
          borderRadius: 24,
          padding: '32px 36px',
          marginBottom: 32,
          background: 'linear-gradient(135deg, #0f172a 0%, var(--brand-900) 65%, var(--brand-600) 100%)',
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 20px 60px -20px color-mix(in srgb, var(--brand-600) calc(0.45 * 100%), transparent), 0 8px 24px -12px rgba(15,23,42,0.3)',
        }}>
          {/* Dekoratif ışık halkası */}
          <div style={{
            position: 'absolute', top: -80, right: -80, width: 280, height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -120, left: -100, width: 320, height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 280 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 18,
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
                <ClipboardCheck size={28} color="#fff" />
              </div>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                  color: 'rgba(245,158,11,0.95)', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Akreditasyon &amp; Uyum
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                  Denetim Hazırlık Merkezi
                </h1>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', margin: '6px 0 0', maxWidth: 460 }}>
                  JCI, ISO 9001/15189, TJC ve OSHA standartlarında uyum takibi, simülasyon ve denetçiye hazır PDF raporlama.
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Aktif Standart', value: STANDARD_BODIES.length, accent: 'var(--brand-400)' },
                { label: 'Toplam Rapor', value: reports.length, accent: '#fbbf24' },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '12px 18px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  minWidth: 120,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.accent, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Standart Seçici ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>Standart:</span>
          {STANDARD_BODIES.map(b => (
            <button
              key={b.value}
              onClick={() => setSelectedBody(b.value)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
                borderColor: selectedBody === b.value ? 'var(--color-primary)' : 'var(--color-border, #e2e8f0)',
                background: selectedBody === b.value ? 'color-mix(in srgb, var(--brand-600) calc(0.1 * 100%), transparent)' : 'transparent',
                color: selectedBody === b.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {b.value}
            </button>
          ))}
        </div>

        {/* ── Sekmeler ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border, #e2e8f0)', marginBottom: 28 }}>
          {([
            { id: 'standards', label: 'Standartlar' },
            { id: 'simulation', label: 'Denetim Simülasyonu' },
            { id: 'reports', label: 'Raporlar' },
          ] as { id: TabId; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: 'none', background: 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2, transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════
            SEKMe 1: STANDARTLAR
        ══════════════════════════════════ */}
        {activeTab === 'standards' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Resmi standartlar <ShieldLockInline /> kilitli · kuruma özel olanları düzenleyebilirsiniz
              </div>
              <button
                type="button"
                onClick={() => { setEditingStandard(null); setShowStandardModal(true); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: 'var(--color-primary)', color: 'white',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Yeni Standart
              </button>
            </div>

            {loadingStandards ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-text-muted)' }} />
              </div>
            ) : standards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)', fontSize: 14 }}>
                Bu standart için kayıt bulunamadı. Yeni standart eklemek için yukarıdaki butona basın.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {standards.map((std, i) => (
                  <BlurFade key={std.id} delay={0.03 * i}>
                    <div style={{
                      background: 'var(--color-card, #fff)', borderRadius: 14,
                      border: std.isCustom
                        ? '1px solid color-mix(in srgb, var(--brand-600) calc(0.35 * 100%), transparent)'
                        : '1px solid var(--color-border, #e2e8f0)',
                      padding: '16px 20px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: 'var(--color-primary)',
                              background: 'color-mix(in srgb, var(--brand-600) calc(0.1 * 100%), transparent)', padding: '1px 7px', borderRadius: 6,
                            }}>
                              {std.code}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {std.title}
                            </span>
                            {std.isCustom ? (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                                background: 'color-mix(in srgb, var(--brand-600) calc(0.12 * 100%), transparent)',
                                color: 'var(--color-primary)',
                              }}>
                                KURUMA ÖZEL
                              </span>
                            ) : (
                              <span title="Resmi standart — düzenlenemez" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                                background: 'var(--color-surface-hover, #f1f5f9)',
                                color: 'var(--color-text-muted)',
                              }}>
                                🔒 RESMİ
                              </span>
                            )}
                          </div>
                          {std.description && (
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                              {std.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {std.requiredTrainingCategories.map(cat => {
                              const opt = TRAINING_CATEGORY_OPTIONS.find(o => o.value === cat);
                              return (
                                <span key={cat} style={{
                                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8,
                                  background: 'var(--color-surface-hover, #f1f5f9)', color: 'var(--color-text-muted)',
                                }}>
                                  {opt?.label ?? cat}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ textAlign: 'center', minWidth: 72 }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>
                              %{std.requiredCompletionRate}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>gerekli oran</div>
                          </div>
                          {std.isCustom && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => { setEditingStandard(std); setShowStandardModal(true); }}
                                title="Düzenle"
                                style={{
                                  padding: 6, borderRadius: 8, border: '1px solid var(--color-border)',
                                  background: 'var(--color-card, #fff)', color: 'var(--color-text-muted)',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStandard(std.id)}
                                title="Sil"
                                style={{
                                  padding: 6, borderRadius: 8, border: '1px solid var(--color-border)',
                                  background: 'var(--color-card, #fff)', color: 'var(--color-destructive, #dc2626)',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </BlurFade>
                ))}
              </div>
            )}

            {showStandardModal && (
              <StandardFormModal
                initial={editingStandard}
                defaultBody={selectedBody}
                onClose={() => { setShowStandardModal(false); setEditingStandard(null); }}
                onSaved={() => { setShowStandardModal(false); setEditingStandard(null); loadStandards(); }}
              />
            )}
          </div>
        )}

        {/* ══════════════════════════════════
            SEKME 2: SİMÜLASYON
        ══════════════════════════════════ */}
        {activeTab === 'simulation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Dönem seçici + çalıştır */}
            <div style={{
              background: 'var(--color-card, #fff)', borderRadius: 16,
              border: '1px solid var(--color-border, #e2e8f0)', padding: 20,
              display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap',
            }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  Dönem Başlangıcı
                </label>
                <input type="date" value={simPeriodStart} onChange={e => setSimPeriodStart(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border, #e2e8f0)',
                    fontSize: 13, background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  Dönem Bitişi
                </label>
                <input type="date" value={simPeriodEnd} onChange={e => setSimPeriodEnd(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border, #e2e8f0)',
                    fontSize: 13, background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                  }}
                />
              </div>
              <button
                onClick={runSimulation}
                disabled={loadingCompliance}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: loadingCompliance ? 0.7 : 1,
                }}
              >
                {loadingCompliance
                  ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  : <RefreshCw size={15} />}
                Simülasyonu Çalıştır
              </button>
            </div>

            {/* Sonuç */}
            {compliance && (
              <>
                {/* Özet kartlar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Genel Uyumluluk', value: `%${overallRate}`, color: rateColor },
                    { label: 'Uyumlu', value: compliance.compliantCount, color: 'var(--color-success)' },
                    { label: 'Risk Altında', value: compliance.atRiskCount, color: '#d97706' },
                    { label: 'Uyumsuz', value: compliance.nonCompliantCount, color: '#dc2626' },
                  ].map(card => (
                    <div key={card.label} style={{
                      background: 'var(--color-card, #fff)', borderRadius: 14,
                      border: '1px solid var(--color-border, #e2e8f0)', padding: '16px 20px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: card.color as string }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Bulgular tablosu */}
                <div style={{
                  background: 'var(--color-card, #fff)', borderRadius: 16,
                  border: '1px solid var(--color-border, #e2e8f0)', overflow: 'hidden',
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Standart Bulgular
                    </h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-hover)' }}>
                          {['Kod', 'Standart', 'Gereken', 'Gerçekleşen', 'Eksik Personel', 'Durum'].map(h => (
                            <th key={h} style={{
                              padding: '10px 14px', textAlign: 'left', fontSize: 11,
                              fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {compliance.findings.map((f, i) => (
                          <tr key={f.standardCode} style={{
                            borderTop: i > 0 ? '1px solid var(--color-border, #e2e8f0)' : undefined,
                          }}>
                            <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                              {f.standardCode}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-text-primary)', maxWidth: 280 }}>
                              {f.standardTitle}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                              %{f.requiredRate}
                            </td>
                            <td style={{ padding: '12px 14px', minWidth: 120 }}>
                              <RateBar actual={f.actualRate} required={f.requiredRate} />
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: f.missingStaffCount > 0 ? '#dc2626' : 'var(--color-text-muted)' }}>
                              {f.missingStaffCount > 0 ? `${f.missingStaffCount} kişi` : '—'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <StatusBadge status={f.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Aksiyon Planı + Rapor Oluştur */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Aksiyon Planı */}
                  <div style={{
                    background: 'var(--color-card, #fff)', borderRadius: 16,
                    border: '1px solid var(--color-border, #e2e8f0)', padding: 20,
                  }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Aksiyon Planı Oluştur
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                      Seçilen kategorilerde eksik eğitimleri tüm personele atar.
                    </p>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                        Kategoriler (virgülle ayrılmış)
                      </label>
                      <input
                        value={actionPlanCategories.join(', ')}
                        onChange={e => setActionPlanCategories(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="enfeksiyon, genel, is-guvenligi"
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8,
                          border: '1px solid var(--color-border, #e2e8f0)',
                          fontSize: 12, background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                        Son Tamamlanma Tarihi (isteğe bağlı)
                      </label>
                      <input type="date" value={actionPlanDueDate} onChange={e => setActionPlanDueDate(e.target.value)}
                        style={{
                          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border, #e2e8f0)',
                          fontSize: 12, background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>
                    <button
                      onClick={createActionPlan}
                      disabled={creatingPlan}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
                        opacity: creatingPlan ? 0.7 : 1,
                      }}
                    >
                      {creatingPlan
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Plus size={14} />}
                      Atama Oluştur
                    </button>
                  </div>

                  {/* Rapor Kaydet */}
                  <div style={{
                    background: 'var(--color-card, #fff)', borderRadius: 16,
                    border: '1px solid var(--color-border, #e2e8f0)', padding: 20,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>
                    <div>
                      <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        Denetim Raporunu Kaydet
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                        Simülasyon sonucunu resmi rapor olarak kaydeder ve PDF indirebilirsiniz.
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                        Dönem: <strong>{simPeriodStart}</strong> → <strong>{simPeriodEnd}</strong>
                      </p>
                    </div>
                    <button
                      onClick={generateReport}
                      disabled={generating}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
                        padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: '#1e40af', color: '#fff', border: 'none', cursor: 'pointer',
                        opacity: generating ? 0.7 : 1, width: 'fit-content',
                      }}
                    >
                      {generating
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <FileText size={14} />}
                      Raporu Kaydet
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════
            SEKME 3: RAPORLAR
        ══════════════════════════════════ */}
        {activeTab === 'reports' && (
          <div>
            {loadingReports ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-text-muted)' }} />
              </div>
            ) : reports.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '64px 32px',
                background: 'var(--color-surface)',
                borderRadius: 20,
                border: '1px dashed color-mix(in srgb, var(--brand-600) calc(0.35 * 100%), transparent)',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: 'color-mix(in srgb, var(--brand-600) calc(0.12 * 100%), transparent)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                }}>
                  <FileText size={32} color="var(--brand-600)" />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                  Henüz Akreditasyon Raporu Oluşturulmadı
                </h3>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: '0 0 22px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                  Denetim Simülasyonu sekmesinden uyum analizini çalıştırın, sonucu resmi rapor olarak kaydedin.
                </p>
                <button
                  onClick={() => setActiveTab('simulation')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '11px 22px', borderRadius: 12, fontSize: 13.5, fontWeight: 700,
                    background: 'var(--color-primary)', color: '#fff',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 24px color-mix(in srgb, var(--brand-600) calc(0.3 * 100%), transparent)',
                  }}
                >
                  <RefreshCw size={15} />
                  Simülasyon Başlat
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 18,
              }}>
                {reports.map((r, i) => {
                  const rate = Number(r.overallComplianceRate);
                  const color = rate >= 80 ? 'var(--brand-500)' : rate >= 60 ? '#f59e0b' : '#ef4444';
                  const colorBg = rate >= 80 ? 'rgba(16,185,129,0.08)' : rate >= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
                  const status = rate >= 80 ? 'Uyumlu' : rate >= 60 ? 'Risk Altında' : 'Kritik';
                  const periodMonths = Math.round(
                    (new Date(r.periodEnd).getTime() - new Date(r.periodStart).getTime()) / (30 * 86400000)
                  );
                  const circumference = 2 * Math.PI * 36;
                  const dashOffset = circumference - (rate / 100) * circumference;

                  return (
                    <BlurFade key={r.id} delay={0.04 * i}>
                      <div style={{
                        position: 'relative',
                        background: 'var(--color-surface)',
                        borderRadius: 18,
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(15,23,42,0.12)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)';
                      }}
                      >
                        {/* Üst color bar */}
                        <div style={{ height: 4, background: color }} />

                        <div style={{ padding: 22 }}>
                          {/* Üst satır: standart badge + tarih */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 8,
                              background: 'color-mix(in srgb, var(--brand-600) calc(0.08 * 100%), transparent)',
                              color: 'var(--color-primary)',
                              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                            }}>
                              <ClipboardCheck size={11} />
                              {r.standardBody.replace('_', ' ')}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                              {new Date(r.generatedAt).toLocaleDateString('tr-TR')}
                            </span>
                          </div>

                          {/* Başlık */}
                          <h3 style={{
                            fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)',
                            margin: '0 0 18px', lineHeight: 1.35,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden', minHeight: 40,
                          }}>
                            {r.title}
                          </h3>

                          {/* Donut + meta */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
                            <svg width={88} height={88} style={{ flexShrink: 0 }}>
                              <circle cx={44} cy={44} r={36} stroke="var(--color-border, #e2e8f0)" strokeWidth={8} fill="none" />
                              <circle
                                cx={44} cy={44} r={36}
                                stroke={color} strokeWidth={8} fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                transform="rotate(-90 44 44)"
                                style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                              />
                              <text x={44} y={44} textAnchor="middle" dominantBaseline="middle"
                                fontSize={18} fontWeight={800} fill={color}>
                                %{Math.round(rate)}
                              </text>
                            </svg>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '3px 10px', borderRadius: 6,
                                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                                background: colorBg, color, marginBottom: 8,
                              }}>
                                {status}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                                <strong style={{ color: 'var(--color-text-secondary)' }}>Dönem:</strong> {periodMonths} ay
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                                {new Date(r.periodStart).toLocaleDateString('tr-TR')} — {new Date(r.periodEnd).toLocaleDateString('tr-TR')}
                              </div>
                            </div>
                          </div>

                          {/* PDF butonu */}
                          <button
                            onClick={() => downloadPdf(r)}
                            disabled={downloadingId === r.id}
                            style={{
                              width: '100%',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                              background: downloadingId === r.id ? 'color-mix(in srgb, var(--brand-600) calc(0.6 * 100%), transparent)' : 'var(--color-primary)',
                              color: '#fff',
                              border: 'none', cursor: downloadingId === r.id ? 'wait' : 'pointer',
                              boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
                              transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => { if (downloadingId !== r.id) e.currentTarget.style.transform = 'scale(1.02)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            {downloadingId === r.id ? (
                              <>
                                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                Hazırlanıyor...
                              </>
                            ) : (
                              <>
                                <Download size={15} />
                                Profesyonel PDF İndir
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </BlurFade>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </BlurFade>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Yardımcı: Kilit ikonu inline ──
function ShieldLockInline() {
  return (
    <Lock
      size={11}
      style={{ display: 'inline-block', verticalAlign: '-1px', margin: '0 2px', color: 'var(--color-text-muted)' }}
    />
  );
}

// ── Standart Form Modal ──

interface StandardFormModalProps {
  initial: AccreditationStandard | null;
  defaultBody: StandardBody;
  onClose: () => void;
  onSaved: () => void;
}

function StandardFormModal({ initial, defaultBody, onClose, onSaved }: StandardFormModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(initial?.code ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [standardBody, setStandardBody] = useState<StandardBody>(
    (initial?.standardBody as StandardBody | undefined) ?? defaultBody,
  );
  const [categories, setCategories] = useState<string[]>(initial?.requiredTrainingCategories ?? []);
  const [rate, setRate] = useState<number>(initial?.requiredCompletionRate ?? 80);

  const toggleCategory = (v: string) => {
    setCategories(prev => prev.includes(v) ? prev.filter(c => c !== v) : [...prev, v]);
  };

  const handleSubmit = async () => {
    if (!code.trim()) return toast('Kod zorunlu', 'error');
    if (!title.trim()) return toast('Başlık zorunlu', 'error');
    if (categories.length === 0) return toast('En az bir eğitim kategorisi seçin', 'error');
    if (rate < 0 || rate > 100) return toast('Oran 0–100 arası olmalı', 'error');

    setSaving(true);
    try {
      const url = initial
        ? `/api/admin/accreditation/standards/${initial.id}`
        : '/api/admin/accreditation/standards';
      const method = initial ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
          standardBody,
          requiredTrainingCategories: categories,
          requiredCompletionRate: rate,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Kaydetme başarısız');
      toast(initial ? 'Standart güncellendi' : 'Standart oluşturuldu', 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kaydetme başarısız', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-card, #fff)', borderRadius: 16,
          width: '100%', maxWidth: 560, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {initial ? 'Standart Düzenle' : 'Yeni Standart'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Kuruma özel akreditasyon standardı tanımlayın
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 6, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5 }}>
                Kod *
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="örn: KRM.EH.1"
                maxLength={50}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'var(--font-mono)',
                  background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5 }}>
                Standart Kuruluşu *
              </label>
              <select
                value={standardBody}
                onChange={e => setStandardBody(e.target.value as StandardBody)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--color-border)', fontSize: 13,
                  background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                }}
              >
                {STANDARD_BODIES.map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5 }}>
              Başlık *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="örn: El Hijyeni Uyumluluğu"
              maxLength={500}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--color-border)', fontSize: 13,
                background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5 }}>
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Standardın ne kapsadığı..."
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--color-border)', fontSize: 13, resize: 'vertical',
                background: 'var(--color-bg, #f8fafc)', color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Zorunlu Eğitim Kategorileri * ({categories.length} seçili)
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TRAINING_CATEGORY_OPTIONS.map(opt => {
                const active = categories.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleCategory(opt.value)}
                    style={{
                      padding: '6px 12px', borderRadius: 999,
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-primary)' : 'var(--color-bg, #f8fafc)',
                      color: active ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5 }}>
              Minimum Tamamlanma Oranı: %{rate}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={rate}
              onChange={e => setRate(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'var(--color-card, #fff)', color: 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {initial ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}
