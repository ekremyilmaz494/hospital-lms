'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, FileText, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  deptId?: string;
  deptName: string;
  deptMatch: 'exact' | 'fuzzy' | 'ambiguous' | 'none' | 'empty';
  deptCandidates?: Array<{ id: string; name: string }>;
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

interface ImportResult {
  created: number;
  failed: number;
  total: number;
  errors: string[];
  results: Array<{ email: string; name: string; status: 'created' | 'failed'; tempPassword?: string; error?: string }>;
}

interface Department {
  id: string;
  name: string;
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
    wb.creator = 'Devakent Hastanesi LMS';
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
      if (e.includes('geçersiz e-posta') || e.includes('türkçe karakter') || e.includes('invalid')) return 'E-posta adresini kontrol edin. "ali@hastane.com" gibi Türkçe karakter içermeyen bir format olmalı.';
      if (e.includes('şifre')) return 'Şifre en az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli. Boş bırakırsanız sistem üretir.';
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
    if (stage === 'idle') return 'Excel şablonu ile toplu personel yükle.';
    if (stage === 'uploading') return 'Dosya doğrulanıyor…';
    if (stage === 'preview') return `${preview?.total ?? 0} satır okundu — düzenleyip onayla.`;
    if (stage === 'importing') return 'Kayıtlar oluşturuluyor…';
    return 'Yükleme tamamlandı.';
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
      size="xl"
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
              <p>Başlıklar esnek: <em>Ad/İsim</em>, <em>Soyad</em>, <em>E-posta/Email/Mail</em>, <em>Departman/Bölüm</em> — hepsi tanınır.</p>
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
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Ad *</th>
                    <th>Soyad *</th>
                    <th>E-posta *</th>
                    <th>Telefon</th>
                    <th>Departman</th>
                    <th>Unvan</th>
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
                        <td><CellInput value={row.email} onChange={(v) => updateRow(idx, { email: v.toLowerCase() })} /></td>
                        <td><CellInput value={row.phone} onChange={(v) => updateRow(idx, { phone: v })} /></td>
                        <td>
                          <select
                            value={row.deptId || ''}
                            onChange={(e) => updateRow(idx, { deptId: e.target.value || undefined })}
                            className={`bid-sel ${row.deptMatch === 'ambiguous' || row.deptMatch === 'none' ? 'bid-sel-err' : ''}`}
                          >
                            <option value="">— {row.deptName || 'Seçin'}</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
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
          <h4>Personeller oluşturuluyor…</h4>
          <p>Her satır için kullanıcı hesabı, departman ataması ve hoşgeldin e-postası hazırlanıyor. Birkaç saniye sürebilir.</p>
        </div>
      )}

      {stage === 'done' && importResult && (
        <div className="bid-done">
          <div className="bid-done-hero">
            <div className="bid-done-icon">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3>
              <em>{importResult.created}</em> personel eklendi
              {importResult.failed > 0 && <span className="bid-done-failed"> · {importResult.failed} başarısız</span>}
            </h3>
            <p>Yeni kullanıcılar giriş bilgilerini e-posta ile aldı.</p>
          </div>

          <div className="bid-stats">
            <StatTile label="Başarılı" value={importResult.created} tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
            <StatTile label="Başarısız" value={importResult.failed} tone="err" icon={<AlertCircle className="h-3.5 w-3.5" />} />
          </div>

          {importResult.failed > 0 && (
            <div className="bid-err-card">
              <AlertCircle className="h-5 w-5" />
              <div>
                <h5>{importResult.failed} satır yüklenemedi</h5>
                <p>Hatanın sebebini ve düzeltme önerilerini içeren Excel raporunu indir:</p>
                <button type="button" onClick={downloadErrorReport} className="bid-err-btn">
                  <Download className="h-3.5 w-3.5" />
                  Hata Raporu İndir (Excel)
                </button>
              </div>
            </div>
          )}
        </div>
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
        .bid-template p { font-size: 12px; color: #78716c; line-height: 1.55; margin: 0 0 12px; }
        .bid-template em { font-style: normal; color: #1c1917; font-weight: 600; }
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
        .bid-done .bid-stats { grid-template-columns: repeat(2, 1fr); }

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
          max-height: 380px;
        }
        .bid-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bid-table thead th {
          position: sticky;
          top: 0;
          background: #fafaf9;
          padding: 10px 10px;
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
        .bid-table td { padding: 4px 6px; vertical-align: middle; }
        .bid-rowidx {
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          color: #78716c;
          padding-left: 10px;
          font-variant-numeric: tabular-nums;
        }

        .bid-sel {
          width: 100%;
          height: 32px;
          border-radius: 8px;
          border: 1.5px solid #e7e5e4;
          background: #ffffff;
          padding: 0 6px;
          font-size: 12px;
          color: #1c1917;
          font-family: inherit;
        }
        .bid-sel:focus { outline: 2px solid #0d9668; outline-offset: 1px; border-color: #0d9668; }
        .bid-sel-err { border-color: #ef4444; background: #fee2e2; }

        .bid-status-ok, .bid-status-err {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
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
      className="h-8 text-xs px-2"
      style={{ background: K.SURFACE, borderColor: K.BORDER_LIGHT }}
    />
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

