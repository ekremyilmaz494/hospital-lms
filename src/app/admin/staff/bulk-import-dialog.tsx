'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, FileText, RefreshCw, KeyRound, Eye, EyeOff, FileDown, Copy, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BRAND } from '@/lib/brand';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton, type PremiumModalStep } from '@/components/shared/premium-modal';

// ── Klinova palette ──
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2', ERROR_TEXT: '#b91c1c',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

type Stage = 'idle' | 'uploading' | 'preview' | 'importing' | 'done';

interface ParsedRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  title: string;
  // TC Kimlik No — direct (şifreli) modda zorunlu, invite modda opsiyonel.
  // Sadece bu request'in lifetime'ında plaintext; server tarafında AES-GCM şifreli kaydedilir.
  tcKimlik: string;
  deptId?: string;
  deptName: string;
  deptMatch: 'exact' | 'fuzzy' | 'ambiguous' | 'none' | 'empty';
  deptCandidates?: Array<{ id: string; name: string }>;
  // Alt departman (opsiyonel)
  subDeptId?: string;
  subDeptName: string;
  subDeptMatch: 'exact' | 'fuzzy' | 'ambiguous' | 'none' | 'empty' | 'mismatch' | 'auto-create';
  subDeptCandidates?: Array<{ id: string; name: string }>;
}

interface RowResult {
  rowIndex: number;
  email: string;
  status: 'ok' | 'error';
  reason?: string;
}

interface PreviewResult {
  preview: true;
  total: number;
  valid: number;
  errors: number;
  rows: RowResult[];
  parsedRows: ParsedRow[];
  unknownHeaders?: string[];
}

interface ImportRowResult {
  email: string;
  name: string;
  status: 'created' | 'failed';
  tempPassword?: string;
  tcKimlik?: string;
  department?: string | null;
  title?: string | null;
  error?: string;
}

interface ImportResult {
  created: number;
  failed: number;
  total: number;
  errors: string[];
  results: ImportRowResult[];
}

interface Department {
  id: string;
  name: string;
  parentId?: string | null;
}

