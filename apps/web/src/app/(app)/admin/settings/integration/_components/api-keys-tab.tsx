'use client';

import { useState } from 'react';
import { KeyRound, Plus, Copy, Check, Loader2, AlertTriangle, Ban, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import {
  type ApiKeyItem,
  type KeysResponse,
  type CreatedKeyResponse,
  formatDateTime,
} from './types';

const KEYS_URL = '/api/admin/integration/keys';

type KeyStatus = 'active' | 'revoked' | 'expired';

function keyStatus(key: ApiKeyItem): KeyStatus {
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

const STATUS_BADGE: Record<KeyStatus, { label: string; badge: string }> = {
  active: { label: 'Aktif', badge: 'k-badge-success' },
  revoked: { label: 'İptal edildi', badge: 'k-badge-error' },
  expired: { label: 'Süresi doldu', badge: 'k-badge-warning' },
};

export function ApiKeysTab() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<KeysResponse>(KEYS_URL);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [creating, setCreating] = useState(false);

  const [createdKey, setCreatedKey] = useState<CreatedKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const keys = data?.keys ?? [];

  const refresh = () => {
    invalidateFetchCache(KEYS_URL);
    refetch();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (newExpiry) {
      const expiry = new Date(`${newExpiry}T23:59:59`);
      if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
        toast('Geçerlilik tarihi gelecekte olmalıdır', 'error');
        return;
      }
    }
    setCreating(true);
    try {
      const res = await fetch(KEYS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          ...(newExpiry ? { expiresAt: new Date(`${newExpiry}T23:59:59`).toISOString() } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Anahtar oluşturulamadı');
      setCreateOpen(false);
      setNewName('');
      setNewExpiry('');
      setCopied(false);
      // Plaintext YALNIZ bu yanıtta gelir — bir kez gösterip bir daha göstermeyiz.
      setCreatedKey(body as CreatedKeyResponse);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.plaintext);
      setCopied(true);
      toast('Anahtar panoya kopyalandı', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Kopyalanamadı — anahtarı elle seçip kopyalayın', 'error');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`${KEYS_URL}/${revokeTarget.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Anahtar iptal edilemedi');
      toast('Anahtar iptal edildi', 'success');
      setRevokeTarget(null);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <section
      className="rounded-2xl border"
      style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
    >
      <div className="flex items-center justify-between gap-3 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
          >
            <KeyRound className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
              API Anahtarları
            </h3>
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              Push ve dosya kanalları bu anahtarlarla kimlik doğrular. Anahtar yalnız üretim anında bir kez gösterilir.
            </p>
          </div>
        </div>
        <button onClick={() => setCreateOpen(true)} className="k-btn k-btn-primary k-btn-sm">
          <Plus className="h-3.5 w-3.5" /> Yeni Anahtar
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>
          Yükleniyor…
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</p>
          <button onClick={refresh} className="k-btn k-btn-ghost k-btn-sm mt-3">
            <RefreshCw className="h-3.5 w-3.5" /> Tekrar Dene
          </button>
        </div>
      ) : keys.length === 0 ? (
        <div className="p-10 text-center">
          <KeyRound className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--k-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--k-text-primary)' }}>Henüz API anahtarı yok</p>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--k-text-muted)' }}>
            {'İK sisteminizin bağlanabilmesi için "Yeni Anahtar" ile bir anahtar üretin.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface-hover)' }}>
                {['Anahtar', 'Durum', 'Son Kullanım', 'Geçerlilik', 'Oluşturma', ''].map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--k-text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const status = keyStatus(key);
                const meta = STATUS_BADGE[status];
                return (
                  <tr key={key.id} style={{ borderBottom: '1px solid var(--k-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--k-text-primary)' }}>{key.name}</div>
                      <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--k-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {key.keyPrefix}…
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`k-badge ${meta.badge}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>
                      {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'Hiç kullanılmadı'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>
                      {key.expiresAt ? formatDateTime(key.expiresAt) : 'Süresiz'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>
                      {formatDateTime(key.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status !== 'revoked' && (
                        <button
                          onClick={() => setRevokeTarget(key)}
                          className="k-btn k-btn-ghost k-btn-sm"
                          style={{ color: 'var(--k-error)' }}
                        >
                          <Ban className="h-3.5 w-3.5" /> İptal Et
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Yeni anahtar oluşturma */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display, system-ui)' }}>Yeni API Anahtarı</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div>
              <Label
                htmlFor="key-name"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--k-text-muted)' }}
              >
                Anahtar Adı
              </Label>
              <Input
                id="key-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="örn. HBYS gecelik senkron"
                maxLength={100}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="h-10 rounded-xl text-[13px]"
                style={{ background: 'var(--k-surface-hover)', borderColor: 'var(--k-border)' }}
              />
            </div>
            <div>
              <Label
                htmlFor="key-expiry"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--k-text-muted)' }}
              >
                Bitiş Tarihi (opsiyonel)
              </Label>
              <Input
                id="key-expiry"
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="h-10 rounded-xl text-[13px]"
                style={{ background: 'var(--k-surface-hover)', borderColor: 'var(--k-border)' }}
              />
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                Boş bırakılırsa anahtar süresiz geçerli olur.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setCreateOpen(false)} disabled={creating} className="k-btn k-btn-ghost">
              İptal
            </button>
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="k-btn k-btn-primary">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? 'Üretiliyor…' : 'Anahtar Üret'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plaintext — YALNIZ bir kez gösterilir */}
      <Dialog open={!!createdKey} onOpenChange={(open) => !open && setCreatedKey(null)}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display, system-ui)' }}>Anahtar Hazır</DialogTitle>
          </DialogHeader>
          <div
            className="flex items-start gap-2 rounded-xl p-3 text-[12.5px] leading-snug"
            style={{ background: 'var(--k-warning-bg)', color: 'var(--k-warning)', border: '1px solid var(--k-warning)' }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Bu anahtar bir daha gösterilmeyecek.</strong> Şimdi kopyalayıp güvenli bir yerde
              saklayın — kaybederseniz yeni anahtar üretmeniz gerekir.
            </span>
          </div>
          {createdKey && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                {createdKey.name}
              </p>
              <div
                className="flex items-center gap-2 rounded-xl p-3"
                style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
              >
                <code
                  className="min-w-0 flex-1 text-[12px] break-all"
                  style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {createdKey.plaintext}
                </code>
                <button
                  onClick={handleCopy}
                  className="k-btn k-btn-ghost k-btn-sm shrink-0"
                  aria-label="Anahtarı kopyala"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" style={{ color: 'var(--k-success)' }} />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setCreatedKey(null)} className="k-btn k-btn-primary">
              Kaydettim, Kapat
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke onayı — tarayıcı confirm() değil, mevcut Dialog deseni */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display, system-ui)' }}>Anahtar iptal edilsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--k-text-secondary)' }}>
            <strong style={{ color: 'var(--k-text-primary)' }}>{revokeTarget?.name}</strong>{' '}
            <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>({revokeTarget?.keyPrefix}…)</span>{' '}
            anahtarı kalıcı olarak iptal edilecek. Bu anahtarı kullanan İK sistemi bağlantısı kesilir.
            Bu işlem geri alınamaz.
          </p>
          <DialogFooter className="gap-2">
            <button onClick={() => setRevokeTarget(null)} disabled={revoking} className="k-btn k-btn-ghost">
              Vazgeç
            </button>
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="k-btn"
              style={{ background: 'var(--k-error)', color: '#fff' }}
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {revoking ? 'İptal ediliyor…' : 'Evet, İptal Et'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
