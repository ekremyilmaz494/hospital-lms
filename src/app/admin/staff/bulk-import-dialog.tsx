'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

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

  // Departmanları dialog açılınca yükle
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
      // Departman değiştirildiyse match tipini güncelle
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
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } };
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

  if (!open) return null;

  // rowIndex → error lookup for quick access
  const errorByRowIndex = new Map(preview?.rows.filter(r => r.status === 'error').map(r => [r.rowIndex, r.reason]) ?? []);
  const errorCount = preview?.errors ?? 0;
  const validCount = preview?.valid ?? 0;
  const canImport = preview && validCount > 0 && (skipErrors || errorCount === 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-6xl rounded-2xl shadow-xl max-h-[92vh] flex flex-col"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Toplu Personel Yükle</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {stage === 'idle' && 'Excel dosyası yükleyin'}
                {stage === 'uploading' && 'Dosya doğrulanıyor…'}
                {stage === 'preview' && `${preview?.total ?? 0} satır — düzenleyip onaylayın`}
                {stage === 'importing' && 'Kayıtlar oluşturuluyor…'}
                {stage === 'done' && 'Tamamlandı'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={stage === 'uploading' || stage === 'importing'}
            className="rounded-lg p-2 hover:bg-(--color-surface-hover) disabled:opacity-50"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {stage === 'idle' && (
            <div className="space-y-4">
              <div
                className="rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors hover:bg-(--color-surface-hover)"
                style={{ borderColor: 'var(--color-border)' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              >
                <Upload className="mx-auto h-10 w-10 mb-3" style={{ color: 'var(--color-text-muted)' }} />
                <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>Excel dosyası seçin veya buraya sürükleyin</p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>.xlsx veya .xls (maksimum 10MB)</p>
                <input
                  ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)' }}>
                <FileText className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                <div className="flex-1">
                  <p className="font-medium text-sm mb-1" style={{ color: 'var(--color-text)' }}>Şablon dosyasını indirin</p>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>Başlıklar farklı yazılabilir: "Ad"/"İsim", "Soyad", "E-posta"/"Email"/"Mail", "Departman"/"Bölüm" — hepsi tanınır.</p>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Şablon İndir (.xlsx)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {stage === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin mb-3" style={{ color: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>Dosya doğrulanıyor…</p>
            </div>
          )}

          {stage === 'preview' && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <SummaryCard label="Toplam" value={preview.total} color="var(--color-text)" />
                <SummaryCard label="Geçerli" value={validCount} color="var(--color-success)" icon={<CheckCircle2 className="h-4 w-4" />} />
                <SummaryCard label="Hatalı" value={errorCount} color="var(--color-error)" icon={<AlertCircle className="h-4 w-4" />} />
              </div>

              {preview.unknownHeaders && preview.unknownHeaders.length > 0 && (
                <div className="rounded-xl p-3 flex items-start gap-2 text-sm" style={{ background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid #f59e0b' }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                  <div>
                    <span className="font-medium" style={{ color: '#92400e' }}>Tanınmayan sütunlar:</span>{' '}
                    <span style={{ color: '#92400e' }}>{preview.unknownHeaders.join(', ')}</span>
                    <span style={{ color: '#92400e' }}> — bu sütunlar atlandı.</span>
                  </div>
                </div>
              )}

              {/* Editable table */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: 'var(--color-surface-muted)' }}>
                      <tr>
                        <th className="px-2 py-2 text-left font-medium w-10" style={{ color: 'var(--color-text-muted)' }}>#</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Ad *</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Soyad *</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>E-posta *</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Telefon</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Departman</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Unvan</th>
                        <th className="px-2 py-2 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editedRows.map((row, idx) => {
                        const err = errorByRowIndex.get(row.rowIndex);
                        const isError = !!err;
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderTop: '1px solid var(--color-border)',
                              background: isError ? 'var(--color-error-bg)' : undefined,
                            }}
                          >
                            <td className="px-2 py-1 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.rowIndex}</td>
                            <td className="px-2 py-1">
                              <CellInput value={row.firstName} onChange={(v) => updateRow(idx, { firstName: v })} />
                            </td>
                            <td className="px-2 py-1">
                              <CellInput value={row.lastName} onChange={(v) => updateRow(idx, { lastName: v })} />
                            </td>
                            <td className="px-2 py-1">
                              <CellInput value={row.email} onChange={(v) => updateRow(idx, { email: v.toLowerCase() })} />
                            </td>
                            <td className="px-2 py-1">
                              <CellInput value={row.phone} onChange={(v) => updateRow(idx, { phone: v })} />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={row.deptId || ''}
                                onChange={(e) => updateRow(idx, { deptId: e.target.value || undefined })}
                                className="w-full h-8 text-xs rounded-md border px-1.5"
                                style={{
                                  background: 'var(--color-bg)',
                                  borderColor: row.deptMatch === 'ambiguous' || row.deptMatch === 'none'
                                    ? 'var(--color-error)'
                                    : 'var(--color-border)',
                                  color: 'var(--color-text)',
                                }}
                              >
                                <option value="">— {row.deptName || 'Seçin'}</option>
                                {departments.map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <CellInput value={row.title} onChange={(v) => updateRow(idx, { title: v })} />
                            </td>
                            <td className="px-2 py-1">
                              {isError ? (
                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-error)' }} title={err}>
                                  <AlertCircle className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{err}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
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
                <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--color-text)' }}>
                  <input
                    type="checkbox" checked={skipErrors}
                    onChange={(e) => setSkipErrors(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Hatalı satırları atlayarak {validCount} geçerli satırı yükle
                </label>
              )}
            </div>
          )}

          {stage === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin mb-3" style={{ color: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>Personeller oluşturuluyor…</p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Bu işlem birkaç saniye sürebilir</p>
            </div>
          )}

          {stage === 'done' && importResult && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-3" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Yükleme tamamlandı</h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {importResult.created} başarılı{importResult.failed > 0 ? `, ${importResult.failed} başarısız` : ''}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="Başarılı" value={importResult.created} color="var(--color-success)" icon={<CheckCircle2 className="h-4 w-4" />} />
                <SummaryCard label="Başarısız" value={importResult.failed} color="var(--color-error)" icon={<AlertCircle className="h-4 w-4" />} />
              </div>

              {importResult.failed > 0 && (
                <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--color-error-bg)' }}>
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-error)' }} />
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-1" style={{ color: 'var(--color-error)' }}>
                      {importResult.failed} satır yüklenemedi
                    </p>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>Detaylı Excel raporunu indirin:</p>
                    <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                      <Download className="h-4 w-4 mr-2" />
                      Hata Raporu İndir (Excel)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {stage === 'preview' ? (
            <>
              <Button variant="outline" onClick={revalidate}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tekrar Doğrula
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset}>Farklı Dosya</Button>
                <button
                  onClick={handleConfirmImport}
                  disabled={!canImport}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#0d9668' }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {validCount > 0 ? `${validCount} Personeli Ekle` : 'Yüklenecek Satır Yok'}
                </button>
              </div>
            </>
          ) : stage === 'done' ? (
            <>
              <Button variant="outline" onClick={reset}>Yeni Dosya Yükle</Button>
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center rounded-lg px-4 h-10 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: '#0d9668' }}
              >
                Kapat
              </button>
            </>
          ) : stage === 'idle' ? (
            <>
              <div />
              <Button variant="outline" onClick={handleClose}>İptal</Button>
            </>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

/** Tablo hücresi için kompakt input */
function CellInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 text-xs px-2"
    />
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
