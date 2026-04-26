'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2, GripVertical, AlertCircle, Sparkles, RotateCcw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

type QuestionType = 'likert_5' | 'yes_partial_no' | 'text';

interface Item { id?: string; text: string; questionType: QuestionType; isRequired: boolean; order: number; }
interface Category { id?: string; name: string; order: number; items: Item[]; }
interface FormState { title: string; description: string; documentCode: string; isActive: boolean; categories: Category[]; }

const EMPTY_FORM: FormState = { title: 'Eğitim Değerlendirme Anket Formu', description: '', documentCode: 'EY.FR.40', isActive: true, categories: [] };

const DEFAULT_TEMPLATE: Category[] = [
  { name: 'EĞİTİM PROGRAMI', order: 0, items: [
    { text: 'Programda ele alınan konuların işimle ilgisi', questionType: 'likert_5', isRequired: true, order: 0 },
    { text: 'Görsel ve işitsel araçlar', questionType: 'likert_5', isRequired: true, order: 1 },
    { text: 'Eğitim notları', questionType: 'likert_5', isRequired: true, order: 2 },
    { text: 'Eğitim süresi', questionType: 'likert_5', isRequired: true, order: 3 },
    { text: 'Eğitimin içeriği', questionType: 'likert_5', isRequired: true, order: 4 },
  ]},
  { name: 'ORGANİZASYON', order: 1, items: [
    { text: 'Eğitim duyurusu zamanlaması', questionType: 'likert_5', isRequired: true, order: 0 },
    { text: 'Eğitim salonunun dizaynı', questionType: 'likert_5', isRequired: true, order: 1 },
    { text: 'Eğitim salonunun havalandırması', questionType: 'likert_5', isRequired: true, order: 2 },
    { text: 'Eğitim salonunun ışıklandırması', questionType: 'likert_5', isRequired: true, order: 3 },
    { text: 'Eğitim salonunun ses düzeni', questionType: 'likert_5', isRequired: true, order: 4 },
    { text: 'Eğitim süresince sağlanan yiyecek ve içecek', questionType: 'likert_5', isRequired: false, order: 5 },
  ]},
  { name: 'EĞİTMEN', order: 2, items: [
    { text: 'Eğitmenin, verilen program ile ilgili ön hazırlığı', questionType: 'likert_5', isRequired: true, order: 0 },
    { text: 'Verdiği eğitim konusundaki bilgi ve tecrübesi', questionType: 'likert_5', isRequired: true, order: 1 },
    { text: 'Anlatımı', questionType: 'likert_5', isRequired: true, order: 2 },
    { text: 'Programın teorik ve uygulaması arasında kurduğu denge', questionType: 'likert_5', isRequired: true, order: 3 },
    { text: 'İletişim konusundaki başarısı', questionType: 'likert_5', isRequired: true, order: 4 },
  ]},
  { name: 'GENEL DEĞERLENDİRME', order: 3, items: [
    { text: 'Bu eğitimi diğer çalışanlara da öneririm', questionType: 'yes_partial_no', isRequired: true, order: 0 },
  ]},
];

const TYPE_META: Record<QuestionType, { label: string; col: string; bg: string }> = {
  likert_5: { label: '1–5 Puan', col: 'var(--k-success)', bg: 'var(--k-success-bg)' },
  yes_partial_no: { label: 'Evet / Kısmen / Hayır', col: '#6366f1', bg: '#eef2ff' },
  text: { label: 'Serbest Metin', col: '#f59e0b', bg: '#fffbeb' },
};

