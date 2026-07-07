'use client';

import { useState } from 'react';
import {
  ArrowDownToLine,
  Save,
  Loader2,
  PlugZap,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateFetchCache } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { ToggleSwitch } from './toggle-switch';
import {
  type IntegrationConfig,
  type PullAuthTypeValue,
  type PaginationStyle,
  type PullPagination,
  type TestConnectionResult,
  maskValue,
} from './types';

const AUTH_LABELS: Record<PullAuthTypeValue, string> = {
  bearer: 'Bearer token',
  basic: 'Basic (kullanıcı adı + parola)',
  header_key: 'Özel header anahtarı',
};

const PAGINATION_LABELS: Record<PaginationStyle, string> = {
  page: 'Sayfa numarası (page)',
  offset: 'Offset / limit',
  cursor: 'Cursor (imleç)',
};

const fieldLabelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider';
const fieldLabelStyle = { color: 'var(--k-text-muted)' };
const inputCls = 'h-10 rounded-xl text-[13px]';
const inputStyle = { background: 'var(--k-surface-hover)', borderColor: 'var(--k-border)' };

export function PullSettingsTab({
  config,
  onSaved,
}: {
  /** pull kanalının mevcut config'i (yoksa undefined). */
  config: IntegrationConfig | undefined;
  onSaved: () => void;
}) {
  return (
    // Kaydet + refetch sonrası form sunucu durumuyla remount olur (effect'siz senkron);
    // credential inputları da böylece otomatik temizlenir.
    <PullSettingsForm key={config ? `cfg:${config.updatedAt}` : 'new'} config={config} onSaved={onSaved} />
  );
}

