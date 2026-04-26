'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plug, CheckCircle2, AlertTriangle, Save, Play, RefreshCw,
  Plus, Trash2, X, Eye, EyeOff, Loader2, ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { useToast } from '@/components/shared/toast';
import type { HisIntegration, SyncLog } from '@/types/database';

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

// ── Alan Eşleştirme Sabitleri ──

const LMS_FIELDS = [
  { value: 'externalId', label: 'Harici ID (zorunlu)' },
  { value: 'name', label: 'Ad' },
  { value: 'surname', label: 'Soyad' },
  { value: 'email', label: 'E-posta' },
  { value: 'phone', label: 'Telefon' },
  { value: 'tcNo', label: 'TC Kimlik No' },
  { value: 'department', label: 'Departman' },
  { value: 'title', label: 'Unvan' },
  { value: 'startDate', label: 'Başlangıç Tarihi' },
  { value: 'isActive', label: 'Aktif Mi' },
];

const DEFAULT_FIELD_MAPPING: Array<{ hisField: string; lmsField: string }> = [
  { hisField: 'personelId', lmsField: 'externalId' },
  { hisField: 'ad', lmsField: 'name' },
  { hisField: 'soyad', lmsField: 'surname' },
  { hisField: 'eposta', lmsField: 'email' },
  { hisField: 'telefon', lmsField: 'phone' },
  { hisField: 'birim', lmsField: 'department' },
  { hisField: 'unvan', lmsField: 'title' },
  { hisField: 'baslangicTarihi', lmsField: 'startDate' },
  { hisField: 'aktif', lmsField: 'isActive' },
];

// ── Tip Tanımları ──

interface IntegrationForm {
  name: string;
  baseUrl: string;
  authType: 'API_KEY' | 'BASIC_AUTH' | 'OAUTH2';
  syncInterval: number;
  isActive: boolean;
  apiKey: string;
  headerName: string;
  username: string;
  password: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

interface SyncResultSummary {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  created: number;
  updated: number;
  deactivated: number;
  errors: Array<{ externalId: string; error: string }>;
}

interface SyncLogRow extends Omit<SyncLog, 'errors'> {
  errorCount: number;
}

// ── Durum Badge ──

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    SUCCESS: { bg: K.SUCCESS_BG, color: K.SUCCESS, label: 'Başarılı' },
    FAILED:  { bg: K.ERROR_BG,   color: K.ERROR,   label: 'Başarısız' },
    RUNNING: { bg: K.WARNING_BG, color: K.WARNING, label: 'Çalışıyor' },
  };
  const s = styles[status] ?? { bg: K.BORDER_LIGHT, color: K.TEXT_MUTED, label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

// ── Sync Tipi Badge ──

function SyncTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    STAFF_IMPORT: 'Personel',
    DEPARTMENT_IMPORT: 'Departman',
    FULL_SYNC: 'Tam Sync',
  };
  return (
    <span style={{
      fontSize: 11, padding: '3px 10px', borderRadius: 999,
      background: K.BG, fontWeight: 600,
      color: K.TEXT_MUTED, border: `1px solid ${K.BORDER_LIGHT}`,
    }}>
      {labels[type] ?? type}
    </span>
  );
}

// ── Modal ──