export default function FeedbackFormEditorPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasExistingForm, setHasExistingForm] = useState(false);

  useEffect(() => {
    fetch('/api/admin/feedback/form').then(r => r.json()).then(d => {
      if (d.form) {
        setForm({ title: d.form.title, description: d.form.description ?? '', documentCode: d.form.documentCode ?? '', isActive: d.form.isActive, categories: d.form.categories ?? [] });
        setHasExistingForm(true);
      }
    }).catch(() => toast('Form yüklenemedi', 'error')).finally(() => setLoading(false));
  }, [toast]);

  const updateForm = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const addCategory = () => setForm(f => ({ ...f, categories: [...f.categories, { name: '', order: f.categories.length, items: [] }] }));
  const removeCategory = (i: number) => setForm(f => ({ ...f, categories: f.categories.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, order: idx })) }));
  const updateCategory = (i: number, key: keyof Category, val: string | number) => setForm(f => ({ ...f, categories: f.categories.map((c, idx) => idx === i ? { ...c, [key]: val } : c) }));
  const addItem = (ci: number) => setForm(f => ({ ...f, categories: f.categories.map((c, i) => i === ci ? { ...c, items: [...c.items, { text: '', questionType: 'likert_5', isRequired: true, order: c.items.length }] } : c) }));
  const removeItem = (ci: number, ii: number) => setForm(f => ({ ...f, categories: f.categories.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii).map((item, j) => ({ ...item, order: j })) } : c) }));
  const updateItem = <K extends keyof Item>(ci: number, ii: number, key: K, val: Item[K]) => setForm(f => ({ ...f, categories: f.categories.map((c, i) => i === ci ? { ...c, items: c.items.map((item, j) => j === ii ? { ...item, [key]: val } : item) } : c) }));
  const loadTemplate = () => {
    if (form.categories.length > 0 && !confirm('Mevcut kategoriler silinecek. Devam edilsin mi?')) return;
    setForm(f => ({ ...f, categories: DEFAULT_TEMPLATE.map(c => ({ ...c, items: c.items.map(i => ({ ...i })) })) }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast('Form başlığı gerekli', 'error'); return; }
    if (form.categories.length === 0) { toast('En az bir kategori ekleyin', 'error'); return; }
    for (let i = 0; i < form.categories.length; i++) {
      const c = form.categories[i];
      if (!c.name.trim()) { toast(`Kategori ${i + 1} ismi boş`, 'error'); return; }
      if (c.items.length === 0) { toast(`"${c.name}" kategorisinde soru yok`, 'error'); return; }
      for (const item of c.items) { if (!item.text.trim()) { toast(`"${c.name}" kategorisinde boş soru var`, 'error'); return; } }
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/feedback/form', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description || undefined, documentCode: form.documentCode || undefined, isActive: form.isActive,
          categories: form.categories.map((c, ci) => ({ id: c.id, name: c.name, order: ci, items: c.items.map((item, ii) => ({ id: item.id, text: item.text, questionType: item.questionType, isRequired: item.isRequired, order: ii })) })) }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Kaydedilemedi', 'error'); return; }
      toast('Form kaydedildi', 'success');
      setHasExistingForm(true);
    } catch { toast('Bağlantı hatası', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="k-page max-w-4xl mx-auto">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Geri Bildirim Formu</span>
          </div>
          <h1 className="k-page-title">Geri Bildirim Formu</h1>
          <p className="k-page-subtitle">EY.FR.40 eğitim değerlendirme anketini özelleştirin.</p>
        </div>
      </header>

      {/* Meta */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
        <p className="text-[10px] uppercase tracking-[3px] font-bold mb-4" style={{ color: 'var(--k-text-muted)' }}>Form Bilgileri</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>Form Başlığı</label>
            <Input value={form.title} onChange={e => updateForm('title', e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>Doküman Kodu</label>
            <Input value={form.documentCode} onChange={e => updateForm('documentCode', e.target.value)} placeholder="EY.FR.40" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>Açıklama</label>
            <Input value={form.description} onChange={e => updateForm('description', e.target.value)} placeholder="Opsiyonel..." />
          </div>
          <div className="md:col-span-3">
            <label className="flex items-center gap-2.5 cursor-pointer w-fit" onClick={() => updateForm('isActive', !form.isActive)}>
              <div className="relative w-9 h-5 rounded-full" style={{ background: form.isActive ? 'var(--k-primary)' : 'var(--k-border)', transition: 'background 200ms' }}>
                <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" style={{ left: form.isActive ? 'calc(100% - 18px)' : '2px', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)' }} />
              </div>
              <span className="text-[13px] font-medium" style={{ color: form.isActive ? 'var(--k-text-primary)' : 'var(--k-text-muted)' }}>
                Form aktif — yeni eğitim tamamlamalarında gösterilir
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {form.categories.length === 0 ? (
        <div className="rounded-2xl p-14 text-center" style={{ background: 'var(--k-surface)', border: '2px dashed var(--k-border)' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--k-primary-light)' }}>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--k-primary)' }} />
          </div>
          <p className="text-[16px] font-bold mb-1" style={{ color: 'var(--k-text-primary)' }}>Henüz kategori yok</p>
          <p className="text-[13px] mb-6" style={{ color: 'var(--k-text-muted)' }}>EY.FR.40 varsayılanını yükleyin ya da sıfırdan başlayın.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={loadTemplate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: 'var(--k-primary)', color: 'white' }}>
              <Sparkles className="w-4 h-4" /> EY.FR.40 Şablonunu Yükle
            </button>
            <button onClick={addCategory} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
              style={{ background: 'var(--k-surface)', color: 'var(--k-text-primary)', border: '1px solid var(--k-border)' }}>
              <Plus className="w-4 h-4" /> Boş Kategori
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {form.categories.map((cat, catIdx) => (
              <div key={catIdx} className="rounded-2xl overflow-hidden group/cat"
                style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
                {/* Category header */}
                <div className="px-5 py-3.5 flex items-center gap-3"
                  style={{ background: 'var(--k-bg)', borderBottom: '1px solid var(--k-border)' }}>
                  <GripVertical className="w-4 h-4 shrink-0 cursor-grab" style={{ color: 'var(--k-text-muted)' }} />
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                    style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)', border: '1px solid var(--k-primary)30' }}>
                    {catIdx + 1}
                  </div>
                  <input
                    value={cat.name}
                    onChange={e => updateCategory(catIdx, 'name', e.target.value)}
                    placeholder="KATEGORİ ADI"
                    className="flex-1 bg-transparent text-[13px] font-bold uppercase tracking-wider outline-none"
                    style={{ color: 'var(--k-text-primary)' }}
                  />
                  <button onClick={() => removeCategory(catIdx)}
                    className="p-1.5 rounded-lg opacity-0 group-hover/cat:opacity-100"
                    style={{ color: 'var(--k-error)', background: 'var(--k-error-bg)', transition: 'opacity 150ms' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Items */}
                <div>
                  {cat.items.map((item, itemIdx) => {
                    const meta = TYPE_META[item.questionType];
                    return (
                      <div key={itemIdx} className="px-5 py-3 flex items-center gap-3 group/item"
                        style={{ borderBottom: '1px solid var(--k-border)' }}>
                        <span className="text-[10px] font-black w-5 text-center shrink-0 tabular-nums" style={{ color: 'var(--k-text-muted)' }}>{itemIdx + 1}</span>
                        <input
                          value={item.text}
                          onChange={e => updateItem(catIdx, itemIdx, 'text', e.target.value)}
                          placeholder="Soru metni..."
                          className="flex-1 bg-transparent text-[13px] outline-none"
                          style={{ color: 'var(--k-text-primary)' }}
                        />
                        <select value={item.questionType} onChange={e => updateItem(catIdx, itemIdx, 'questionType', e.target.value as QuestionType)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold shrink-0 cursor-pointer"
                          style={{ background: meta.bg, border: `1px solid ${meta.col}40`, color: meta.col }}>
                          {(Object.entries(TYPE_META) as [QuestionType, { label: string; col: string; bg: string }][]).map(([v, m]) => (
                            <option key={v} value={v}>{m.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                          <input type="checkbox" checked={item.isRequired} onChange={e => updateItem(catIdx, itemIdx, 'isRequired', e.target.checked)}
                            className="w-3.5 h-3.5 rounded" style={{ accentColor: 'var(--k-primary)' }} />
                          <span className="text-[11px] font-medium" style={{ color: 'var(--k-text-muted)' }}>Zorunlu</span>
                        </label>
                        <button onClick={() => removeItem(catIdx, itemIdx)}
                          className="p-1.5 rounded-lg opacity-0 group-hover/item:opacity-100"
                          style={{ color: 'var(--k-error)', background: 'var(--k-error-bg)', transition: 'opacity 150ms' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="px-5 py-3">
                    <button onClick={() => addItem(catIdx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ background: 'var(--k-bg)', color: 'var(--k-text-muted)', border: '1px solid var(--k-border)' }}>
                      <Plus className="w-3.5 h-3.5" /> Soru Ekle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={addCategory} className="gap-1.5">
                <Plus className="w-4 h-4" /> Kategori Ekle
              </Button>
              <Button variant="outline" onClick={loadTemplate} className="gap-1.5">
                <RotateCcw className="w-4 h-4" /> Varsayılanı Yükle
              </Button>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[130px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {hasExistingForm ? 'Güncelle' : 'Oluştur'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
