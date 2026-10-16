'use client';

import { useState } from 'react';
import { ArrowRight, Plus, Trash2, Save, Loader2, Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import {
  type Channel,
  type IntegrationConfig,
  CHANNEL_LABELS,
  TARGET_FIELDS,
} from './types';

interface MappingRow {
  id: number;
  source: string;
  target: string;
}

interface DefaultRow {
  id: number;
  field: string;
  value: string;
}

const CHANNELS: Channel[] = ['push', 'file', 'pull'];

export function FieldMappingTab({
  configs,
  onSaved,
}: {
  configs: IntegrationConfig[];
  onSaved: () => void;
}) {
  const [channel, setChannel] = useState<Channel>('push');
  const config = configs.find((c) => c.channel === channel);

  return (
    <section
      className="rounded-2xl border"
      style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
          >
            <Shuffle className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
              Alan Eşleme
            </h3>
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              Kaynak sistemdeki alan adlarını Klinovax personel alanlarına eşleyin.
            </p>
          </div>
        </div>
        <div className="k-tabs" role="tablist" aria-label="Kanal seçimi">
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              role="tab"
              aria-selected={channel === ch}
              data-active={channel === ch ? 'true' : undefined}
              onClick={() => setChannel(ch)}
              className="k-tab"
            >
              {CHANNEL_LABELS[ch]}
            </button>
          ))}
        </div>
      </div>

      <MappingEditor
        // Kanal değişimi veya kaydet + refetch sonrası editör kayıtlı eşlemeyle
        // remount olur (effect'siz senkron).
        key={`${channel}:${config?.updatedAt ?? 'new'}`}
        channel={channel}
        config={config}
        onSaved={onSaved}
      />
    </section>
  );
}