function PullSettingsForm({
  config,
  onSaved,
}: {
  config: IntegrationConfig | undefined;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const [baseUrl, setBaseUrl] = useState(config?.pullBaseUrl ?? '');
  const [authType, setAuthType] = useState<PullAuthTypeValue>(config?.pullAuthType ?? 'bearer');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [headerName, setHeaderName] = useState('');
  const [headerKey, setHeaderKey] = useState('');
  const [intervalMin, setIntervalMin] = useState(
    config?.pullIntervalMinutes ? String(config.pullIntervalMinutes) : '60',
  );
  const [usePagination, setUsePagination] = useState(config?.pullPagination != null);
  const [pagStyle, setPagStyle] = useState<PaginationStyle>(config?.pullPagination?.style ?? 'page');
  const [pageParam, setPageParam] = useState(config?.pullPagination?.pageParam ?? '');
  const [sizeParam, setSizeParam] = useState(config?.pullPagination?.sizeParam ?? '');
  const [pageSize, setPageSize] = useState(
    config?.pullPagination?.pageSize ? String(config.pullPagination.pageSize) : '',
  );
  const [itemsPath, setItemsPath] = useState(config?.pullPagination?.itemsPath ?? '');
  const [cursorPath, setCursorPath] = useState(config?.pullPagination?.cursorPath ?? '');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const credentialsSet = config?.pullCredentialsSet ?? false;

  /** Girilen credential alanlarından PUT gövdesi üretir; hiçbiri girilmediyse null (mevcut korunur). */
  const buildCredentials = ():
    | { token: string }
    | { username: string; password: string }
    | { headerName: string; key: string }
    | null
    | 'incomplete' => {
    if (authType === 'bearer') {
      if (!token.trim()) return null;
      return { token: token.trim() };
    }
    if (authType === 'basic') {
      if (!username.trim() && !password.trim()) return null;
      if (!username.trim() || !password.trim()) return 'incomplete';
      return { username: username.trim(), password: password.trim() };
    }
    if (!headerName.trim() && !headerKey.trim()) return null;
    if (!headerName.trim() || !headerKey.trim()) return 'incomplete';
    return { headerName: headerName.trim(), key: headerKey.trim() };
  };

  const handleSave = async () => {
    const url = baseUrl.trim();
    if (url && !url.startsWith('https://')) {
      toast('Pull adresi https:// ile başlamalıdır', 'error');
      return;
    }
    const intervalNum = Number(intervalMin);
    if (!Number.isInteger(intervalNum) || intervalNum < 15 || intervalNum > 1440) {
      toast('Sorgu aralığı 15 ile 1440 dakika arasında olmalıdır', 'error');
      return;
    }
    const credentials = buildCredentials();
    if (credentials === 'incomplete') {
      toast('Kimlik bilgisi alanlarını eksiksiz doldurun veya tümünü boş bırakın', 'error');
      return;
    }

    let pullPagination: PullPagination | null = null;
    if (usePagination) {
      const sizeNum = pageSize.trim() === '' ? undefined : Number(pageSize);
      if (sizeNum !== undefined && (!Number.isInteger(sizeNum) || sizeNum < 1 || sizeNum > 1000)) {
        toast('Sayfa boyutu 1 ile 1000 arasında olmalıdır', 'error');
        return;
      }
      pullPagination = {
        style: pagStyle,
        ...(pageParam.trim() ? { pageParam: pageParam.trim() } : {}),
        ...(sizeParam.trim() ? { sizeParam: sizeParam.trim() } : {}),
        ...(sizeNum !== undefined ? { pageSize: sizeNum } : {}),
        ...(itemsPath.trim() ? { itemsPath: itemsPath.trim() } : {}),
        ...(pagStyle === 'cursor' && cursorPath.trim() ? { cursorPath: cursorPath.trim() } : {}),
      };
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'pull',
          ...(url ? { pullBaseUrl: url } : {}),
          pullAuthType: authType,
          // Boş bırakıldıysa gönderilmez → sunucudaki şifreli değer KORUNUR.
          ...(credentials ? { pullCredentials: credentials } : {}),
          pullIntervalMinutes: intervalNum,
          pullPagination,
          // Kanal henüz yapılandırılmamışsa bağlantı kaydı kanalı yanlışlıkla aktifleştirmesin.
          ...(config ? {} : { isActive: false }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Pull ayarları kaydedilemedi');
      toast('Pull ayarları kaydedildi', 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/integration/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        toast(body.error || 'Pull yapılandırması bulunamadı — önce ayarları kaydedin', 'error');
        return;
      }
      if (!res.ok) throw new Error(body.error || 'Bağlantı testi başarısız');
      setTestResult(body as TestConnectionResult);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/integration/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'pull', dryRun }),
      });
      if (res.status === 404) {
        toast('Özellik hazırlanıyor', 'info');
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Senkron koşusu başlatılamadı');
      toast(
        dryRun
          ? 'Deneme koşusu başlatıldı — sonucu Geçmiş sekmesinden izleyebilirsiniz'
          : 'Senkron koşusu başlatıldı — sonucu Geçmiş sekmesinden izleyebilirsiniz',
        'success',
      );
      invalidateFetchCache('/api/admin/integration/runs');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl border"
        style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
      >
        <div className="flex items-center gap-3 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
          >
            <ArrowDownToLine className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
              Pull Bağlantı Ayarları
            </h3>
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              {"İK API'nizin adresi, kimlik doğrulaması ve sorgu aralığı."}
            </p>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="pull-base-url" className={fieldLabelCls} style={fieldLabelStyle}>
                API Adresi (https)
              </Label>
              <Input
                id="pull-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://hbys.hastane.com/api/personel"
                maxLength={500}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <Label htmlFor="pull-interval" className={fieldLabelCls} style={fieldLabelStyle}>
                Sorgu Aralığı (dakika)
              </Label>
              <Input
                id="pull-interval"
                type="number"
                min={15}
                max={1440}
                value={intervalMin}
                onChange={(e) => setIntervalMin(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                En az 15, en fazla 1440 dakika (24 saat).
              </p>
            </div>
          </div>

          {/* Kimlik doğrulama */}
          <div
            className="space-y-4 rounded-xl p-4"
            style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                Kimlik Doğrulama
              </span>
              {credentialsSet && (
                <span className="k-badge k-badge-success">
                  <ShieldCheck className="h-3 w-3" /> Kayıtlı ••••••
                </span>
              )}
            </div>

            <div>
              <Label htmlFor="pull-auth-type" className={fieldLabelCls} style={fieldLabelStyle}>
                Doğrulama Tipi
              </Label>
              <select
                id="pull-auth-type"
                className="k-input w-full md:w-1/2"
                style={{ background: 'var(--k-surface)' }}
                value={authType}
                onChange={(e) => setAuthType(e.target.value as PullAuthTypeValue)}
              >
                {(Object.keys(AUTH_LABELS) as PullAuthTypeValue[]).map((t) => (
                  <option key={t} value={t}>
                    {AUTH_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {authType === 'bearer' && (
              <div>
                <Label htmlFor="pull-token" className={fieldLabelCls} style={fieldLabelStyle}>
                  Token
                </Label>
                <Input
                  id="pull-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={credentialsSet ? '•••••• (değiştirmek için yeni token girin)' : 'Bearer token'}
                  maxLength={1000}
                  autoComplete="off"
                  className={inputCls}
                  style={{ ...inputStyle, background: 'var(--k-surface)' }}
                />
              </div>
            )}

            {authType === 'basic' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="pull-username" className={fieldLabelCls} style={fieldLabelStyle}>
                    Kullanıcı Adı
                  </Label>
                  <Input
                    id="pull-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={credentialsSet ? '•••••• (değiştirmek için doldurun)' : 'Kullanıcı adı'}
                    maxLength={255}
                    autoComplete="off"
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
                <div>
                  <Label htmlFor="pull-password" className={fieldLabelCls} style={fieldLabelStyle}>
                    Parola
                  </Label>
                  <Input
                    id="pull-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={credentialsSet ? '••••••' : 'Parola'}
                    maxLength={255}
                    autoComplete="new-password"
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
              </div>
            )}

            {authType === 'header_key' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="pull-header-name" className={fieldLabelCls} style={fieldLabelStyle}>
                    Header Adı
                  </Label>
                  <Input
                    id="pull-header-name"
                    value={headerName}
                    onChange={(e) => setHeaderName(e.target.value)}
                    placeholder="X-Api-Key"
                    maxLength={100}
                    autoComplete="off"
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
                <div>
                  <Label htmlFor="pull-header-key" className={fieldLabelCls} style={fieldLabelStyle}>
                    Anahtar Değeri
                  </Label>
                  <Input
                    id="pull-header-key"
                    type="password"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    placeholder={credentialsSet ? '•••••• (değiştirmek için doldurun)' : 'Anahtar'}
                    maxLength={1000}
                    autoComplete="off"
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
              </div>
            )}

            {credentialsSet && (
              <p className="text-[11.5px] leading-snug" style={{ color: 'var(--k-text-muted)' }}>
                Kayıtlı kimlik bilgisi güvenlik gereği gösterilmez. Alanları boş bırakırsanız
                mevcut kimlik bilgisi korunur; yalnız değiştirmek için doldurun.
              </p>
            )}
          </div>

          {/* Sayfalama */}
          <div
            className="space-y-4 rounded-xl p-4"
            style={{ background: 'var(--k-surface-hover)', border: '1px solid var(--k-border)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                  Sayfalama
                </span>
                <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--k-text-muted)' }}>
                  Karşı API personel listesini sayfalı dönüyorsa etkinleştirin.
                </p>
              </div>
              <ToggleSwitch checked={usePagination} onChange={setUsePagination} label="Sayfalama kullan" />
            </div>

            {usePagination && (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="pag-style" className={fieldLabelCls} style={fieldLabelStyle}>
                    Stil
                  </Label>
                  <select
                    id="pag-style"
                    className="k-input w-full"
                    style={{ background: 'var(--k-surface)' }}
                    value={pagStyle}
                    onChange={(e) => setPagStyle(e.target.value as PaginationStyle)}
                  >
                    {(Object.keys(PAGINATION_LABELS) as PaginationStyle[]).map((s) => (
                      <option key={s} value={s}>
                        {PAGINATION_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="pag-page-size" className={fieldLabelCls} style={fieldLabelStyle}>
                    Sayfa Boyutu
                  </Label>
                  <Input
                    id="pag-page-size"
                    type="number"
                    min={1}
                    max={1000}
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    placeholder="100"
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
                <div>
                  <Label htmlFor="pag-items-path" className={fieldLabelCls} style={fieldLabelStyle}>
                    Kayıt Listesi Yolu
                  </Label>
                  <Input
                    id="pag-items-path"
                    value={itemsPath}
                    onChange={(e) => setItemsPath(e.target.value)}
                    placeholder="data.items"
                    maxLength={200}
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
                <div>
                  <Label htmlFor="pag-page-param" className={fieldLabelCls} style={fieldLabelStyle}>
                    Sayfa Parametresi
                  </Label>
                  <Input
                    id="pag-page-param"
                    value={pageParam}
                    onChange={(e) => setPageParam(e.target.value)}
                    placeholder={pagStyle === 'offset' ? 'offset' : 'page'}
                    maxLength={50}
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
                <div>
                  <Label htmlFor="pag-size-param" className={fieldLabelCls} style={fieldLabelStyle}>
                    Boyut Parametresi
                  </Label>
                  <Input
                    id="pag-size-param"
                    value={sizeParam}
                    onChange={(e) => setSizeParam(e.target.value)}
                    placeholder={pagStyle === 'offset' ? 'limit' : 'pageSize'}
                    maxLength={50}
                    className={inputCls}
                    style={{ ...inputStyle, background: 'var(--k-surface)' }}
                  />
                </div>
                {pagStyle === 'cursor' && (
                  <div>
                    <Label htmlFor="pag-cursor-path" className={fieldLabelCls} style={fieldLabelStyle}>
                      Cursor Yolu
                    </Label>
                    <Input
                      id="pag-cursor-path"
                      value={cursorPath}
                      onChange={(e) => setCursorPath(e.target.value)}
                      placeholder="meta.nextCursor"
                      maxLength={200}
                      className={inputCls}
                      style={{ ...inputStyle, background: 'var(--k-surface)' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Eylemler */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-5"
          style={{ borderTop: '1px solid var(--k-border)' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleTest} disabled={testing || saving} className="k-btn k-btn-ghost">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              {testing ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={handleRunNow} disabled={running || saving} className="k-btn k-btn-subtle">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                {running ? 'Başlatılıyor…' : 'Şimdi Çalıştır'}
              </button>
              <ToggleSwitch checked={dryRun} onChange={setDryRun} label="Deneme modu (dry-run)" />
              <span className="text-[11.5px]" style={{ color: 'var(--k-text-muted)' }}>
                Deneme (dry-run) — değişiklik uygulanmaz
              </span>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="k-btn k-btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </section>

      {/* Test sonucu */}
      {testResult && (
        <section
          className="rounded-2xl border"
          style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
        >
          <div className="flex items-center gap-2 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
            {testResult.ok ? (
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--k-success)' }} />
            ) : (
              <XCircle className="h-5 w-5" style={{ color: 'var(--k-error)' }} />
            )}
            <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
              {testResult.ok ? 'Bağlantı başarılı' : 'Bağlantı başarısız'}
            </h3>
            {testResult.ok && typeof testResult.totalFetched === 'number' && (
              <span className="k-badge k-badge-info">
                {testResult.totalFetched} kayıt{testResult.truncated ? ' (kısaltıldı)' : ''}
              </span>
            )}
          </div>

          <div className="p-5">
            {!testResult.ok ? (
              <p className="text-[13px]" style={{ color: 'var(--k-error)' }}>
                {testResult.message || 'Karşı sistemden geçerli yanıt alınamadı.'}
              </p>
            ) : (
              <div className="space-y-4">
                {testResult.sampleFields && testResult.sampleFields.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                      Bulunan Alanlar
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {testResult.sampleFields.map((f) => (
                        <span
                          key={f}
                          className="rounded-full px-2.5 py-1 text-[11px]"
                          style={{
                            background: 'var(--k-surface-hover)',
                            border: '1px solid var(--k-border)',
                            color: 'var(--k-text-secondary)',
                            fontFamily: 'var(--font-mono, monospace)',
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {testResult.sampleRows && testResult.sampleRows.length > 0 && testResult.sampleFields && (
                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--k-border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--k-surface-hover)', borderBottom: '1px solid var(--k-border)' }}>
                          {testResult.sampleFields.map((f) => (
                            <th
                              key={f}
                              className="px-3 py-2 text-left text-[11px] font-semibold"
                              style={{ color: 'var(--k-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}
                            >
                              {f}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testResult.sampleRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--k-border)' }}>
                            {testResult.sampleFields?.map((f) => (
                              <td key={f} className="px-3 py-2 text-[12px]" style={{ color: 'var(--k-text-secondary)' }}>
                                {maskValue(row[f])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                  Örnek satırlar KVKK gereği maskeli gösterilir.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
