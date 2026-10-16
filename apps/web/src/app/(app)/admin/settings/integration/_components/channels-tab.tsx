'use client';

import { useState } from 'react';
import { ArrowUpToLine, ArrowDownToLine, FileSpreadsheet, Save, Loader2, Info, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { ToggleSwitch } from './toggle-switch';
import {
  type Channel,
  type SyncModeValue,
  type IntegrationConfig,
  formatDateTime,
} from './types';

interface ChannelDraft {
  isActive: boolean;
  syncMode: SyncModeValue;
  deactivateMissing: boolean;
  deactivateThresholdPct: number;
}

interface ChannelMeta {
  channel: Channel;
  title: string;
  desc: string;
  icon: LucideIcon;
}

const CHANNEL_META: ChannelMeta[] = [
  {
    channel: 'push',
    title: 'Push — anlık bildirim',
    desc: "İK sisteminiz personel değişikliklerini bizim API'mize gönderir.",
    icon: ArrowUpToLine,
  },
  {
    channel: 'file',
    title: 'Dosya — gecelik yükleme',
    desc: 'İK sisteminizden alınan gecelik personel dosyası (CSV/XLSX) yüklenir.',
    icon: FileSpreadsheet,
  },
  {
    channel: 'pull',
    title: 'Pull — periyodik çekme',
    desc: "Biz İK API'nizden personel listesini belirlediğiniz aralıkla çekeriz.",
    icon: ArrowDownToLine,
  },
];

function buildDraft(cfg: IntegrationConfig | undefined): ChannelDraft {
  if (!cfg) {
    return { isActive: false, syncMode: 'delta', deactivateMissing: false, deactivateThresholdPct: 20 };
  }
  return {
    isActive: cfg.isActive,
    syncMode: cfg.syncMode,
    deactivateMissing: cfg.deactivateMissing,
    deactivateThresholdPct: cfg.deactivateThresholdPct,
  };
}

export function ChannelsTab({
  configs,
  onSaved,
}: {
  configs: IntegrationConfig[];
  onSaved: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {CHANNEL_META.map((meta) => {
        const cfg = configs.find((c) => c.channel === meta.channel);
        return (
          <ChannelCard
            // Kaydet + refetch sonrası kart sunucu durumuyla remount olur (effect'siz senkron).
            key={`${meta.channel}:${cfg?.updatedAt ?? 'new'}`}
            meta={meta}
            cfg={cfg}
            onSaved={onSaved}
          />
        );
      })}
    </div>
  );
}

function ChannelCard({
  meta,
  cfg,
  onSaved,
}: {
  meta: ChannelMeta;
  cfg: IntegrationConfig | undefined;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { channel, title, desc, icon: Icon } = meta;
  const [draft, setDraft] = useState<ChannelDraft>(() => buildDraft(cfg));
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<ChannelDraft>) => setDraft((prev) => ({ ...prev, ...p }));

  const handleSave = async () => {
    const pct = draft.deactivateThresholdPct;
    if (!Number.isInteger(pct) || pct < 5 || pct > 100) {
      toast('Deaktivasyon eşiği 5 ile 100 arasında bir tam sayı olmalıdır', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          isActive: draft.isActive,
          syncMode: draft.syncMode,
          deactivateMissing: draft.deactivateMissing,
          deactivateThresholdPct: pct,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Kanal ayarları kaydedilemedi');
      toast('Kanal ayarları kaydedildi', 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="flex flex-col rounded-2xl border"
      style={{
        background: 'var(--k-surface)',
        borderColor: 'var(--k-border)',
        boxShadow: 'var(--k-shadow-sm)',
      }}
    >
      {/* Kart başlığı */}
      <div className="flex items-start justify-between gap-3 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
              {title}
            </h3>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--k-text-muted)' }}>
              {desc}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={draft.isActive}
          onChange={(v) => patch({ isActive: v })}
          disabled={saving}
          label={`${title} kanalını ${draft.isActive ? 'pasifleştir' : 'aktifleştir'}`}
        />
      </div>

      {/* Kart gövdesi */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <span className={`k-badge ${draft.isActive ? 'k-badge-success' : 'k-badge-muted'}`}>
            {draft.isActive ? 'Aktif' : 'Pasif'}
          </span>
          {!cfg && <span className="k-badge k-badge-muted k-badge-no-dot">Yapılandırılmamış</span>}
        </div>

        <div>
          <label
            htmlFor={`sync-mode-${channel}`}
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--k-text-muted)' }}
          >
            Senkron Modu
          </label>
          <select
            id={`sync-mode-${channel}`}
            className="k-input w-full"
            value={draft.syncMode}
            onChange={(e) => patch({ syncMode: e.target.value as SyncModeValue })}
            disabled={saving}
          >
            <option value="delta">Delta — yalnız gönderilen kayıtlar işlenir</option>
            <option value="snapshot">Snapshot — feed tam liste kabul edilir</option>
          </select>
        </div>

        {draft.syncMode === 'snapshot' && (
          <div
            className="space-y-3 rounded-xl p-4"
            style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--k-text-primary)' }}>
                  Listede olmayanı pasifleştir
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--k-text-muted)' }}>
                  Feed&apos;de yer almayan entegrasyon-yönetimli personel pasife alınır.
                </p>
              </div>
              <ToggleSwitch
                checked={draft.deactivateMissing}
                onChange={(v) => patch({ deactivateMissing: v })}
                disabled={saving}
                label="Listede olmayan personeli pasifleştir"
              />
            </div>

            {draft.deactivateMissing && (
              <div>
                <label
                  htmlFor={`threshold-${channel}`}
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--k-text-muted)' }}
                >
                  Güvenlik Eşiği (%)
                </label>
                <Input
                  id={`threshold-${channel}`}
                  type="number"
                  min={5}
                  max={100}
                  value={draft.deactivateThresholdPct}
                  onChange={(e) => patch({ deactivateThresholdPct: Number(e.target.value) })}
                  disabled={saving}
                  className="h-10 rounded-xl text-[13px]"
                  style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
                />
                <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--k-text-muted)' }}>
                  Pasifleştirme, aktif personelin bu yüzdesini aşarsa koşu güvenlik için
                  durdurulur (boş/yarım dosya kazası koruması). 5-100 arası.
                </p>
              </div>
            )}
          </div>
        )}

        {channel === 'pull' && (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-snug" style={{ color: 'var(--k-text-muted)' }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {'Bağlantı adresi ve kimlik bilgileri "Pull Ayarları" sekmesinden yapılandırılır.'}
          </p>
        )}
      </div>

      {/* Kart alt bilgi + kaydet */}
      <div
        className="flex items-center justify-between gap-3 p-5 pt-4"
        style={{ borderTop: '1px solid var(--k-border)' }}
      >
        <p className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
          {cfg?.lastRunAt
            ? `Son koşu: ${formatDateTime(cfg.lastRunAt)}${cfg.lastRunStatus ? ` (${cfg.lastRunStatus})` : ''}`
            : 'Henüz koşu yapılmadı'}
        </p>
        <button onClick={handleSave} disabled={saving} className="k-btn k-btn-primary k-btn-sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </section>
  );
}
