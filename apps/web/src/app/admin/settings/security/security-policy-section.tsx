'use client';

import { useEffect, useState } from 'react';
import { Database, Network, Loader2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', BG: '#fafaf9', BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface SecurityPolicy {
  dataRetentionDays: number;
  notificationRetentionDays: number;
  backupRetentionDays: number;
  ipAllowlistEnabled: boolean;
  ipAllowlist: string[];
}

const cardStyle = { background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD };
const numInput = 'w-28 h-11 rounded-xl px-3 font-mono text-sm';
const numStyle = { background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, color: K.TEXT_PRIMARY };

/** Veri saklama (KVKK) + IP allowlist — kurum geneli güvenlik politikası. */
export function SecurityPolicySection() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [ipText, setIpText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings/security-policy')
      .then((r) => r.json())
      .then((d: SecurityPolicy) => {
        setPolicy(d);
        setIpText((d.ipAllowlist ?? []).join('\n'));
      })
      .catch(() => toast('Güvenlik politikası yüklenemedi', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const patch = (p: Partial<SecurityPolicy>) => setPolicy((prev) => (prev ? { ...prev, ...p } : prev));

  const handleSave = async () => {
    if (!policy) return;
    const ipAllowlist = ipText.split('\n').map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/security-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...policy, ipAllowlist }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Kaydedilemedi', 'error');
        return;
      }
      setPolicy(data);
      setIpText((data.ipAllowlist ?? []).join('\n'));
      toast('Güvenlik politikası kaydedildi', 'success');
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 mb-4 flex items-center justify-center" style={cardStyle}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: K.PRIMARY }} />
      </div>
    );
  }
  if (!policy) return null;

  return (
    <>
      {/* Veri saklama süreleri */}
      <div className="p-6 mb-4" style={cardStyle}>
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
            <Database className="h-6 w-6" style={{ color: K.PRIMARY }} />
          </div>
          <div className="flex-1">
            <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY, marginBottom: 4 }}>
              Veri Saklama Süreleri (KVKK)
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: K.TEXT_MUTED }}>
              Günlük temizleme görevi bu sürelerden eski kayıtları otomatik siler. Denetim
              loglarını yasal yükümlülüğünüzün altına düşürmeyin.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            ['Denetim Logları', 'dataRetentionDays', 30, 3650],
            ['Bildirimler', 'notificationRetentionDays', 7, 3650],
            ['Yedekler', 'backupRetentionDays', 7, 3650],
          ] as const).map(([label, key, min, max]) => (
            <div key={key}>
              <label className="text-[11px] font-semibold mb-1.5 block uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={policy[key]}
                  onChange={(e) => patch({ [key]: Number(e.target.value) } as Partial<SecurityPolicy>)}
                  className={numInput}
                  style={numStyle}
                />
                <span className="text-xs" style={{ color: K.TEXT_MUTED }}>gün</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* IP allowlist */}
      <div className="p-6 mb-4" style={cardStyle}>
        <div className="flex items-start justify-between gap-6 mb-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
              <Network className="h-6 w-6" style={{ color: K.PRIMARY }} />
            </div>
            <div className="flex-1">
              <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY, marginBottom: 4 }}>
                IP Adresi Kısıtlaması
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: K.TEXT_MUTED }}>
                Açıkken yalnız aşağıdaki IP/CIDR listesinden GİRİŞ yapılabilir (her satıra bir
                girdi: <code>203.0.113.10</code> veya <code>10.0.0.0/8</code>). Platform yöneticisi muaftır.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={policy.ipAllowlistEnabled}
            onClick={() => patch({ ipAllowlistEnabled: !policy.ipAllowlistEnabled })}
            className="relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors"
            style={{ background: policy.ipAllowlistEnabled ? K.PRIMARY : K.BORDER }}
          >
            <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: policy.ipAllowlistEnabled ? 'translateX(22px)' : 'translateX(3px)' }} />
          </button>
        </div>

        {policy.ipAllowlistEnabled && (
          <>
            <textarea
              value={ipText}
              onChange={(e) => setIpText(e.target.value)}
              rows={4}
              placeholder={'203.0.113.10\n10.0.0.0/8'}
              className="w-full rounded-xl p-3 font-mono text-sm resize-y"
              style={numStyle}
            />
            <div className="mt-3 rounded-xl p-3 flex gap-2.5" style={{ background: K.WARNING_BG, border: `1px solid ${K.WARNING}` }}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: K.WARNING }} />
              <p className="text-xs" style={{ color: K.TEXT_SECONDARY }}>
                Kendi mevcut IP&apos;nizi listeye eklediğinizden emin olun — aksi halde bir sonraki
                girişte kilitlenebilirsiniz. Liste boşken kayıt yaparsanız hiç kimse giriş yapamaz.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
          style={{ background: K.PRIMARY, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Politikayı Kaydet
        </button>
      </div>
    </>
  );
}