function Modal({ onClose, children, title }: {
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 560,
        maxHeight: '80vh', overflow: 'auto',
        boxShadow: K.SHADOW_CARD,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: K.FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: K.TEXT_PRIMARY }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: K.TEXT_MUTED, padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Ana Sayfa ──

export default function HisIntegrationsPage() {
  const { toast } = useToast();

  const [integration, setIntegration] = useState<HisIntegration | null>(null);
  const [form, setForm] = useState<IntegrationForm>({
    name: '',
    baseUrl: '',
    authType: 'API_KEY',
    syncInterval: 60,
    isActive: true,
    apiKey: '',
    headerName: 'X-API-Key',
    username: '',
    password: '',
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
  });
  const [fieldMapping, setFieldMapping] = useState(DEFAULT_FIELD_MAPPING);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);

  const [testModal, setTestModal] = useState<{
    show: boolean;
    success: boolean;
    message: string;
    sampleData?: unknown;
  }>({ show: false, success: false, message: '' });

  const [syncResult, setSyncResult] = useState<SyncResultSummary | null>(null);
  const [errorModal, setErrorModal] = useState<{ show: boolean; log: SyncLog | null }>({
    show: false,
    log: null,
  });

  const loadIntegration = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/integrations/his');
      if (!res.ok) return;
      const data = await res.json() as { integration: HisIntegration | null };
      if (data.integration) {
        setIntegration(data.integration);
        setForm(prev => ({
          ...prev,
          name: data.integration!.name,
          baseUrl: data.integration!.baseUrl,
          authType: data.integration!.authType as IntegrationForm['authType'],
          syncInterval: data.integration!.syncInterval,
          isActive: data.integration!.isActive,
        }));
        const fm = data.integration!.fieldMapping as Record<string, string>;
        if (Object.keys(fm).length > 0) {
          setFieldMapping(Object.entries(fm).map(([hisField, lmsField]) => ({ hisField, lmsField })));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    const res = await fetch(`/api/admin/integrations/his/logs?page=${page}&limit=10`);
    if (!res.ok) return;
    const data = await res.json() as { logs: SyncLogRow[]; total: number };
    setLogs(data.logs);
    setLogsTotal(data.total);
    setLogsPage(page);
  }, []);

  useEffect(() => {
    void loadIntegration();
    void loadLogs();
  }, [loadIntegration, loadLogs]);

  function buildCredentials() {
    if (form.authType === 'API_KEY') {
      return { apiKey: form.apiKey, headerName: form.headerName };
    }
    if (form.authType === 'BASIC_AUTH') {
      return { username: form.username, password: form.password };
    }
    return { tokenUrl: form.tokenUrl, clientId: form.clientId, clientSecret: form.clientSecret };
  }

  function buildFieldMappingObject() {
    return Object.fromEntries(
      fieldMapping
        .filter(r => r.hisField.trim() && r.lmsField)
        .map(r => [r.hisField.trim(), r.lmsField])
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integrations/his', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          baseUrl: form.baseUrl,
          authType: form.authType,
          syncInterval: form.syncInterval,
          isActive: form.isActive,
          credentials: buildCredentials(),
          fieldMapping: buildFieldMappingObject(),
        }),
      });
      const data = await res.json() as { integration?: HisIntegration; error?: string };
      if (!res.ok || data.error) {
        toast(data.error ?? 'Kaydetme başarısız', 'error');
      } else {
        setIntegration(data.integration!);
        toast('Entegrasyon ayarları kaydedildi', 'success');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch('/api/admin/integrations/his/test', { method: 'POST' });
      const data = await res.json() as { success: boolean; message: string; sampleData?: unknown };
      setTestModal({ show: true, success: data.success, message: data.message, sampleData: data.sampleData });
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/integrations/his/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'FULL_SYNC' }),
      });
      const data = await res.json() as { result: SyncResultSummary; error?: string };
      if (!res.ok || data.error) {
        toast(data.error ?? 'Sync başarısız', 'error');
      } else {
        setSyncResult(data.result);
        void loadLogs(1);
        toast('Senkronizasyon tamamlandı', 'success');
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleViewErrors(logId: string) {
    const res = await fetch(`/api/admin/integrations/his/logs/${logId}`);
    if (!res.ok) return;
    const data = await res.json() as { log: SyncLog };
    setErrorModal({ show: true, log: data.log });
  }

  function updateMappingRow(index: number, field: 'hisField' | 'lmsField', value: string) {
    setFieldMapping(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function addMappingRow() {
    setFieldMapping(prev => [...prev, { hisField: '', lmsField: 'externalId' }]);
  }

  function removeMappingRow(index: number) {
    setFieldMapping(prev => prev.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: K.PRIMARY }} />
      </div>
    );
  }

  const isConnected = !!(integration?.isActive);

  const cardStyle: React.CSSProperties = {
    background: K.SURFACE,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 14,
    padding: 24,
    marginBottom: 20,
    boxShadow: K.SHADOW_CARD,
  };

  const sectionHeading: React.CSSProperties = {
    margin: '0 0 16px',
    fontFamily: K.FONT_DISPLAY,
    fontSize: 18,
    fontWeight: 700,
    color: K.TEXT_PRIMARY,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: K.TEXT_SECONDARY,
    marginBottom: 6,
    display: 'block',
    fontWeight: 500,
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 36px 8px 12px',
    borderRadius: 8, border: `1px solid ${K.BORDER}`,
    background: K.SURFACE, color: K.TEXT_PRIMARY,
    fontSize: 14, cursor: 'pointer', appearance: 'none',
  };

  const primaryButton: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 18px', borderRadius: 10,
    background: K.PRIMARY, color: '#fff',
    border: 'none', fontWeight: 600, fontSize: 14,
    cursor: 'pointer',
  };

  const ghostButton: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 18px', borderRadius: 10,
    background: K.SURFACE,
    color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}`,
    fontWeight: 600, fontSize: 14,
    cursor: 'pointer',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <BlurFade delay={0}>
        {/* Başlık */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: K.PRIMARY,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plug size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontFamily: K.FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: K.TEXT_PRIMARY }}>
                HIS Entegrasyonu
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: K.TEXT_MUTED }}>
                Hastane Bilgi Sistemi ile çift yönlü personel senkronizasyonu
              </p>
            </div>
          </div>
        </div>

        {/* ── Durum Kartı ── */}
        <div style={{
          ...cardStyle,
          padding: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isConnected
              ? <CheckCircle2 size={22} color={K.SUCCESS} />
              : <AlertTriangle size={22} color={K.WARNING} />
            }
            <div>
              <div style={{ fontWeight: 600, color: K.TEXT_PRIMARY, fontSize: 15 }}>
                {isConnected ? 'Bağlantı Aktif' : 'Bağlantı Kurulmadı'}
              </div>
              <div style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 2 }}>
                {integration?.lastSyncAt
                  ? `Son sync: ${new Date(integration.lastSyncAt).toLocaleString('tr-TR')}`
                  : 'Hiç senkronize edilmedi'
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {integration && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: isConnected ? K.PRIMARY : K.TEXT_MUTED,
                background: isConnected ? K.SUCCESS_BG : K.BG,
                border: `1px solid ${isConnected ? K.PRIMARY : K.BORDER_LIGHT}`,
                padding: '4px 10px', borderRadius: 999,
              }}>
                Her {integration.syncInterval} dakikada bir
              </span>
            )}
            {integration?.webhookToken && (
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: K.TEXT_MUTED,
                background: K.BG,
                border: `1px solid ${K.BORDER_LIGHT}`,
                padding: '4px 10px', borderRadius: 999,
              }}>
                Token: {integration.webhookToken.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>

        {/* ── Konfigürasyon Formu ── */}
        <div style={cardStyle}>
          <h2 style={sectionHeading}>Bağlantı Ayarları</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <Label style={labelStyle}>Entegrasyon Adı</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Devakent HIS"
              />
            </div>
            <div>
              <Label style={labelStyle}>Sync Aralığı (dakika)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={form.syncInterval}
                onChange={e => setForm(p => ({ ...p, syncInterval: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label style={labelStyle}>HIS API URL</Label>
            <Input
              type="url"
              value={form.baseUrl}
              onChange={e => setForm(p => ({ ...p, baseUrl: e.target.value }))}
              placeholder="https://his.hastane.com/api/v1/staff"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <Label style={labelStyle}>Kimlik Doğrulama Tipi</Label>
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
              <select
                value={form.authType}
                onChange={e => setForm(p => ({ ...p, authType: e.target.value as IntegrationForm['authType'] }))}
                style={selectStyle}
              >
                <option value="API_KEY">API Key</option>
                <option value="BASIC_AUTH">Basic Auth (Kullanıcı/Şifre)</option>
                <option value="OAUTH2">OAuth 2.0 (Client Credentials)</option>
              </select>
              <ChevronDown size={16} style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)', pointerEvents: 'none',
                color: K.TEXT_MUTED,
              }} />
            </div>
          </div>

          {form.authType === 'API_KEY' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <Label style={labelStyle}>API Key</Label>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="••••••••••••••••"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: K.TEXT_MUTED,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <Label style={labelStyle}>Header Adı</Label>
                <Input
                  value={form.headerName}
                  onChange={e => setForm(p => ({ ...p, headerName: e.target.value }))}
                  placeholder="X-API-Key"
                />
              </div>
            </div>
          )}

          {form.authType === 'BASIC_AUTH' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <Label style={labelStyle}>Kullanıcı Adı</Label>
                <Input
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div>
                <Label style={labelStyle}>Şifre</Label>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: K.TEXT_MUTED,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {form.authType === 'OAUTH2' && (
            <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
              <div>
                <Label style={labelStyle}>Token URL</Label>
                <Input
                  type="url"
                  value={form.tokenUrl}
                  onChange={e => setForm(p => ({ ...p, tokenUrl: e.target.value }))}
                  placeholder="https://his.hastane.com/oauth/token"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Label style={labelStyle}>Client ID</Label>
                  <Input
                    value={form.clientId}
                    onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                  />
                </div>
                <div>
                  <Label style={labelStyle}>Client Secret</Label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      value={form.clientSecret}
                      onChange={e => setForm(p => ({ ...p, clientSecret: e.target.value }))}
                      placeholder="••••••••"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(s => !s)}
                      style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: K.TEXT_MUTED,
                      }}
                    >
                      {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ ...primaryButton, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>

            <button
              onClick={() => void handleTest()}
              disabled={testing || !integration}
              style={{
                ...ghostButton,
                opacity: (testing || !integration) ? 0.6 : 1,
                cursor: (testing || !integration) ? 'not-allowed' : 'pointer',
              }}
            >
              {testing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
              {testing ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
            </button>
          </div>
        </div>

        {/* ── Alan Eşleştirme ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...sectionHeading, margin: 0 }}>Alan Eşleştirme</h2>
            <button
              onClick={addMappingRow}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: K.SURFACE, border: `1px dashed ${K.BORDER}`,
                color: K.TEXT_SECONDARY, cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
              }}
            >
              <Plus size={14} /> Satır Ekle
            </button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr auto',
            gap: 8, alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: K.TEXT_MUTED, padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              HIS ALANI
            </div>
            <div />
            <div style={{ fontSize: 11, fontWeight: 600, color: K.TEXT_MUTED, padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              LMS ALANI
            </div>
            <div />

            {fieldMapping.map((row, i) => (
              <React.Fragment key={i}>
                <Input
                  value={row.hisField}
                  onChange={e => updateMappingRow(i, 'hisField', e.target.value)}
                  placeholder="personelId"
                  style={{ fontSize: 13 }}
                />
                <span style={{ color: K.TEXT_MUTED, fontSize: 16, textAlign: 'center', padding: '0 4px' }}>
                  →
                </span>
                <div style={{ position: 'relative' }} key={`lms-${i}`}>
                  <select
                    value={row.lmsField}
                    onChange={e => updateMappingRow(i, 'lmsField', e.target.value)}
                    style={{ ...selectStyle, padding: '8px 32px 8px 10px', fontSize: 13 }}
                  >
                    {LMS_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)', pointerEvents: 'none',
                    color: K.TEXT_MUTED,
                  }} />
                </div>
                <button
                  key={`del-${i}`}
                  onClick={() => removeMappingRow(i)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: K.TEXT_MUTED, padding: 4, borderRadius: 6,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Manuel Sync ── */}
        <div style={cardStyle}>
          <h2 style={sectionHeading}>Manuel Senkronizasyon</h2>

          <button
            onClick={() => void handleSync()}
            disabled={syncing || !integration}
            style={{
              ...primaryButton,
              padding: '10px 20px',
              opacity: (syncing || !integration) ? 0.7 : 1,
              cursor: (syncing || !integration) ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={16} />
            }
            {syncing ? 'Senkronize ediliyor…' : 'Tam Sync Başlat'}
          </button>

          {syncResult && (
            <div style={{
              marginTop: 16, padding: 16, borderRadius: 10,
              background: syncResult.success ? K.SUCCESS_BG : K.ERROR_BG,
              border: `1px solid ${syncResult.success ? K.SUCCESS : K.ERROR}`,
              display: 'flex', gap: 20, flexWrap: 'wrap',
            }}>
              {[
                { label: 'Toplam', value: syncResult.totalRecords, color: K.TEXT_PRIMARY },
                { label: 'İşlendi', value: syncResult.processedRecords, color: K.TEXT_PRIMARY },
                { label: 'Oluşturuldu', value: syncResult.created, color: K.SUCCESS },
                { label: 'Güncellendi', value: syncResult.updated, color: K.INFO },
                { label: 'Devre Dışı', value: syncResult.deactivated, color: K.WARNING },
                { label: 'Hata', value: syncResult.errors.length, color: K.ERROR },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: K.FONT_DISPLAY,
                    fontSize: 22, fontWeight: 700,
                    color: item.color,
                  }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 11, color: K.TEXT_MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sync Geçmişi ── */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <h2 style={sectionHeading}>Sync Geçmişi</h2>

          {logs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              color: K.TEXT_MUTED, fontSize: 14,
            }}>
              HIS entegrasyonu yapılandırıldıktan sonra senkronizasyon kayıtları burada görünecek.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: K.BG }}>
                      {['Tarih', 'Tür', 'Durum', 'Toplam', 'İşlendi', 'Hata'].map(h => (
                        <th key={h} style={{
                          padding: '10px 12px', textAlign: 'left',
                          color: K.TEXT_MUTED, fontWeight: 600, fontSize: 11,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr
                        key={log.id}
                        onClick={() => log.errorCount > 0 ? void handleViewErrors(log.id) : undefined}
                        style={{
                          borderBottom: `1px solid ${K.BORDER_LIGHT}`,
                          cursor: log.errorCount > 0 ? 'pointer' : 'default',
                        }}
                        onMouseEnter={e => {
                          if (log.errorCount > 0) {
                            (e.currentTarget as HTMLTableRowElement).style.background = K.SURFACE_HOVER;
                          }
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: K.TEXT_MUTED }}>
                          {new Date(log.startedAt).toLocaleString('tr-TR')}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <SyncTypeBadge type={log.syncType} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <StatusBadge status={log.status} />
                        </td>
                        <td style={{ padding: '10px 12px', color: K.TEXT_PRIMARY, fontWeight: 500 }}>
                          {log.totalRecords}
                        </td>
                        <td style={{ padding: '10px 12px', color: K.TEXT_PRIMARY, fontWeight: 500 }}>
                          {log.processedRecords}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {log.errorCount > 0 ? (
                            <span style={{ color: K.ERROR, fontWeight: 600 }}>
                              {log.errorCount} (detay →)
                            </span>
                          ) : (
                            <span style={{ color: K.SUCCESS, fontWeight: 600 }}>0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {logsTotal > 10 && (
                <div style={{
                  display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16,
                }}>
                  <button
                    onClick={() => void loadLogs(logsPage - 1)}
                    disabled={logsPage <= 1}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: `1px solid ${K.BORDER}`,
                      background: K.SURFACE, cursor: logsPage <= 1 ? 'not-allowed' : 'pointer',
                      color: K.TEXT_SECONDARY, opacity: logsPage <= 1 ? 0.4 : 1,
                    }}
                  >
                    ‹
                  </button>
                  <span style={{
                    padding: '6px 14px', fontSize: 13,
                    color: K.TEXT_MUTED,
                  }}>
                    {logsPage} / {Math.ceil(logsTotal / 10)}
                  </span>
                  <button
                    onClick={() => void loadLogs(logsPage + 1)}
                    disabled={logsPage >= Math.ceil(logsTotal / 10)}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: `1px solid ${K.BORDER}`,
                      background: K.SURFACE,
                      cursor: logsPage >= Math.ceil(logsTotal / 10) ? 'not-allowed' : 'pointer',
                      color: K.TEXT_SECONDARY,
                      opacity: logsPage >= Math.ceil(logsTotal / 10) ? 0.4 : 1,
                    }}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </BlurFade>

      {/* ── Test Bağlantısı Modalı ── */}
      {testModal.show && (
        <Modal title="Bağlantı Test Sonucu" onClose={() => setTestModal(p => ({ ...p, show: false }))}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: testModal.sampleData != null ? 16 : 0,
          }}>
            {testModal.success
              ? <CheckCircle2 size={20} color={K.SUCCESS} />
              : <AlertTriangle size={20} color={K.ERROR} />
            }
            <span style={{
              color: testModal.success ? K.SUCCESS : K.ERROR,
              fontWeight: 600, fontSize: 15,
            }}>
              {testModal.message}
            </span>
          </div>
          {testModal.sampleData != null && (
            <pre style={{
              background: K.BG,
              border: `1px solid ${K.BORDER_LIGHT}`,
              borderRadius: 8, padding: 14, margin: 0,
              fontSize: 12, fontFamily: 'var(--font-mono)',
              color: K.TEXT_PRIMARY, overflowX: 'auto',
              maxHeight: 300, overflowY: 'auto',
            }}>
              {JSON.stringify(testModal.sampleData, null, 2)}
            </pre>
          )}
        </Modal>
      )}

      {/* ── Hata Detay Modalı ── */}
      {errorModal.show && errorModal.log && (
        <Modal title="Sync Hatası Detayları" onClose={() => setErrorModal({ show: false, log: null })}>
          <div style={{ marginBottom: 12, fontSize: 13, color: K.TEXT_MUTED }}>
            {new Date(errorModal.log.startedAt).toLocaleString('tr-TR')} •{' '}
            {errorModal.log.processedRecords}/{errorModal.log.totalRecords} kayıt işlendi
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(errorModal.log.errors as Array<{ externalId: string; error: string }>).map((err, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 8,
                background: K.ERROR_BG,
                border: `1px solid ${K.ERROR}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: K.ERROR, marginBottom: 4 }}>
                  ID: {err.externalId}
                </div>
                <div style={{ fontSize: 13, color: K.TEXT_PRIMARY }}>
                  {err.error}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