export function BulkImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [editedRows, setEditedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [skipErrors, setSkipErrors] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/departments')
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) setDepartments(data as Department[]);
      })
      .catch(() => setDepartments([]));
  }, [open]);

  const reset = useCallback(() => {
    setStage('idle');
    setPreview(null);
    setEditedRows([]);
    setImportResult(null);
  }, []);

  const handleClose = () => {
    if (stage === 'uploading' || stage === 'importing') return;
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/admin/bulk-import/template');
      if (!res.ok) throw new Error('Şablon indirilemedi');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'personel-import-sablonu.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Şablon indirildi', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Şablon indirilemedi', 'error');
    }
  };

  const handleFileSelect = async (selected: File) => {
    setStage('uploading');
    try {
      const formData = new FormData();
      formData.append('file', selected);
      const res = await fetch('/api/admin/bulk-import?mode=preview', { method: 'POST', body: formData });
      const result: PreviewResult | { error: string } = await res.json();
      if (!res.ok || !('preview' in result)) {
        throw new Error('error' in result ? result.error : 'Önizleme başarısız');
      }
      setPreview(result);
      setEditedRows(result.parsedRows);
      setStage('preview');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dosya okunamadı', 'error');
      reset();
    }
  };

  const revalidate = async () => {
    setStage('uploading');
    try {
      const res = await fetch('/api/admin/bulk-import?mode=preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: editedRows }),
      });
      const result: PreviewResult | { error: string } = await res.json();
      if (!res.ok || !('preview' in result)) {
        throw new Error('error' in result ? result.error : 'Doğrulama başarısız');
      }
      setPreview(result);
      setEditedRows(result.parsedRows);
      setStage('preview');
      toast('Satırlar tekrar doğrulandı', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Doğrulama başarısız', 'error');
      setStage('preview');
    }
  };

  const handleConfirmImport = async () => {
    setStage('importing');
    try {
      const res = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: editedRows }),
      });
      const result: ImportResult | { error: string } = await res.json();
      if ('error' in result) throw new Error(result.error);
      setImportResult(result as ImportResult);
      setStage('done');
      if ((result as ImportResult).created > 0) {
        toast(`${(result as ImportResult).created} personel eklendi`, 'success');
        onImported();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import başarısız', 'error');
      setStage('preview');
    }
  };

  const updateRow = (idx: number, patch: Partial<ParsedRow>) => {
    setEditedRows(rows => {
      const next = [...rows];
      next[idx] = { ...next[idx], ...patch };
      if ('deptId' in patch) {
        const dept = departments.find(d => d.id === patch.deptId);
        next[idx].deptName = dept?.name || '';
        next[idx].deptMatch = patch.deptId ? 'exact' : 'empty';
        // Üst departman değişince alt departman geçersiz olabilir → temizle
        const sub = next[idx].subDeptId ? departments.find(d => d.id === next[idx].subDeptId) : undefined;
        if (sub && sub.parentId !== patch.deptId) {
          next[idx].subDeptId = undefined;
          next[idx].subDeptName = '';
          next[idx].subDeptMatch = 'empty';
        }
      }
      if ('subDeptId' in patch) {
        const sub = departments.find(d => d.id === patch.subDeptId);
        next[idx].subDeptName = sub?.name || '';
        next[idx].subDeptMatch = patch.subDeptId ? 'exact' : 'empty';
      }
      // Alt departman serbest metin: yazılan ad parent'ın çocukları arasında varsa
      // ID'ye bağla (exact), yoksa auto-create işaretle (import'ta yaratılır).
      if ('subDeptName' in patch && !('subDeptId' in patch)) {
        const name = (patch.subDeptName || '').trim();
        const parentId = next[idx].deptId;
        if (!name) {
          next[idx].subDeptId = undefined;
          next[idx].subDeptMatch = 'empty';
        } else if (!parentId) {
          // Parent yoksa serbest yaz, validation departman zorunlu der
          next[idx].subDeptId = undefined;
          next[idx].subDeptMatch = 'none';
        } else {
          const hit = departments.find(
            d => d.parentId === parentId && d.name.toLowerCase() === name.toLowerCase(),
          );
          next[idx].subDeptId = hit?.id;
          next[idx].subDeptMatch = hit ? 'exact' : 'auto-create';
        }
      }
      return next;
    });
  };


  const downloadErrorReport = async () => {
    if (!importResult) return;
    const failedRows = importResult.results.filter(r => r.status === 'failed');
    if (failedRows.length === 0) return;

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = `${BRAND.fullName} LMS`;
    const sheet = wb.addWorksheet('Yüklenmeyen Personeller');

    sheet.columns = [
      { header: 'Sıra',              key: 'no',    width: 6 },
      { header: 'Ad Soyad',          key: 'name',  width: 28 },
      { header: 'E-posta',           key: 'email', width: 32 },
      { header: 'Hatanın Sebebi',    key: 'error', width: 42 },
      { header: 'Nasıl Düzeltilir?', key: 'hint',  width: 55 },
    ];
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    const hintFor = (error: string): string => {
      const e = error.toLowerCase();
      if (e.includes('zaten kayıtlı') || e.includes('zaten mevcut')) return 'Bu e-posta zaten sistemde var. Personeller listesinde kontrol edin veya farklı e-posta kullanın.';
      if (e.includes('geçersiz e-posta') || e.includes('türkçe karakter') || e.includes('invalid')) return 'E-posta adresini kontrol edin. "ali@kurum.com" gibi Türkçe karakter içermeyen bir format olmalı.';
      if (e.includes('şifre')) return 'Şifre en az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli. Boş bırakırsanız sistem üretir.';
      if (e.includes('alt departman') && e.includes('altında değil')) return 'Yazdığınız alt departman, seçilen üst departmanın altında değil. "Alt Departmanlar" sayfasındaki "Üst > Alt" kombinasyonlarını kontrol edin.';
      if (e.includes('alt departman bulunamadı')) return 'Bu alt departman sistemde yok. /admin/staff sayfasından oluşturun veya Excel\'de doğru adı yazın.';
      if (e.includes('departman zorunludur') || e.includes('departman bulunamadı')) return 'Departman alanı zorunlu. /admin/staff sayfasından bir kök departman oluşturun ve Excel\'de tam adını yazın.';
      if (e.includes('departman')) return 'Bu departman sistemde yok. /admin/staff sayfasından oluşturun ve Excel\'de tam adını yazın.';
      return 'Excel dosyasında bu satırı düzeltip tekrar yükleyin.';
    };

    failedRows.forEach((r, i) => {
      sheet.addRow({
        no: i + 1, name: r.name, email: r.email,
        error: r.error || 'Bilinmeyen hata', hint: hintFor(r.error || ''),
      });
    });
    for (let rowIdx = 2; rowIdx <= failedRows.length + 1; rowIdx++) {
      const row = sheet.getRow(rowIdx);
      row.alignment = { vertical: 'top', wrapText: true };
      row.height = 50;
      row.getCell(4).font = { color: { argb: 'FFDC2626' }, bold: true };
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `E${failedRows.length + 1}` };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hata-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const errorByRowIndex = useMemo(
    () => new Map(preview?.rows.filter(r => r.status === 'error').map(r => [r.rowIndex, r.reason]) ?? []),
    [preview]
  );
  const errorCount = preview?.errors ?? 0;
  const validCount = preview?.valid ?? 0;
  const canImport = !!preview && validCount > 0 && (skipErrors || errorCount === 0);

  // Step rail — 3-step wizard, visual progress
  const activeStepId: 'upload' | 'review' | 'done' =
    stage === 'idle' || stage === 'uploading' ? 'upload' :
    stage === 'preview' || stage === 'importing' ? 'review' : 'done';

  const steps: PremiumModalStep[] = [
    { id: 'upload', label: 'Dosya', caption: 'Excel yükle', complete: activeStepId !== 'upload' },
    { id: 'review', label: 'İnceleme', caption: 'Doğrula ve düzenle', complete: activeStepId === 'done' },
    { id: 'done', label: 'Sonuç', caption: 'Özet', complete: false },
  ];

  const subtitle = (() => {
    if (stage === 'idle') return 'Excel\'le hesapları aç, şifreleri PDF olarak teslim et.';
    if (stage === 'uploading') return 'Dosya doğrulanıyor…';
    if (stage === 'preview') return `${preview?.total ?? 0} satır okundu — düzenleyip onayla.`;
    if (stage === 'importing') return 'Hesaplar açılıyor, hoş geldin maili gönderiliyor…';
    return 'Hesaplar açıldı — şifreler aşağıda.';
  })();

  const footer = (() => {
    if (stage === 'preview') {
      return (
        <PremiumModalFooter
          summary={
            <span>
              <strong style={{ color: K.PRIMARY }}>{validCount.toString().padStart(2, '0')}</strong> geçerli
              {errorCount > 0 && <> · <strong style={{ color: K.ERROR_TEXT }}>{errorCount.toString().padStart(2, '0')}</strong> hatalı</>}
            </span>
          }
          actions={
            <>
              <PremiumButton variant="ghost" onClick={revalidate} icon={<RefreshCw className="h-4 w-4" />}>
                Tekrar Doğrula
              </PremiumButton>
              <PremiumButton variant="outline" onClick={reset}>Farklı Dosya</PremiumButton>
              <PremiumButton
                onClick={handleConfirmImport}
                disabled={!canImport}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                {validCount > 0 ? `${validCount} Personeli Ekle` : 'Yüklenecek Satır Yok'}
              </PremiumButton>
            </>
          }
        />
      );
    }
    if (stage === 'done') {
      return (
        <PremiumModalFooter
          actions={
            <>
              <PremiumButton variant="ghost" onClick={reset}>Yeni Dosya Yükle</PremiumButton>
              <PremiumButton onClick={handleClose}>Kapat</PremiumButton>
            </>
          }
        />
      );
    }
    if (stage === 'idle') {
      return (
        <PremiumModalFooter
          actions={<PremiumButton variant="ghost" onClick={handleClose}>İptal</PremiumButton>}
        />
      );
    }
    return null;
  })();

  return (
    <PremiumModal
      isOpen={open}
      onClose={handleClose}
      eyebrow="Toplu İşlem"
      title="Personel Yüklemesi"
      subtitle={subtitle}
      size="2xl"
      steps={steps}
      activeStep={activeStepId}
      disableEscape={stage === 'uploading' || stage === 'importing'}
      footer={footer}
    >
      {stage === 'idle' && (
        <div className="bid-idle">
          <div
            className="bid-drop"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileSelect(f);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          >
            <div className="bid-drop-icon">
              <Upload className="h-7 w-7" />
            </div>
            <h4>Excel dosyası bırak</h4>
            <p>Tıkla ve seç ya da dosyayı buraya sürükle. .xlsx veya .xls — maksimum 10 MB.</p>
            <input
              ref={fileInputRef} type="file" accept=".xlsx,.xls" className="bid-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = '';
              }}
            />
          </div>

          <aside className="bid-template">
            <div className="bid-template-icon">
              <FileText className="h-4 w-4" />
            </div>
            <div className="bid-template-body">
              <h5>Şablon ile başla</h5>
              <p>Başlıklar esnek: <em>Ad/İsim</em>, <em>Soyad</em>, <em>TC Kimlik</em>, <em>E-posta/Email/Mail</em>, <em>Şifre</em>, <em>Departman/Bölüm</em> — hepsi tanınır.</p>
              <p className="bid-template-mode">
                <strong>Zorunlu:</strong> Ad, Soyad, TC.
                <strong>E-posta opsiyonel</strong> — boşsa personel TC + şifreyle giriş yapar.
                <KeyRound className="h-3 w-3" />
                <strong>Şifre boşsa</strong> sistem üretir.
                <FileDown className="h-3 w-3" />
                Yükleme sonrası tüm şifreler <strong>PDF olarak</strong> indirilebilir.
              </p>
              <button type="button" onClick={downloadTemplate} className="bid-template-btn">
                <Download className="h-3.5 w-3.5" />
                Şablonu indir (.xlsx)
              </button>
            </div>
          </aside>
        </div>
      )}

      {stage === 'uploading' && (
        <div className="bid-status">
          <Loader2 className="bid-spin" />
          <h4>Dosya doğrulanıyor…</h4>
          <p>Excel satırları okunuyor ve departmanlarla eşleştiriliyor.</p>
        </div>
      )}

      {stage === 'preview' && preview && (
        <div className="bid-review">
          <div className="bid-stats">
            <StatTile label="Toplam" value={preview.total} tone="neutral" />
            <StatTile label="Geçerli" value={validCount} tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
            <StatTile label="Hatalı" value={errorCount} tone="err" icon={<AlertCircle className="h-3.5 w-3.5" />} />
          </div>

          {preview.unknownHeaders && preview.unknownHeaders.length > 0 && (
            <div className="bid-warn">
              <AlertCircle className="h-4 w-4" />
              <div>
                <strong>Tanınmayan sütunlar:</strong> {preview.unknownHeaders.join(', ')} — atlandı.
              </div>
            </div>
          )}

          <div className="bid-table-wrap">
            <div className="bid-table-scroll">
              <table className="bid-table">
                <colgroup>
                  <col style={{ width: 44 }} />        {/* # */}
                  <col style={{ minWidth: 120 }} />    {/* Ad */}
                  <col style={{ minWidth: 120 }} />    {/* Soyad */}
                  <col style={{ minWidth: 140 }} />    {/* TC Kimlik */}
                  <col style={{ minWidth: 220 }} />    {/* E-posta */}
                  <col style={{ minWidth: 170 }} />    {/* Şifre */}
                  <col style={{ minWidth: 130 }} />    {/* Telefon */}
                  <col style={{ minWidth: 160 }} />    {/* Departman */}
                  <col style={{ minWidth: 160 }} />    {/* Alt Departman */}
                  <col style={{ minWidth: 140 }} />    {/* Unvan */}
                  <col style={{ minWidth: 200 }} />    {/* Durum — eksikti, error metni dikey kırpılıyordu */}
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ad *</th>
                    <th>Soyad *</th>
                    <th title="Resmi denetim ve sertifika eşleşmesi için zorunlu">TC Kimlik *</th>
                    <th title="Boşsa hoş geldin maili atılmaz; personel TC + şifreyle giriş yapar">E-posta</th>
                    <th title="Boş bırakırsanız sistem güvenli geçici şifre üretir">Şifre</th>
                    <th>Telefon</th>
                    <th>Departman *</th>
                    <th>Alt Departman</th>
                    <th>Unvan *</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {editedRows.map((row, idx) => {
                    const err = errorByRowIndex.get(row.rowIndex);
                    const isError = !!err;
                    return (
                      <tr key={idx} className={isError ? 'bid-row-err' : ''}>
                        <td className="bid-rowidx">{row.rowIndex}</td>
                        <td><CellInput value={row.firstName} onChange={(v) => updateRow(idx, { firstName: v })} /></td>
                        <td><CellInput value={row.lastName} onChange={(v) => updateRow(idx, { lastName: v })} /></td>
                        <td>
                          <CellInput
                            value={row.tcKimlik || ''}
                            onChange={(v) => updateRow(idx, { tcKimlik: v.replace(/\D/g, '').slice(0, 11) })}
                          />
                        </td>
                        <td><CellInput value={row.email} onChange={(v) => updateRow(idx, { email: v.toLowerCase() })} /></td>
                        <td>
                          <PasswordCellInput
                            value={row.password}
                            onChange={(v) => updateRow(idx, { password: v })}
                          />
                        </td>
                        <td><CellInput value={row.phone} onChange={(v) => updateRow(idx, { phone: v })} /></td>
                        <td>
                          <select
                            value={row.deptId || ''}
                            onChange={(e) => updateRow(idx, { deptId: e.target.value || undefined })}
                            className={`bid-sel ${row.deptMatch === 'ambiguous' || row.deptMatch === 'none' || row.deptMatch === 'empty' ? 'bid-sel-err' : ''}`}
                          >
                            <option value="">— {row.deptName || 'Seçin'}</option>
                            {departments.filter(d => !d.parentId).map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {/* Alt departman ünvan gibi serbest metin: yazılan ad mevcut child'a uyarsa
                              ID'ye bağlanır, yoksa import sırasında parent altına yaratılır. */}
                          <CellInput
                            value={row.subDeptName}
                            onChange={(v) => updateRow(idx, { subDeptName: v })}
                          />
                        </td>
                        <td><CellInput value={row.title} onChange={(v) => updateRow(idx, { title: v })} /></td>
                        <td>
                          {isError ? (
                            <span className="bid-status-err" title={err}>
                              <AlertCircle className="h-3 w-3" />
                              <span>{err}</span>
                            </span>
                          ) : (
                            <span className="bid-status-ok">
                              <CheckCircle2 className="h-3 w-3" />
                              Geçerli
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {errorCount > 0 && (
            <label className="bid-skip">
              <input
                type="checkbox" checked={skipErrors}
                onChange={(e) => setSkipErrors(e.target.checked)}
              />
              <span>Hatalı satırları atla, <strong>{validCount}</strong> geçerli satırı yükle</span>
            </label>
          )}
        </div>
      )}

      {stage === 'importing' && (
        <div className="bid-status">
          <Loader2 className="bid-spin" />
          <h4>Personeller işleniyor…</h4>
          <p>Hesaplar açılıyor; her satıra geçici şifre üretilip hoş geldin e-postası gönderiliyor. Birkaç saniye sürebilir.</p>
        </div>
      )}

      {stage === 'done' && importResult && (
        <CredentialsResult
          result={importResult}
          onDownloadErrorReport={downloadErrorReport}
        />
      )}

      <style jsx>{`
        /* ── Idle: dropzone + template ── */
        .bid-idle {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 18px;
        }
        @media (max-width: 768px) { .bid-idle { grid-template-columns: 1fr; } }

        .bid-drop {
          border: 1.5px dashed #c9c4be;
          border-radius: 14px;
          padding: 40px 28px;
          background: #ffffff;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          transition: border-color 180ms ease, background 180ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1);
        }
        .bid-drop:hover { border-color: #0d9668; background: #fafaf9; transform: translateY(-1px); }
        .bid-drop-icon {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: #0d9668;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04);
        }
        .bid-drop h4 {
          font-family: var(--font-display, system-ui);
          font-size: 18px;
          font-weight: 700;
          color: #1c1917;
          letter-spacing: -0.005em;
          margin: 0;
        }
        .bid-drop p {
          font-size: 13px;
          color: #78716c;
          max-width: 360px;
          line-height: 1.55;
          margin: 0;
        }
        .bid-file { display: none; }

        .bid-template {
          display: flex;
          gap: 14px;
          padding: 22px;
          border-radius: 14px;
          background: #fafaf9;
          border: 1.5px solid #c9c4be;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04);
        }
        .bid-template-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #d1fae5;
          color: #0d9668;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bid-template-body { flex: 1; }
        .bid-template h5 {
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 700;
          color: #1c1917;
          margin: 0 0 6px;
        }
        .bid-template p { font-size: 12px; color: #78716c; line-height: 1.55; margin: 0 0 10px; }
        .bid-template em { font-style: normal; color: #1c1917; font-weight: 600; }
        .bid-template-mode {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          margin: 0 0 12px !important;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e7e5e4;
          line-height: 1.5 !important;
        }
        .bid-template-mode :global(svg) { color: #0d9668; flex-shrink: 0; }
        .bid-template-mode strong { color: #1c1917; font-weight: 600; }
        .bid-template-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid #c9c4be;
          background: #ffffff;
          font-size: 12px;
          font-weight: 600;
          color: #44403c;
          cursor: pointer;
          font-family: var(--font-display, system-ui);
          transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
        }
        .bid-template-btn:hover { border-color: #0d9668; color: #0d9668; background: #ffffff; }

        /* ── Status panels (uploading / importing) ── */
        .bid-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 60px 30px;
          gap: 14px;
        }
        :global(.bid-spin) {
          width: 36px;
          height: 36px;
          color: #0d9668;
          animation: bid-rot 900ms linear infinite;
        }
        @keyframes bid-rot { to { transform: rotate(360deg); } }
        .bid-status h4 {
          font-family: var(--font-display, system-ui);
          font-size: 18px;
          font-weight: 700;
          color: #1c1917;
          margin: 0;
        }
        .bid-status p {
          font-size: 13px;
          color: #78716c;
          max-width: 420px;
          line-height: 1.55;
          margin: 0;
        }

        /* ── Review stage ── */
        .bid-review { display: flex; flex-direction: column; gap: 14px; }

        .bid-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .bid-done .bid-stats { grid-template-columns: repeat(3, 1fr); }

        /* Mod badge — preview tablosunda satır per satır mod gösterimi */
        .bid-mode {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          font-family: var(--font-display, system-ui);
          white-space: nowrap;
        }
        .bid-mode :global(svg) { flex-shrink: 0; }
        .bid-mode-inv {
          background: #d1fae5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
        .bid-mode-pwd {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
        }

        .bid-warn {
          display: flex;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          color: #92400e;
          font-size: 12px;
          line-height: 1.5;
        }
        .bid-warn :global(svg) { flex-shrink: 0; margin-top: 2px; color: #f59e0b; }
        .bid-warn strong { color: #78350f; }

        .bid-table-wrap {
          border: 1.5px solid #c9c4be;
          border-radius: 14px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04);
        }
        .bid-table-scroll {
          overflow: auto;
          max-height: 460px;
        }
        .bid-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          table-layout: auto;
        }
        .bid-table thead th {
          position: sticky;
          top: 0;
          background: #fafaf9;
          padding: 12px 12px;
          text-align: left;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #78716c;
          border-bottom: 1px solid #e7e5e4;
          white-space: nowrap;
        }
        .bid-table tbody tr { border-top: 1px solid #e7e5e4; }
        .bid-table tbody tr.bid-row-err { background: #fee2e2; }
        .bid-table td {
          padding: 6px 10px;
          vertical-align: middle;
          font-variant-numeric: tabular-nums;
        }
        .bid-rowidx {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #78716c;
          padding-left: 12px;
          font-variant-numeric: tabular-nums;
        }

        .bid-sel {
          width: 100%;
          height: 36px;
          border-radius: 8px;
          border: 1.5px solid #e7e5e4;
          background: #ffffff;
          padding: 0 8px;
          font-size: 13px;
          color: #1c1917;
          font-family: inherit;
        }
        .bid-sel:focus { outline: 2px solid #0d9668; outline-offset: 1px; border-color: #0d9668; }
        .bid-sel-err { border-color: #ef4444; background: #fee2e2; }

        .bid-status-ok, .bid-status-err {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
          white-space: normal;
          word-break: break-word;
        }
        .bid-status-ok { color: #0d9668; }
        .bid-status-err { color: #b91c1c; }
        .bid-status-ok :global(svg), .bid-status-err :global(svg) { flex-shrink: 0; }

        .bid-skip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fafaf9;
          border: 1.5px solid #e7e5e4;
          font-size: 13px;
          color: #1c1917;
          cursor: pointer;
        }
        .bid-skip input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #0d9668;
        }

        /* ── Done stage ── */
        .bid-done { display: flex; flex-direction: column; gap: 18px; }
        .bid-done-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 20px 20px 0;
          gap: 10px;
        }
        .bid-done-icon {
          width: 60px;
          height: 60px;
          border-radius: 999px;
          background: #0d9668;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04);
        }
        .bid-done h3 {
          font-family: var(--font-display, system-ui);
          font-size: 22px;
          font-weight: 700;
          color: #1c1917;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .bid-done h3 em {
          font-style: normal;
          color: #0d9668;
          font-variant-numeric: tabular-nums;
        }
        .bid-done-failed { font-style: normal; color: #b91c1c; font-size: 16px; font-weight: 600; }
        .bid-done p { font-size: 13px; color: #78716c; margin: 0; }

        .bid-err-card {
          display: flex;
          gap: 14px;
          padding: 18px;
          border-radius: 14px;
          background: #fee2e2;
          border: 1.5px solid #fecaca;
        }
        .bid-err-card :global(svg) { flex-shrink: 0; color: #b91c1c; margin-top: 2px; }
        .bid-err-card h5 {
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 700;
          color: #b91c1c;
          margin: 0 0 4px;
        }
        .bid-err-card p { font-size: 12px; color: #44403c; margin: 0 0 10px; line-height: 1.5; }
        .bid-err-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          background: #ef4444;
          color: #fff;
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--font-display, system-ui);
          transition: background 160ms ease;
        }
        .bid-err-btn:hover { background: #b91c1c; }
      `}</style>
    </PremiumModal>
  );
}

function CellInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 text-sm px-2.5"
      style={{ background: K.SURFACE, borderColor: K.BORDER_LIGHT }}
    />
  );
}

/**
 * Şifre hücresi — type="password" varsayılan, göz ikonu ile göster/gizle.
 * Boş bırakılırsa satır invite mode'a düşer (Mod sütunu otomatik DAVET gösterir);
 * doluysa direct mode (ŞİFRE) — backend `validateRows` 8+ karakter kontrol eder.
 */
function PasswordCellInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="bid-pwd-wrap">
      <Input
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Boş = otomatik"
        className="h-9 text-sm pl-2.5 pr-8"
        autoComplete="new-password"
        spellCheck={false}
        style={{ background: K.SURFACE, borderColor: K.BORDER_LIGHT }}
      />
      <button
        type="button"
        className="bid-pwd-eye"
        aria-label={reveal ? 'Şifreyi gizle' : 'Şifreyi göster'}
        onClick={() => setReveal(r => !r)}
        tabIndex={-1}
      >
        {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <style jsx>{`
        .bid-pwd-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .bid-pwd-eye {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: ${K.TEXT_MUTED};
          cursor: pointer;
          border-radius: 6px;
          padding: 0;
        }
        .bid-pwd-eye:hover { color: ${K.PRIMARY}; background: ${K.PRIMARY_LIGHT}; }
      `}</style>
    </div>
  );
}

function StatTile({ label, value, tone, icon }: { label: string; value: number; tone: 'neutral' | 'ok' | 'err'; icon?: React.ReactNode }) {
  const color = tone === 'ok' ? K.PRIMARY : tone === 'err' ? K.ERROR_TEXT : K.TEXT_PRIMARY;
  const bg = tone === 'ok' ? K.PRIMARY_LIGHT : tone === 'err' ? K.ERROR_BG : K.BG;
  return (
    <div className="st-tile">
      <div className="st-head">
        {icon}
        <span>{label}</span>
      </div>
      <div className="st-value">{value.toString().padStart(2, '0')}</div>
      <style jsx>{`
        .st-tile {
          padding: 14px 16px;
          border-radius: 14px;
          background: ${bg};
          border: 1.5px solid ${K.BORDER_LIGHT};
        }
        .st-head {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: ${K.FONT_DISPLAY};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: ${K.TEXT_MUTED};
          margin-bottom: 6px;
        }
        .st-head :global(svg) { color: ${color}; }
        .st-value {
          font-family: ${K.FONT_DISPLAY};
          font-size: 28px;
          font-weight: 700;
          color: ${color};
          line-height: 1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

/**
 * Yükleme sonrası başarılı kayıtların listesini gösterir, geçici şifreyi
 * kopyalama + hepsini PDF olarak indirme aksiyonlarını sunar.
 *
 * KVKK / güvenlik:
 *   - Şifreler DB'de plaintext durmaz; bu ekran sadece response.results'ten gelir
 *     (admin'in oturumu içi). Modal kapanınca state kaybolur, "tekrar göster" yok.
 *   - PDF endpoint (/api/admin/staff/credentials-pdf) TC zorunlu olarak schema'da
 *     refine eder → TC'siz satırlar PDF'e gönderilmeden filtrelenir, kullanıcıya
 *     bilgilendirme banner'ı çıkar.
 */
function CredentialsResult({
  result,
  onDownloadErrorReport,
}: {
  result: ImportResult;
  onDownloadErrorReport: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // TC artık import sırasında zorunlu kılındı; aşağıdaki TC filtresi defensive.
  // Bir gün eski bulk_import audit kayıtları üzerinden replay olursa kırılmasın diye duruyor.
  const successRows = result.results.filter(r => r.status === 'created' && r.tempPassword);
  const pdfReadyRows = successRows.filter(r => r.tcKimlik);
  const noTcCount = successRows.length - pdfReadyRows.length;
  // Welcome mail sadece gerçek email girilmiş satırlara gider; bu sayım hero metninde kullanılır.
  const emailedCount = successRows.filter(r => !!r.email).length;
  const noEmailCount = successRows.length - emailedCount;

  const copyPassword = async (idx: number, password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(c => (c === idx ? null : c)), 1800);
    } catch {
      toast('Şifre kopyalanamadı', 'error');
    }
  };

  const downloadPdf = async () => {
    if (pdfReadyRows.length === 0) {
      toast('PDF için TC bilgisi olan en az bir satır gerekir', 'warning');
      return;
    }
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/staff/credentials-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: pdfReadyRows.map(r => ({
            fullName: r.name,
            tcKimlik: r.tcKimlik!,
            // Boş string zod .email() validasyonunu kıyor → null gönder.
            // Sentetik email'li satırlarda email API tarafında zaten gizleniyor.
            email: r.email && r.email.trim() ? r.email : null,
            tempPassword: r.tempPassword!,
            department: r.department ?? null,
            title: r.title ?? null,
          })),
          maskMode: 'full',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'PDF üretilemedi');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personel-giris-bilgileri-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`${pdfReadyRows.length} kayıtlı PDF indirildi`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF üretilemedi', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="bid-done">
      <div className="bid-done-hero">
        <div className="bid-done-icon">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3>
          <em>{result.created}</em> personel hesabı açıldı
          {result.failed > 0 && <span className="bid-done-failed"> · {result.failed} başarısız</span>}
        </h3>
        <p>
          {emailedCount > 0 && noEmailCount === 0 && 'Her personele hoş geldin e-postası + geçici şifre gönderildi.'}
          {emailedCount > 0 && noEmailCount > 0 && `${emailedCount} kişiye e-posta gönderildi, ${noEmailCount} kişi e-posta vermediği için şifresini PDF'ten elden teslim edin.`}
          {emailedCount === 0 && noEmailCount > 0 && 'E-posta verilmediği için hoş geldin maili atılmadı; şifreleri PDF\'ten elden teslim edin.'}
          {' '}İlk girişte şifrelerini değiştirmek zorundalar.
        </p>
      </div>

      <div className="bid-stats">
        <StatTile label="Hesap açıldı" value={result.created} tone="ok" icon={<KeyRound className="h-3.5 w-3.5" />} />
        <StatTile label="PDF'e hazır" value={pdfReadyRows.length} tone="ok" icon={<FileDown className="h-3.5 w-3.5" />} />
        <StatTile label="Başarısız" value={result.failed} tone="err" icon={<AlertCircle className="h-3.5 w-3.5" />} />
      </div>

      {pdfReadyRows.length > 0 && (
        <div className="bid-pdf-card">
          <div className="bid-pdf-info">
            <FileDown className="h-5 w-5" />
            <div>
              <h5>Resmi giriş belgesi</h5>
              <p>
                <strong>{pdfReadyRows.length} personelin</strong> giriş bilgileri
                (Ad Soyad, TC, geçici şifre, departman) tek bir PDF olarak indirilebilir.
                Yazıcıdan basıp elden teslim edin — KVKK uyarısı belgenin altında basılır.
                {noTcCount > 0 && (
                  <span className="bid-pdf-warn"> · TC bilgisi eksik {noTcCount} kayıt PDF dışında.</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloadingPdf}
            className="bid-pdf-btn"
          >
            {downloadingPdf ? <Loader2 className="bid-spin h-3.5 w-3.5" /> : <FileDown className="h-3.5 w-3.5" />}
            {downloadingPdf ? 'Hazırlanıyor…' : 'Giriş Bilgileri PDF\'i İndir'}
          </button>
        </div>
      )}

      {successRows.length > 0 && (
        <div className="bid-cred-table-wrap">
          <div className="bid-cred-table-header">
            <span>Yeni hesaplar — geçici şifreler</span>
            <small>Modal kapatıldıktan sonra şifreler kaybolur, şimdi yedekleyin.</small>
          </div>
          <div className="bid-cred-scroll">
            <table className="bid-cred-table">
              <colgroup>
                <col style={{ minWidth: 160 }} />
                <col style={{ minWidth: 200 }} />
                <col style={{ minWidth: 180 }} />
                <col style={{ minWidth: 90 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Geçici Şifre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {successRows.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.name}</td>
                    <td className="bid-cred-email">
                      {r.email
                        ? r.email
                        : <span className="bid-cred-noemail">— TC ile giriş —</span>}
                    </td>
                    <td className="bid-cred-pwd">{r.tempPassword}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => copyPassword(idx, r.tempPassword!)}
                        className="bid-cred-copy"
                        aria-label="Şifreyi kopyala"
                      >
                        {copiedIdx === idx
                          ? <CheckCheck className="h-3.5 w-3.5" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.failed > 0 && (
        <div className="bid-err-card">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h5>{result.failed} satır yüklenemedi</h5>
            <p>Hatanın sebebini ve düzeltme önerilerini içeren Excel raporunu indir:</p>
            <button type="button" onClick={onDownloadErrorReport} className="bid-err-btn">
              <Download className="h-3.5 w-3.5" />
              Hata Raporu İndir (Excel)
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        /* styled-jsx component-scoped — bu component ayrı bir fonksiyon olduğu için
           parent'taki .bid-done/.bid-stats CSS'i propagate olmuyor. Burada tekrar tanımlanır. */
        .bid-done { display: flex; flex-direction: column; gap: 18px; }
        .bid-done-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 12px 20px 0;
          gap: 10px;
        }
        .bid-done-icon {
          width: 60px;
          height: 60px;
          border-radius: 999px;
          background: ${K.PRIMARY};
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: ${K.SHADOW_CARD};
        }
        .bid-done h3 {
          font-family: ${K.FONT_DISPLAY};
          font-size: 22px;
          font-weight: 700;
          color: ${K.TEXT_PRIMARY};
          margin: 0;
          letter-spacing: -0.01em;
        }
        .bid-done h3 em {
          font-style: normal;
          color: ${K.PRIMARY};
          font-variant-numeric: tabular-nums;
        }
        .bid-done-failed {
          font-style: normal;
          color: ${K.ERROR_TEXT};
          font-size: 16px;
          font-weight: 600;
        }
        .bid-done-hero p {
          font-size: 13px;
          color: ${K.TEXT_MUTED};
          line-height: 1.55;
          margin: 0;
          max-width: 520px;
        }

        .bid-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        @media (max-width: 640px) {
          .bid-stats { grid-template-columns: 1fr; }
        }

        .bid-err-card {
          display: flex;
          gap: 14px;
          padding: 18px;
          border-radius: 14px;
          background: ${K.ERROR_BG};
          border: 1.5px solid #fecaca;
        }
        .bid-err-card :global(svg) { flex-shrink: 0; color: ${K.ERROR_TEXT}; margin-top: 2px; }
        .bid-err-card h5 {
          font-family: ${K.FONT_DISPLAY};
          font-size: 14px;
          font-weight: 700;
          color: ${K.ERROR_TEXT};
          margin: 0 0 4px;
        }
        .bid-err-card p { font-size: 12px; color: ${K.TEXT_SECONDARY}; margin: 0 0 10px; line-height: 1.5; }
        .bid-err-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          background: #ef4444;
          color: #fff;
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: ${K.FONT_DISPLAY};
          transition: background 160ms ease;
        }
        .bid-err-btn:hover { background: ${K.ERROR_TEXT}; }

        .bid-pdf-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 18px;
          border-radius: 14px;
          background: #ecfdf5;
          border: 1.5px solid ${K.PRIMARY};
        }
        .bid-pdf-info {
          display: flex;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .bid-pdf-info :global(svg) { color: ${K.PRIMARY}; flex-shrink: 0; margin-top: 2px; }
        .bid-pdf-card h5 {
          font-family: ${K.FONT_DISPLAY};
          font-size: 14px;
          font-weight: 700;
          color: ${K.TEXT_PRIMARY};
          margin: 0 0 4px;
        }
        .bid-pdf-card p {
          font-size: 12px;
          color: ${K.TEXT_SECONDARY};
          margin: 0;
          line-height: 1.5;
        }
        .bid-pdf-card strong { color: ${K.PRIMARY}; font-weight: 700; }
        .bid-pdf-warn { color: #b45309; font-weight: 600; }
        .bid-pdf-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 10px;
          background: ${K.PRIMARY};
          color: #ffffff;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: ${K.FONT_DISPLAY};
          flex-shrink: 0;
          white-space: nowrap;
          transition: background 160ms ease;
        }
        .bid-pdf-btn:hover:not(:disabled) { background: ${K.PRIMARY_HOVER}; }
        .bid-pdf-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .bid-cred-table-wrap {
          border: 1.5px solid ${K.BORDER_LIGHT};
          border-radius: 14px;
          overflow: hidden;
          background: ${K.SURFACE};
          box-shadow: ${K.SHADOW_CARD};
        }
        .bid-cred-table-header {
          padding: 12px 16px;
          background: ${K.BG};
          border-bottom: 1px solid ${K.BORDER_LIGHT};
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .bid-cred-table-header span {
          font-family: ${K.FONT_DISPLAY};
          font-size: 13px;
          font-weight: 700;
          color: ${K.TEXT_PRIMARY};
        }
        .bid-cred-table-header small {
          font-size: 11px;
          color: ${K.TEXT_MUTED};
        }
        .bid-cred-scroll {
          overflow: auto;
          max-height: 260px;
        }
        .bid-cred-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .bid-cred-table thead th {
          position: sticky;
          top: 0;
          background: ${K.SURFACE};
          padding: 10px 14px;
          text-align: left;
          font-family: ${K.FONT_DISPLAY};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: ${K.TEXT_MUTED};
          border-bottom: 1px solid ${K.BORDER_LIGHT};
        }
        .bid-cred-table tbody tr { border-top: 1px solid ${K.BORDER_LIGHT}; }
        .bid-cred-table tbody tr:hover { background: ${K.BG}; }
        .bid-cred-table td {
          padding: 10px 14px;
          color: ${K.TEXT_PRIMARY};
          vertical-align: middle;
        }
        .bid-cred-email {
          color: ${K.TEXT_SECONDARY};
          word-break: break-all;
        }
        .bid-cred-noemail {
          font-style: italic;
          color: ${K.TEXT_MUTED};
          font-size: 11px;
        }
        .bid-cred-pwd {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-weight: 600;
          color: ${K.PRIMARY};
          letter-spacing: 0.04em;
        }
        .bid-cred-copy {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid ${K.BORDER_LIGHT};
          background: ${K.SURFACE};
          color: ${K.TEXT_MUTED};
          border-radius: 8px;
          cursor: pointer;
          transition: all 160ms ease;
        }
        .bid-cred-copy:hover { color: ${K.PRIMARY}; border-color: ${K.PRIMARY}; }
      `}</style>
    </div>
  );
}

