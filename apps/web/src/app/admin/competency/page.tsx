'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Users, BarChart3, FileText, CheckCircle, Clock, AlertCircle, Loader2, Download, X, Star } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { exportPDF } from '@/lib/export';

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

// ── Types ─────────────────────────────────────────────────────
interface CompetencyItem { id?: string; text: string; description: string; order: number }
interface CompetencyCategory { id?: string; name: string; weight: number; order: number; items: CompetencyItem[] }
interface CompetencyForm {
  id: string; title: string; targetRole: string | null; periodStart: string; periodEnd: string;
  isActive: boolean; createdAt: string;
  _count: { evaluations: number; categories: number };
}
interface Evaluation {
  id: string; evaluatorType: string; status: string; createdAt: string;
  subject: { id: string; firstName: string; lastName: string; departmentRel: { name: string } | null };
  evaluator: { id: string; firstName: string; lastName: string };
  form: { id: string; title: string };
  _count: { answers: number };
}
interface StaffUser { id: string; firstName: string; lastName: string; departmentRel: { name: string } | null }
interface FormsData { forms: CompetencyForm[]; total: number }
interface EvaluationsData { evaluations: Evaluation[]; total: number }
interface StaffData { staff: StaffUser[] }

const EVALUATOR_LABELS: Record<string, string> = {
  SELF: 'Öz Değerlendirme', MANAGER: 'Yönetici', PEER: 'Akran', SUBORDINATE: 'Ast',
};
const RADAR_COLORS = ['#6366f1', '#f59e0b', K.PRIMARY, '#ef4444'];