function MappingEditor({
  channel,
  config,
  onSaved,
}: {
  channel: Channel;
  config: IntegrationConfig | undefined;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [mappingRows, setMappingRows] = useState<MappingRow[]>(() =>
    Object.entries(config?.fieldMapping ?? {}).map(([source, target], i) => ({
      id: i + 1,
      source,
      target,
    })),
  );
  const [defaultRows, setDefaultRows] = useState<DefaultRow[]>(() =>
    Object.entries(config?.defaults ?? {}).map(([field, value], i) => ({
      id: i + 1,
      field,
      value: String(value),
    })),
  );
  const [saving, setSaving] = useState(false);

  // Yeni satır id'si: listedeki en büyük id + 1 (ref'siz, render-güvenli).
  const nextIdOf = (rows: { id: number }[]) =>
    rows.length > 0 ? Math.max(...rows.map((r) => r.id)) + 1 : 1;

  const addMappingRow = () => {
    setMappingRows((rows) => [...rows, { id: nextIdOf(rows), source: '', target: TARGET_FIELDS[0].value }]);
  };
  const removeMappingRow = (id: number) => {
    setMappingRows((rows) => rows.filter((r) => r.id !== id));
  };
  const patchMappingRow = (id: number, p: Partial<MappingRow>) => {
    setMappingRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  };

  const addDefaultRow = () => {
    setDefaultRows((rows) => [...rows, { id: nextIdOf(rows), field: TARGET_FIELDS[6].value, value: '' }]);
  };
  const removeDefaultRow = (id: number) => {
    setDefaultRows((rows) => rows.filter((r) => r.id !== id));
  };
  const patchDefaultRow = (id: number, p: Partial<DefaultRow>) => {
    setDefaultRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  };

  const handleSave = async () => {
    // Boş satırları at, dolu satırları doğrula.
    const cleanMapping = mappingRows.filter((r) => r.source.trim() !== '');
    const seenSources = new Set<string>();
    for (const row of cleanMapping) {
      const src = row.source.trim();
      if (seenSources.has(src)) {
        toast(`"${src}" kaynak alanı birden fazla kez eşlenmiş — her kaynak alan bir kez eşlenebilir`, 'error');
        return;
      }
      seenSources.add(src);
    }

    const cleanDefaults = defaultRows.filter((r) => r.value.trim() !== '');
    const seenFields = new Set<string>();
    for (const row of cleanDefaults) {
      if (seenFields.has(row.field)) {
        toast('Aynı hedef alan için birden fazla varsayılan değer tanımlanamaz', 'error');
        return;
      }
      seenFields.add(row.field);
    }

    const fieldMapping =
      cleanMapping.length > 0
        ? Object.fromEntries(cleanMapping.map((r) => [r.source.trim(), r.target]))
        : null;
    const defaults =
      cleanDefaults.length > 0
        ? Object.fromEntries(cleanDefaults.map((r) => [r.field, r.value.trim()]))
        : null;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          fieldMapping,
          defaults,
          // Kanal henüz yapılandırılmamışsa eşleme kaydı kanalı YANLIŞLIKLA
          // aktifleştirmesin (upsert create default'u isActive: true).
          ...(config ? {} : { isActive: false }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Alan eşlemesi kaydedilemedi');
      toast('Alan eşlemesi kaydedildi', 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6 p-5">
        {/* Eşleme satırları */}
        <div>
          <p className="mb-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--k-text-secondary)' }}>
            Eşleme boş bırakılırsa kaynak alan adlarının bizim alan adlarımızla birebir aynı
            olduğu varsayılır. Örn. kaynakta <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>sicil_no</code>{' '}
            geliyorsa onu {'"Harici ID"'} alanına eşleyin.
          </p>

          {mappingRows.length === 0 && (
            <p
              className="rounded-xl p-4 text-center text-[12.5px]"
              style={{ background: 'var(--k-surface-hover)', border: '1px dashed var(--k-border)', color: 'var(--k-text-muted)' }}
            >
              Henüz eşleme satırı yok — kaynak alan adları birebir kabul edilecek.
            </p>
          )}

          <div className="space-y-2">
            {mappingRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  value={row.source}
                  onChange={(e) => patchMappingRow(row.id, { source: e.target.value })}
                  placeholder="Kaynak alan (örn. sicil_no)"
                  maxLength={100}
                  aria-label="Kaynak alan adı"
                  className="h-10 flex-1 rounded-xl text-[13px]"
                  style={{ background: 'var(--k-surface-hover)', borderColor: 'var(--k-border)', fontFamily: 'var(--font-mono, monospace)' }}
                />
                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--k-text-muted)' }} />
                <select
                  value={row.target}
                  onChange={(e) => patchMappingRow(row.id, { target: e.target.value })}
                  aria-label="Hedef alan"
                  className="k-input flex-1"
                >
                  {TARGET_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label} ({f.value})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeMappingRow(row.id)}
                  aria-label="Eşleme satırını sil"
                  className="k-btn k-btn-ghost k-btn-sm shrink-0"
                  style={{ color: 'var(--k-error)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addMappingRow} className="k-btn k-btn-ghost k-btn-sm mt-3">
            <Plus className="h-3.5 w-3.5" /> Satır Ekle
          </button>
        </div>

        {/* Varsayılanlar */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
        >
          <h4 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
            Varsayılan Değerler
          </h4>
          <p className="mt-1 mb-3 text-[12px] leading-relaxed" style={{ color: 'var(--k-text-muted)' }}>
            Kaynak veride bulunmayan alanlar için sabit değerler — örn. Departman = {'"Genel"'}.
          </p>

          <div className="space-y-2">
            {defaultRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <select
                  value={row.field}
                  onChange={(e) => patchDefaultRow(row.id, { field: e.target.value })}
                  aria-label="Varsayılan değer alanı"
                  className="k-input flex-1"
                  style={{ background: 'var(--k-surface)' }}
                >
                  {TARGET_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label} ({f.value})
                    </option>
                  ))}
                </select>
                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--k-text-muted)' }} />
                <Input
                  value={row.value}
                  onChange={(e) => patchDefaultRow(row.id, { value: e.target.value })}
                  placeholder="Değer (örn. Genel)"
                  maxLength={500}
                  aria-label="Varsayılan değer"
                  className="h-10 flex-1 rounded-xl text-[13px]"
                  style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
                />
                <button
                  onClick={() => removeDefaultRow(row.id)}
                  aria-label="Varsayılan değer satırını sil"
                  className="k-btn k-btn-ghost k-btn-sm shrink-0"
                  style={{ color: 'var(--k-error)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addDefaultRow} className="k-btn k-btn-ghost k-btn-sm mt-3" style={{ background: 'var(--k-surface)' }}>
            <Plus className="h-3.5 w-3.5" /> Varsayılan Ekle
          </button>
        </div>
      </div>

      <div className="flex justify-end p-5 pt-0">
        <button onClick={handleSave} disabled={saving} className="k-btn k-btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Kaydediliyor…' : 'Eşlemeyi Kaydet'}
        </button>
      </div>
    </>
  );
}