// ── New Form Modal ─────────────────────────────────────────────
function NewFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [categories, setCategories] = useState<CompetencyCategory[]>([
    { name: '', weight: 100, order: 0, items: [{ text: '', description: '', order: 0 }] },
  ]);
  const dragCatIdx = useRef<number | null>(null);

  const addCategory = () => setCategories(cs => [...cs, { name: '', weight: 0, order: cs.length, items: [{ text: '', description: '', order: 0 }] }]);
  const removeCategory = (i: number) => setCategories(cs => cs.filter((_, idx) => idx !== i));
  const addItem = (catIdx: number) => setCategories(cs => cs.map((c, i) => i === catIdx ? { ...c, items: [...c.items, { text: '', description: '', order: c.items.length }] } : c));
  const removeItem = (catIdx: number, itemIdx: number) => setCategories(cs => cs.map((c, i) => i === catIdx ? { ...c, items: c.items.filter((_, j) => j !== itemIdx) } : c));
  const updateCategory = (i: number, key: keyof CompetencyCategory, val: string | number) =>
    setCategories(cs => cs.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  const updateItem = (catIdx: number, itemIdx: number, key: keyof CompetencyItem, val: string) =>
    setCategories(cs => cs.map((c, i) => i === catIdx ? { ...c, items: c.items.map((item, j) => j === itemIdx ? { ...item, [key]: val } : item) } : c));

  const handleDragStart = (i: number) => { dragCatIdx.current = i; };
  const handleDrop = (i: number) => {
    if (dragCatIdx.current === null || dragCatIdx.current === i) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(dragCatIdx.current, 1);
    reordered.splice(i, 0, moved);
    setCategories(reordered.map((c, idx) => ({ ...c, order: idx })));
    dragCatIdx.current = null;
  };

  const handleSave = async () => {
    if (!title.trim() || !periodStart || !periodEnd) { toast('Başlık ve dönem tarihleri zorunludur.', 'error'); return; }
    for (const cat of categories) {
      if (!cat.name.trim()) { toast('Tüm kategorilere isim verin.', 'error'); return; }
      for (const item of cat.items) {
        if (!item.text.trim()) { toast('Tüm madde metinlerini doldurun.', 'error'); return; }
      }
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/competency/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, targetRole: targetRole || undefined, periodStart, periodEnd, categories }),
      });
      if (!res.ok) { const e = await res.json(); toast(e.error ?? 'Hata oluştu', 'error'); return; }
      toast('Form başarıyla oluşturuldu.', 'success');
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Yeni Değerlendirme Formu</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Form Başlığı *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn: 2026 Yılı Hemşire Yetkinlik Değerlendirmesi" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Dönem Başlangıcı *</label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Dönem Bitişi *</label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Hedef Rol (opsiyonel)</label>
              <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="Hemşire, Doktor, Teknisyen..." className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Açıklama (opsiyonel)</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Kısa açıklama..." className="rounded-xl" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Kategoriler</span>
              <Button variant="outline" size="sm" onClick={addCategory} className="rounded-xl text-xs gap-1">
                <Plus className="h-3 w-3" /> Kategori Ekle
              </Button>
            </div>
            <div className="space-y-3">
              {categories.map((cat, catIdx) => (
                <div
                  key={catIdx}
                  draggable
                  onDragStart={() => handleDragStart(catIdx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(catIdx)}
                  className="rounded-xl border p-3"
                  style={{ borderColor: K.BORDER, background: K.BG }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab" style={{ color: K.TEXT_MUTED }} />
                    <Input
                      value={cat.name}
                      onChange={e => updateCategory(catIdx, 'name', e.target.value)}
                      placeholder="Kategori adı"
                      className="rounded-lg text-sm flex-1"
                    />
                    <Input
                      type="number" min={0} max={100}
                      value={cat.weight}
                      onChange={e => updateCategory(catIdx, 'weight', Number(e.target.value))}
                      className="rounded-lg text-sm w-20"
                      title="Ağırlık %"
                    />
                    <span className="text-xs" style={{ color: K.TEXT_MUTED }}>%</span>
                    {categories.length > 1 && (
                      <button onClick={() => removeCategory(catIdx)}>
                        <X className="h-4 w-4" style={{ color: K.ERROR }} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {cat.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-center gap-2">
                        <Input
                          value={item.text}
                          onChange={e => updateItem(catIdx, itemIdx, 'text', e.target.value)}
                          placeholder={`Madde ${itemIdx + 1}`}
                          className="rounded-lg text-sm flex-1"
                        />
                        {cat.items.length > 1 && (
                          <button onClick={() => removeItem(catIdx, itemIdx)}>
                            <Trash2 className="h-3.5 w-3.5" style={{ color: K.ERROR }} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addItem(catIdx)}
                      className="text-xs font-medium flex items-center gap-1 mt-1"
                      style={{ color: K.PRIMARY }}
                    >
                      <Plus className="h-3 w-3" /> Madde Ekle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">İptal</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet ve Yayınla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Start Evaluation Modal ─────────────────────────────────────
function StartEvaluationModal({ forms, onClose, onSaved }: { forms: CompetencyForm[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formId, setFormId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [peerIds, setPeerIds] = useState('');
  const [subordinateIds, setSubordinateIds] = useState('');
  const [includeSelf, setIncludeSelf] = useState(true);
  const { data: staffData } = useFetch<StaffData>('/api/admin/staff?limit=200');
  const staff = staffData?.staff ?? [];

  const handleSave = async () => {
    if (!formId || !subjectId) { toast('Form ve değerlendirilen kişi zorunludur.', 'error'); return; }
    setSaving(true);
    const parseIds = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/admin/competency/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId, subjectId, includeSelf,
          managerId: managerId || undefined,
          peerIds: parseIds(peerIds),
          subordinateIds: parseIds(subordinateIds),
        }),
      });
      if (!res.ok) { const e = await res.json(); toast(e.error ?? 'Hata oluştu', 'error'); return; }
      toast('Değerlendirme başlatıldı ve bildirimler gönderildi.', 'success');
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle>Değerlendirme Başlat</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Değerlendirme Formu *</label>
            <select value={formId} onChange={e => setFormId(e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2 border outline-none"
              style={{ borderColor: K.BORDER, background: K.SURFACE, color: K.TEXT_PRIMARY }}>
              <option value="">Form seçin...</option>
              {forms.filter(f => f.isActive).map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Değerlendirilen Kişi *</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2 border outline-none"
              style={{ borderColor: K.BORDER, background: K.SURFACE, color: K.TEXT_PRIMARY }}>
              <option value="">Personel seçin...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.departmentRel ? ` (${s.departmentRel.name})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Yönetici</label>
            <select value={managerId} onChange={e => setManagerId(e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2 border outline-none"
              style={{ borderColor: K.BORDER, background: K.SURFACE, color: K.TEXT_PRIMARY }}>
              <option value="">Yönetici seçin (opsiyonel)...</option>
              {staff.filter(s => s.id !== subjectId).map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Akranlar (max 5, virgülle ID girin)</label>
            <Input value={peerIds} onChange={e => setPeerIds(e.target.value)} placeholder="uuid1, uuid2, ..." className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: K.TEXT_SECONDARY }}>Astlar (max 3, virgülle ID girin)</label>
            <Input value={subordinateIds} onChange={e => setSubordinateIds(e.target.value)} placeholder="uuid1, uuid2, ..." className="rounded-xl" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeSelf} onChange={e => setIncludeSelf(e.target.checked)} className="rounded" />
            <span style={{ color: K.TEXT_PRIMARY }}>Öz değerlendirme dahil et</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">İptal</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Başlat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResultsData {
  radarData: Record<string, string | number>[];
  typeLabels: Record<string, string>;
  overallByType: Record<string, number>;
  strengths: string[];
  improvements: string[];
  statusSummary: { evaluatorType: string; status: string; evaluatorName: string }[];
}

// ── Results Panel ──────────────────────────────────────────────
function ResultsPanel() {
  const { toast } = useToast();
  const { data: staffData } = useFetch<StaffData>('/api/admin/staff?limit=200');
  const { data: formsData } = useFetch<FormsData>('/api/admin/competency/forms');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const resultsUrl = selectedSubjectId && selectedFormId
    ? `/api/admin/competency/evaluations/${selectedSubjectId}/results?formId=${selectedFormId}`
    : null;
  const { data: results, isLoading } = useFetch<ResultsData>(resultsUrl);

  const staff = staffData?.staff ?? [];
  const forms = formsData?.forms ?? [];

  const radarData = results?.radarData ?? [];
  const typeLabels = results?.typeLabels ?? {};
  const overallByType = results?.overallByType ?? {};
  const strengths = results?.strengths ?? [];
  const improvements = results?.improvements ?? [];
  const statusSummary = results?.statusSummary ?? [];

  const radarKeys = Object.keys(overallByType);

  const handleExportPDF = () => {
    try {
      exportPDF({
        headers: ['Kategori', ...radarKeys.map(k => typeLabels[k] ?? k)],
        rows: radarData.map(row => [String(row.category), ...radarKeys.map(k => String(row[k] ?? '-'))]),
      }, 'Yetkinlik Değerlendirme Raporu');
      toast('PDF indiriliyor...', 'success');
    } catch { toast('PDF oluşturulamadı.', 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}
          className="text-sm rounded-xl px-3 py-2 border outline-none"
          style={{ borderColor: K.BORDER, background: K.SURFACE, color: K.TEXT_PRIMARY }}>
          <option value="">Personel seçin...</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.departmentRel ? ` (${s.departmentRel.name})` : ''}</option>)}
        </select>
        <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)}
          className="text-sm rounded-xl px-3 py-2 border outline-none"
          style={{ borderColor: K.BORDER, background: K.SURFACE, color: K.TEXT_PRIMARY }}>
          <option value="">Form seçin...</option>
          {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      </div>

      {isLoading && <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}

      {results && !isLoading && radarData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              {radarKeys.map((k, i) => (
                <span key={k} className="flex items-center gap-1 text-xs" style={{ color: K.TEXT_SECONDARY }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: RADAR_COLORS[i % RADAR_COLORS.length] }} />
                  {typeLabels[k] ?? k}: <strong>{overallByType[k]?.toFixed(1)}</strong>
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> PDF Rapor
            </Button>
          </div>

          <div className="rounded-2xl border p-4" style={{ background: K.SURFACE, borderColor: K.BORDER }}>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: K.TEXT_SECONDARY }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10, fill: K.TEXT_MUTED }} tickCount={6} />
                <Tooltip contentStyle={{ background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: '12px', fontSize: '12px' }} />
                <Legend />
                {radarKeys.map((k, i) => (
                  <Radar key={k} name={typeLabels[k] ?? k} dataKey={k} stroke={RADAR_COLORS[i % RADAR_COLORS.length]} fill={RADAR_COLORS[i % RADAR_COLORS.length]} fillOpacity={0.15} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {strengths.length > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: K.SUCCESS, background: K.SUCCESS_BG }}>
                <p className="text-xs font-bold mb-2" style={{ color: K.SUCCESS }}>Güçlü Yönler (≥4.0)</p>
                {strengths.map(s => <p key={s} className="text-xs flex items-center gap-1" style={{ color: K.SUCCESS }}><CheckCircle className="h-3 w-3" />{s}</p>)}
              </div>
            )}
            {improvements.length > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: K.WARNING, background: K.WARNING_BG }}>
                <p className="text-xs font-bold mb-2" style={{ color: K.WARNING }}>Gelişim Alanları (&lt;3.0)</p>
                {improvements.map(s => <p key={s} className="text-xs flex items-center gap-1" style={{ color: K.WARNING }}><AlertCircle className="h-3 w-3" />{s}</p>)}
              </div>
            )}
          </div>

          {statusSummary.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: K.BORDER }}>
              <table className="w-full text-sm">
                <thead><tr style={{ background: K.BG, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                  {['Değerlendirici', 'Tip', 'Durum'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold" style={{ color: K.TEXT_MUTED }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {statusSummary.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                      <td className="px-4 py-2" style={{ color: K.TEXT_PRIMARY }}>{r.evaluatorName}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: K.TEXT_SECONDARY }}>{r.evaluatorType}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: r.status === 'COMPLETED' ? K.SUCCESS : K.WARNING }}>
                          {r.status === 'COMPLETED' ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {r.status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isLoading && (!results || radarData.length === 0) && selectedSubjectId && selectedFormId && (
        <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Bu kişi için henüz tamamlanmış değerlendirme bulunmuyor.</div>
      )}
      {!selectedSubjectId || !selectedFormId ? (
        <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Personel ve form seçerek sonuçları görüntüleyin.</div>
      ) : null}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function AdminCompetencyPage() {
  const [activeTab, setActiveTab] = useState<'forms' | 'evaluations' | 'results'>('forms');
  const [showNewForm, setShowNewForm] = useState(false);
  const [showStartEval, setShowStartEval] = useState(false);
  const [formsKey, setFormsKey] = useState(0);
  const [evalsKey, setEvalsKey] = useState(0);
  const [expandedForm, setExpandedForm] = useState<string | null>(null);

  const { data: formsData, isLoading: formsLoading, refetch: refetchForms } = useFetch<FormsData>(`/api/admin/competency/forms?_k=${formsKey}`);
  const { data: evalsData, isLoading: evalsLoading, refetch: refetchEvals } = useFetch<EvaluationsData>(`/api/admin/competency/evaluations?_k=${evalsKey}`);
  const { toast } = useToast();

  const forms = formsData?.forms ?? [];
  const evaluations = evalsData?.evaluations ?? [];

  if (formsLoading && !formsData) return <PageLoading />;

  const toggleFormActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/competency/forms/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      refetchForms?.();
    } catch {
      toast('Durum güncellenemedi.', 'error');
    }
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Bu formu ve tüm değerlendirmeleri silmek istediğinizden emin misiniz?')) return;
    const res = await fetch(`/api/admin/competency/forms/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast('Silinemedi.', 'error'); return; }
    refetchForms?.();
  };

  const sendReminder = async (evaluationId: string, evaluatorId: string) => {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: evaluatorId, title: 'Değerlendirme Hatırlatması', message: 'Bekleyen yetkinlik değerlendirmenizi tamamlamayı unutmayın.', type: 'competency_evaluation' }),
      });
      if (!res.ok) throw new Error();
      toast('Hatırlatma gönderildi.', 'success');
    } catch {
      toast('Hatırlatma gönderilemedi.', 'error');
    }
  };

  const tabs = [
    { key: 'forms', label: 'Form Yönetimi', icon: FileText },
    { key: 'evaluations', label: 'Değerlendirmeler', icon: Users },
    { key: 'results', label: 'Sonuçlar', icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6">
      {showNewForm && <NewFormModal onClose={() => setShowNewForm(false)} onSaved={() => { setFormsKey(k => k + 1); refetchForms?.(); }} />}
      {showStartEval && <StartEvaluationModal forms={forms} onClose={() => setShowStartEval(false)} onSaved={() => { setEvalsKey(k => k + 1); refetchEvals?.(); }} />}

      <BlurFade delay={0}>
        <div className="relative overflow-hidden rounded-2xl shadow-lg" style={{ background: K.PRIMARY }}>
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10" style={{ background: 'white' }} />
          <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Star className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">360° Yetkinlik Değerlendirme</h1>
                <p className="text-indigo-200 text-sm">Çok değerlendiricili yetkinlik analizi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'forms' && (
                <Button onClick={() => setShowNewForm(true)} size="sm" className="gap-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                  <Plus className="h-4 w-4" /> Yeni Form
                </Button>
              )}
              {activeTab === 'evaluations' && (
                <Button onClick={() => setShowStartEval(true)} size="sm" className="gap-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                  <Plus className="h-4 w-4" /> Değerlendirme Başlat
                </Button>
              )}
            </div>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: K.SURFACE, borderColor: K.BORDER }}>
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: K.BORDER }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 px-5 py-3.5 text-sm font-semibold transition-colors"
                  style={{
                    color: activeTab === tab.key ? K.PRIMARY : K.TEXT_SECONDARY,
                    borderBottom: activeTab === tab.key ? `2px solid ${K.PRIMARY}` : '2px solid transparent',
                  }}>
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {/* ── Tab 1: Form Yönetimi ── */}
            {activeTab === 'forms' && (
              <div className="space-y-3">
                {forms.length === 0 ? (
                  <div className="py-12 text-center text-sm" style={{ color: K.TEXT_MUTED }}>
                    {'Henüz form oluşturulmadı. "Yeni Form" butonuyla başlayın.'}
                  </div>
                ) : (
                  forms.map(form => (
                    <div key={form.id} className="rounded-xl border" style={{ borderColor: K.BORDER }}>
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button onClick={() => setExpandedForm(expandedForm === form.id ? null : form.id)}>
                            {expandedForm === form.id ? <ChevronUp className="h-4 w-4" style={{ color: K.TEXT_MUTED }} /> : <ChevronDown className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: K.TEXT_PRIMARY }}>{form.title}</p>
                            <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                              {form.targetRole && <span className="mr-2">{form.targetRole}</span>}
                              {new Date(form.periodStart).toLocaleDateString('tr-TR')} – {new Date(form.periodEnd).toLocaleDateString('tr-TR')}
                              <span className="ml-2">{form._count.evaluations} değerlendirme</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: form.isActive ? K.SUCCESS_BG : K.BG, color: form.isActive ? K.SUCCESS : K.TEXT_MUTED }}>
                            {form.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                          <button onClick={() => toggleFormActive(form.id, form.isActive)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}>
                            {form.isActive ? 'Pasife Al' : 'Aktive Et'}
                          </button>
                          <button onClick={() => deleteForm(form.id)}>
                            <Trash2 className="h-4 w-4" style={{ color: K.ERROR }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Tab 2: Değerlendirmeler ── */}
            {activeTab === 'evaluations' && (
              <div className="overflow-x-auto">
                {evalsLoading ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> :
                  evaluations.length === 0 ? (
                    <div className="py-12 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Henüz değerlendirme başlatılmadı.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: K.BG, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                          {['Değerlendirilen', 'Form', 'Değerlendirici', 'Tip', 'Durum', 'İşlem'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evaluations.map(ev => (
                          <tr key={ev.id} style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                            <td className="px-4 py-3 font-medium" style={{ color: K.TEXT_PRIMARY }}>{ev.subject.firstName} {ev.subject.lastName}</td>
                            <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: K.TEXT_SECONDARY }}>{ev.form.title}</td>
                            <td className="px-4 py-3" style={{ color: K.TEXT_SECONDARY }}>{ev.evaluator.firstName} {ev.evaluator.lastName}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: K.BG, color: K.TEXT_SECONDARY }}>
                                {EVALUATOR_LABELS[ev.evaluatorType] ?? ev.evaluatorType}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1 text-xs font-semibold w-max" style={{ color: ev.status === 'COMPLETED' ? K.SUCCESS : K.WARNING }}>
                                {ev.status === 'COMPLETED' ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                {ev.status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {ev.status === 'PENDING' && (
                                <button onClick={() => sendReminder(ev.id, ev.evaluator.id)}
                                  className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                                  style={{ background: K.WARNING_BG, color: K.WARNING }}>
                                  Hatırlat
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            )}

            {/* ── Tab 3: Sonuçlar ── */}
            {activeTab === 'results' && <ResultsPanel />}
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
