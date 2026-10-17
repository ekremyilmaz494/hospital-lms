'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Trash2, Save, Loader2, GripVertical, Sparkles, ChevronRight,
  CheckCircle2, FileText, Copy, Eye, MoreVertical, FileEdit,
  Archive, ArchiveRestore, X, Lock, Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { FEEDBACK_FORM_TEMPLATES } from '@/lib/feedback-form-templates';

type QuestionType = 'likert_5' | 'yes_partial_no' | 'text';

interface Item { id?: string; text: string; questionType: QuestionType; isRequired: boolean; order: number; }
interface Category { id?: string; name: string; order: number; items: Item[]; }
interface FormDetail {
  id: string;
  title: string;
  description: string;
  documentCode: string;
  isActive: boolean;
  isMandatory: boolean;
  isArchived: boolean;
  categories: Category[];
  responseCount: number;
}
interface FormSummary {
  id: string;
  title: string;
  isActive: boolean;
  isArchived: boolean;
  documentCode: string | null;
  updatedAt: string;
  responseCount: number;
  categoryCount: number;
}

const TYPE_META: Record<QuestionType, { label: string; col: string; bg: string }> = {
  likert_5: { label: '1–5 Puan', col: 'var(--k-success)', bg: 'var(--k-success-bg)' },
  yes_partial_no: { label: 'Evet / Kısmen / Hayır', col: '#6366f1', bg: '#eef2ff' },
  text: { label: 'Serbest Metin', col: '#f59e0b', bg: '#fffbeb' },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

export default function FeedbackFormsAdminPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FeedbackFormsAdminContent />
    </Suspense>
  );
}

function FeedbackFormsAdminContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('formId');

  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [detail, setDetail] = useState<FormDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activateConfirm, setActivateConfirm] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const refreshForms = useCallback(async (archived: boolean = false) => {
    try {
      const url = `/api/admin/feedback/forms${archived ? '?archived=1' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Yüklenemedi');
      const list: FormSummary[] = (data.forms ?? []).map((f: {
        id: string; title: string; isActive: boolean; isArchived: boolean;
        documentCode: string | null; updatedAt: string;
        _count: { responses: number; categories: number };
      }) => ({
        id: f.id, title: f.title, isActive: f.isActive, isArchived: f.isArchived,
        documentCode: f.documentCode, updatedAt: f.updatedAt,
        responseCount: f._count.responses, categoryCount: f._count.categories,
      }));
      setForms(list);
      return list;
    } catch {
      toast('Formlar yüklenemedi', 'error');
      return null;
    }
  }, [toast]);

  // İlk mount + arşiv tab'ı değişiminde liste tazele.
  useEffect(() => { void refreshForms(showArchived); }, [refreshForms, showArchived]);

  // Liste yüklendiğinde URL'deki formId'yi senkronize et:
  // - Hiç seçili yoksa: aktif olanı (yoksa ilkini) seç
  // - Seçili stale ise (ör. tarayıcı history'den silinmiş form): URL'i temizle
  useEffect(() => {
    if (!forms) return;
    if (forms.length === 0) {
      if (selectedId) router.replace('/admin/feedback-forms');
      return;
    }
    if (!selectedId) {
      const target = forms.find(f => f.isActive) ?? forms[0];
      if (target) router.replace(`/admin/feedback-forms?formId=${target.id}`);
      return;
    }
    const exists = forms.some(f => f.id === selectedId);
    if (!exists) router.replace('/admin/feedback-forms');
  }, [forms, selectedId, router]);

  // Seçili form değiştiğinde detayı çek. 404 → URL'i temizle (zombie formId).
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/admin/feedback/forms/${selectedId}`, { cache: 'no-store' })
      .then(async r => {
        if (r.status === 404) {
          if (!cancelled) router.replace('/admin/feedback-forms');
          return null;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Yüklenemedi');
        return d;
      })
      .then(d => {
        if (cancelled || !d) return;
        const f = d.form;
        setDetail({
          id: f.id,
          title: f.title,
          description: f.description ?? '',
          documentCode: f.documentCode ?? '',
          isActive: f.isActive,
          isMandatory: f.isMandatory ?? true,
          isArchived: f.isArchived ?? false,
          categories: f.categories ?? [],
          responseCount: f._count?.responses ?? 0,
        });
      })
      .catch(() => { if (!cancelled) toast('Form detayı yüklenemedi', 'error'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, router, toast]);

  const select = (id: string) => router.replace(`/admin/feedback-forms?formId=${id}`);

  const create = async (templateKey?: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/feedback/forms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateKey ? { templateKey } : {}),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Oluşturulamadı', 'error'); return; }
      // Yeni form daima taslak (arşivsiz) sekmeye düşer.
      setShowArchived(false);
      await refreshForms(false);
      router.replace(`/admin/feedback-forms?formId=${data.formId}`);
      toast('Yeni form taslağı oluşturuldu', 'success');
    } finally { setCreating(false); }
  };

  const handleSave = async () => {
    if (!detail) return;
    if (!detail.title.trim()) return toast('Form başlığı gerekli', 'error');
    for (let i = 0; i < detail.categories.length; i++) {
      const c = detail.categories[i];
      if (!c.name.trim()) return toast(`Kategori ${i + 1} ismi boş`, 'error');
      for (const it of c.items) if (!it.text.trim()) return toast(`"${c.name}" kategorisinde boş soru var`, 'error');
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/feedback/forms/${detail.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: detail.title,
          description: detail.description || undefined,
          documentCode: detail.documentCode || undefined,
          isMandatory: detail.isMandatory,
          categories: detail.categories.map((c, ci) => ({
            id: c.id, name: c.name, order: ci,
            items: c.items.map((it, ii) => ({
              id: it.id, text: it.text, questionType: it.questionType,
              isRequired: it.isRequired, order: ii,
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Kaydedilemedi', 'error'); return; }
      toast('Form kaydedildi', 'success');
      await refreshForms(showArchived);
    } catch { toast('Bağlantı hatası', 'error'); }
    finally { setSaving(false); }
  };

  const handleActivate = async () => {
    if (!detail) return;
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/feedback/forms/${detail.id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Atanamadı', 'error'); return; }
      const n = data.trainingsUpdated ?? 0;
      const mode = data.isMandatory ? 'zorunlu' : 'opsiyonel';
      toast(
        n > 0
          ? `Form aktive edildi · ${n} eğitime ${mode} olarak atandı`
          : `Form aktive edildi · zorunluluk: ${mode}`,
        'success',
      );
      setActivateConfirm(false);
      // Liste tazele — başarılı olursa optimistic update doğrulanır.
      const list = await refreshForms(showArchived);
      // Listeden gelen taze değer ile detail.isActive'i senkronize et — refresh
      // başarısız olduysa eski değerde kal, yanıltıcı UI'ı önle.
      const fresh = list?.find(f => f.id === detail.id);
      if (fresh) {
        setDetail(d => d ? { ...d, isActive: fresh.isActive } : d);
      }
    } finally { setActivating(false); }
  };

  const handleArchiveOrDelete = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/admin/feedback/forms/${detail.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Silinemedi', 'error'); return; }
      toast(data.archived ? (data.message ?? 'Form arşivlendi') : 'Form silindi', 'success');
      setDeleteConfirm(false);
      const list = await refreshForms(showArchived);
      const next = list?.find(f => f.isActive) ?? list?.[0];
      router.replace(next ? `/admin/feedback-forms?formId=${next.id}` : '/admin/feedback-forms');
    } catch { toast('İşlem başarısız', 'error'); }
  };

  const handleRestore = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/admin/feedback/forms/${detail.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Geri alınamadı', 'error'); return; }
      toast('Form arşivden çıkarıldı', 'success');
      // Aktif sekme arşivli ise listede kalmaya devam etmez — taze tab'a geç.
      setShowArchived(false);
      // Yeniden seçim auto-select effect tarafından yapılacak.
      router.replace(`/admin/feedback-forms?formId=${detail.id}`);
    } catch { toast('İşlem başarısız', 'error'); }
  };

  const handleDuplicate = async () => {
    if (!detail) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/feedback/forms/${detail.id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Kopyalanamadı', 'error'); return; }
      await refreshForms(showArchived);
      router.replace(`/admin/feedback-forms?formId=${data.formId}`);
      toast('Form kopyalandı', 'success');
    } finally { setCreating(false); }
  };

  const updateDetail = (patch: Partial<FormDetail>) => setDetail(d => d ? { ...d, ...patch } : d);
  const setCategories = (next: Category[]) => updateDetail({ categories: next });

  const addCategory = () => detail && setCategories([...detail.categories, { name: '', order: detail.categories.length, items: [] }]);
  const removeCategory = (i: number) => detail && setCategories(detail.categories.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, order: idx })));
  const updateCategory = (i: number, key: keyof Category, val: string | number) => detail && setCategories(detail.categories.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  const addItem = (ci: number) => detail && setCategories(detail.categories.map((c, i) => i === ci ? { ...c, items: [...c.items, { text: '', questionType: 'likert_5', isRequired: true, order: c.items.length }] } : c));
  const removeItem = (ci: number, ii: number) => detail && setCategories(detail.categories.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii).map((it, j) => ({ ...it, order: j })) } : c));
  const updateItem = <K extends keyof Item>(ci: number, ii: number, key: K, val: Item[K]) => detail && setCategories(detail.categories.map((c, i) => i === ci ? { ...c, items: c.items.map((it, j) => j === ii ? { ...it, [key]: val } : it) } : c));

  const activeForm = useMemo(() => forms?.find(f => f.isActive) ?? null, [forms]);
  const selected = useMemo(() => forms?.find(f => f.id === selectedId) ?? null, [forms, selectedId]);

  if (!forms) return <PageLoading />;

  return (
    <div className="k-page">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Geri Bildirim Formları</span>
          </div>
          <h1 className="k-page-title">Geri Bildirim Formları</h1>
          <p className="k-page-subtitle">Birden çok form taslağı oluşturup birini aktive edin. Aktif form personel eğitimleri tamamladığında doldurulur.</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--k-primary)', color: 'white' }}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Yeni Form
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Şablondan oluştur</DropdownMenuLabel>
              {FEEDBACK_FORM_TEMPLATES.map(tpl => (
                <DropdownMenuItem key={tpl.key} onClick={() => create(tpl.key)} className="flex flex-col items-start gap-0.5 py-2.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    {tpl.key === 'blank' ? <FileEdit className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {tpl.label}
                  </div>
                  <span className="text-[11px] pl-6" style={{ color: 'var(--k-text-muted)' }}>{tpl.description}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => create()} className="text-[13px]">
                Boştan başla (şablonsuz)
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Tab: Aktif/Taslak ↔ Arşiv */}
      <div className="flex items-center gap-1 mb-4 rounded-xl p-1 w-fit"
        style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)' }}>
        <button
          onClick={() => setShowArchived(false)}
          className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold"
          style={{
            background: !showArchived ? 'var(--k-surface)' : 'transparent',
            color: !showArchived ? 'var(--k-text-primary)' : 'var(--k-text-muted)',
            boxShadow: !showArchived ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
          }}
        >Aktif & Taslak</button>
        <button
          onClick={() => setShowArchived(true)}
          className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5"
          style={{
            background: showArchived ? 'var(--k-surface)' : 'transparent',
            color: showArchived ? 'var(--k-text-primary)' : 'var(--k-text-muted)',
            boxShadow: showArchived ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
          }}
        >
          <Archive className="w-3.5 h-3.5" /> Arşiv
        </button>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(280px, 340px) 1fr' }}>
        {/* ── Sol liste ── */}
        <FormList
          forms={forms}
          selectedId={selectedId}
          onSelect={select}
          archivedView={showArchived}
        />

        {/* ── Sağ editör ── */}
        <div className="min-w-0">
          {!selectedId ? (
            <EmptyDetailState />
          ) : detailLoading || !detail ? (
            <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
              <Loader2 className="w-6 h-6 mx-auto animate-spin" style={{ color: 'var(--k-primary)' }} />
            </div>
          ) : (
            <FormEditor
              detail={detail}
              saving={saving}
              activating={activating}
              activeForm={activeForm}
              onSave={handleSave}
              onActivateClick={() => setActivateConfirm(true)}
              onDeleteClick={() => setDeleteConfirm(true)}
              onDuplicate={handleDuplicate}
              onPreview={() => setPreviewOpen(true)}
              onRestore={handleRestore}
              updateDetail={updateDetail}
              addCategory={addCategory}
              removeCategory={removeCategory}
              updateCategory={updateCategory}
              addItem={addItem}
              removeItem={removeItem}
              updateItem={updateItem}
            />
          )}
        </div>
      </div>

      {/* ── Yayına alma onayı ── */}
      <ConfirmDialog
        open={activateConfirm}
        onOpenChange={setActivateConfirm}
        tone="primary"
        icon={<CheckCircle2 className="w-5 h-5" />}
        title="Form yayına alınsın mı?"
        ctaLabel={detail?.isMandatory ? 'Zorunlu Olarak Yayına Al' : 'Opsiyonel Olarak Yayına Al'}
        ctaIcon={<CheckCircle2 className="w-4 h-4" />}
        loading={activating}
        onConfirm={handleActivate}
      >
        <p className="text-[13.5px] leading-relaxed">
          <strong className="font-bold">&ldquo;{detail?.title}&rdquo;</strong> aktif form olacak ve organizasyondaki{' '}
          <strong>tüm eğitimlerde</strong> feedback zorunluluğu{' '}
          <strong style={{ color: detail?.isMandatory ? 'var(--k-success)' : 'var(--k-text-muted)' }}>
            {detail?.isMandatory ? 'AÇILACAK' : 'KAPATILACAK'}
          </strong>.
        </p>
        {activeForm && activeForm.id !== selected?.id && (
          <InfoBox tone="warn">
            Şu an aktif olan <strong>&ldquo;{activeForm.title}&rdquo;</strong> taslağa düşürülecek.
          </InfoBox>
        )}
        <InfoBox tone={detail?.isMandatory ? 'success' : 'muted'}>
          {detail?.isMandatory
            ? 'Personel eğitim sertifikasını ancak bu formu doldurarak alabilecek.'
            : 'Personel formu doldurmadan da sertifikasını alabilecek (form opsiyonel).'}
        </InfoBox>
      </ConfirmDialog>

      {/* ── Sil/Arşivle onayı ── */}
      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        tone="danger"
        icon={detail && detail.responseCount > 0 ? <Archive className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
        title={
          detail && detail.responseCount > 0
            ? `"${detail.title}" arşivlensin mi?`
            : `"${detail?.title ?? 'Form'}" silinsin mi?`
        }
        ctaLabel={detail && detail.responseCount > 0 ? 'Arşivle' : 'Sil'}
        ctaIcon={detail && detail.responseCount > 0 ? <Archive className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
        ctaTone={detail && detail.responseCount > 0 ? 'warn' : 'danger'}
        onConfirm={handleArchiveOrDelete}
      >
        {detail && detail.responseCount > 0 ? (
          <>
            <p className="text-[13.5px] leading-relaxed">
              Bu forma <strong>{detail.responseCount}</strong> yanıt verilmiş.
              Silmek yerine arşive alınacak — rapor geçmişi korunur, listede gizlenir.
            </p>
            <InfoBox tone="muted">
              İstediğin zaman <strong>Arşiv</strong> sekmesinden &ldquo;Geri Al&rdquo; ile döndürebilirsin.
            </InfoBox>
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed">
            Bu işlem geri alınamaz. Form aktif değil ve yanıtsız olduğu için kalıcı silinecek.
          </p>
        )}
      </ConfirmDialog>

      {/* ── Önizleme modal ── */}
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} detail={detail} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sol liste
// ═══════════════════════════════════════════════════════════════════════════

function FormList({ forms, selectedId, onSelect, archivedView }: {
  forms: FormSummary[]; selectedId: string | null; onSelect: (id: string) => void; archivedView: boolean;
}) {
  if (forms.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'var(--k-surface)', border: '1px dashed var(--k-border)' }}
      >
        {archivedView
          ? <Archive className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--k-text-muted)' }} />
          : <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--k-text-muted)' }} />}
        <p className="text-[13px] font-semibold mb-1">
          {archivedView ? 'Arşivde form yok' : 'Henüz form yok'}
        </p>
        <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
          {archivedView
            ? 'Yanıt verilmiş ama artık kullanılmayan formlar buraya düşer.'
            : '"Yeni Form" ile bir şablondan başla.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden h-fit" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--k-bg)', borderBottom: '1px solid var(--k-border)' }}>
        <p className="text-[10px] uppercase tracking-[2.5px] font-bold" style={{ color: 'var(--k-text-muted)' }}>
          {forms.length} form
        </p>
        {archivedView && <Archive className="w-3.5 h-3.5" style={{ color: 'var(--k-text-muted)' }} />}
      </div>
      <ul>
        {forms.map((f, idx) => {
          const selected = f.id === selectedId;
          const isLast = idx === forms.length - 1;
          return (
            <li key={f.id}>
              <button
                onClick={() => onSelect(f.id)}
                className="w-full text-left px-4 py-3.5 flex flex-col gap-1.5 hover:bg-[var(--k-bg)]"
                style={{
                  background: selected ? 'var(--k-primary-light)' : 'transparent',
                  borderBottom: isLast ? 'none' : '1px solid var(--k-border)',
                  borderLeft: selected ? '3px solid var(--k-primary)' : '3px solid transparent',
                  paddingLeft: selected ? '13px' : '16px',
                  transitionProperty: 'background, border-color',
                  transitionDuration: '120ms',
                }}
              >
                <div className="flex items-start gap-2 justify-between">
                  <span
                    className="text-[13px] font-semibold leading-tight line-clamp-2"
                    style={{ color: selected ? 'var(--k-primary)' : 'var(--k-text-primary)' }}
                  >
                    {f.title}
                  </span>
                  <StatusPill active={f.isActive} archived={f.isArchived} />
                </div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {f.responseCount}
                  </span>
                  <span>·</span>
                  <span>{timeAgo(f.updatedAt)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusPill({ active, archived }: { active: boolean; archived?: boolean }) {
  if (archived) {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'var(--k-bg)', color: 'var(--k-text-muted)', border: '1px solid var(--k-border)' }}
      >
        <Archive className="w-2.5 h-2.5" /> Arşiv
      </span>
    );
  }
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: active ? 'var(--k-success-bg)' : 'var(--k-bg)',
        color: active ? 'var(--k-success)' : 'var(--k-text-muted)',
        border: `1px solid ${active ? 'var(--k-success)' : 'var(--k-border)'}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? 'var(--k-success)' : 'var(--k-text-muted)' }}
      />
      {active ? 'Aktif' : 'Taslak'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sağ editör
// ═══════════════════════════════════════════════════════════════════════════

interface EditorProps {
  detail: FormDetail;
  saving: boolean;
  activating: boolean;
  activeForm: FormSummary | null;
  onSave: () => void;
  onActivateClick: () => void;
  onDeleteClick: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  onRestore: () => void;
  updateDetail: (patch: Partial<FormDetail>) => void;
  addCategory: () => void;
  removeCategory: (i: number) => void;
  updateCategory: (i: number, key: keyof Category, val: string | number) => void;
  addItem: (ci: number) => void;
  removeItem: (ci: number, ii: number) => void;
  updateItem: <K extends keyof Item>(ci: number, ii: number, key: K, val: Item[K]) => void;
}

function FormEditor(p: EditorProps) {
  const { detail } = p;
  const totalQuestions = detail.categories.reduce((s, c) => s + c.items.length, 0);
  const canActivate = !detail.isActive && !detail.isArchived && detail.categories.length > 0 && totalQuestions > 0;
  const archived = detail.isArchived;
  // Aktivasyon = yayına alma + tüm eğitimlere atama (tek aksiyon).
  // Kullanıcı kararını yansıtacak şekilde buton metni "Yayına Al" — net ve kısa.
  // Atama davranışı confirmation modal'ında detaylandırılır.
  const activateDisabledReason = !detail.isActive && !archived
    ? detail.categories.length === 0
      ? 'Yayına almak için en az 1 kategori ekle'
      : totalQuestions === 0
        ? 'Yayına almak için en az 1 soru ekle'
        : null
    : null;
  const deleteLabel = detail.responseCount > 0 ? 'Arşivle' : 'Sil';

  return (
    <div className="space-y-4">
      {/* ── Üst aksiyon barı (sticky) ── */}
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-3 flex-wrap sticky top-2 z-10"
        style={{
          background: 'var(--k-surface)',
          border: '1px solid var(--k-border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <StatusPill active={detail.isActive} archived={archived} />
        <div className="text-[13px] font-semibold leading-tight flex-1 min-w-0 truncate">{detail.title}</div>

        {archived ? (
          <button
            type="button"
            onClick={p.onRestore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold"
            style={{ background: 'var(--k-primary)', color: 'white' }}
          >
            <ArchiveRestore className="w-4 h-4" /> Geri Al
          </button>
        ) : !detail.isActive ? (
          <button
            type="button"
            onClick={p.onActivateClick}
            disabled={!canActivate || p.activating}
            title={activateDisabledReason ?? 'Yayına al ve tüm eğitimlere ata'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: canActivate ? 'var(--k-primary)' : 'var(--k-border)',
              color: canActivate ? 'white' : 'var(--k-text-muted)',
              boxShadow: canActivate ? '0 1px 2px rgba(13, 150, 104, 0.3)' : 'none',
            }}
          >
            {p.activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Yayına Al
          </button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
            aria-label="Form aksiyonları"
            style={{ border: '1px solid var(--k-border)', background: 'var(--k-surface)' }}
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={p.onDuplicate} className="gap-2">
              <Copy className="w-4 h-4" /> Kopyala
            </DropdownMenuItem>
            <DropdownMenuItem onClick={p.onPreview} className="gap-2">
              <Eye className="w-4 h-4" /> Önizle
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={p.onDeleteClick}
              disabled={detail.isActive || archived}
              className="gap-2"
              style={{ color: 'var(--k-error)' }}
            >
              <Trash2 className="w-4 h-4" /> {deleteLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={p.onSave} disabled={p.saving || archived} size="sm" variant="outline" className="gap-2">
          {p.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Kaydet
        </Button>
      </div>

      {/* Yayına alma engeli açıklaması — kullanıcı butonun neden disabled olduğunu görsün. */}
      {!detail.isActive && !archived && activateDisabledReason && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 text-[12.5px]"
          style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b33',
            color: 'var(--k-text-primary)',
          }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--k-accent)', color: 'white' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span>
            <strong>Yayına almak için:</strong> {activateDisabledReason.toLowerCase()}.
          </span>
        </div>
      )}

      {/* ── Form meta ── */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
          >
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="text-[13px] font-bold tracking-wide uppercase" style={{ color: 'var(--k-text-primary)' }}>
            Form Bilgileri
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>Form Başlığı</label>
            <Input value={detail.title} onChange={e => p.updateDetail({ title: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>Doküman Kodu</label>
            <Input value={detail.documentCode} onChange={e => p.updateDetail({ documentCode: e.target.value })} placeholder="Örn. EY.FR.40" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>Açıklama</label>
            <Input value={detail.description} onChange={e => p.updateDetail({ description: e.target.value })} placeholder="Opsiyonel..." />
          </div>

          {/* Zorunluluk seçimi — segmented control (Zorunlu / Opsiyonel) */}
          <div className="md:col-span-3">
            <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--k-text-muted)' }}>
              Zorunluluk Politikası
            </p>
            <div
              className="rounded-xl p-1 flex gap-1"
              style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)' }}
            >
              <MandatoryOption
                active={detail.isMandatory}
                onClick={() => p.updateDetail({ isMandatory: true })}
                icon={<Lock className="w-4 h-4" />}
                label="Zorunlu"
                description="Sertifika için form şart"
                accent="var(--k-success)"
                accentBg="var(--k-success-bg)"
              />
              <MandatoryOption
                active={!detail.isMandatory}
                onClick={() => p.updateDetail({ isMandatory: false })}
                icon={<Unlock className="w-4 h-4" />}
                label="Opsiyonel"
                description="Form atlanabilir"
                accent="var(--k-text-muted)"
                accentBg="var(--k-surface)"
              />
            </div>
            <p className="text-[11.5px] mt-2" style={{ color: 'var(--k-text-muted)' }}>
              {detail.isMandatory
                ? 'Yayına alındığında tüm eğitimlerde feedback zorunluluğu açılır. Personel sertifikayı ancak formu doldurarak alabilir.'
                : 'Yayına alındığında form sunulur ama doldurmak zorunlu değildir. Personel sertifikayı doldurmadan da alır.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Kategoriler ── */}
      {detail.categories.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--k-surface)', border: '2px dashed var(--k-border)' }}
        >
          <p className="text-[14px] font-bold mb-1">Henüz kategori yok</p>
          <p className="text-[12px] mb-5" style={{ color: 'var(--k-text-muted)' }}>
            En az 1 kategori ve 1 soru ekledikten sonra formu aktive edebilirsin.
          </p>
          <Button onClick={p.addCategory} variant="outline" className="gap-1.5">
            <Plus className="w-4 h-4" /> Kategori Ekle
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {detail.categories.map((cat, catIdx) => (
              <div
                key={cat.id ?? `new-${catIdx}`}
                className="rounded-2xl overflow-hidden group/cat"
                style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}
              >
                <div
                  className="px-5 py-3.5 flex items-center gap-3"
                  style={{ background: 'var(--k-bg)', borderBottom: '1px solid var(--k-border)' }}
                >
                  <GripVertical className="w-4 h-4 shrink-0" style={{ color: 'var(--k-text-muted)' }} />
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                    style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
                  >
                    {catIdx + 1}
                  </div>
                  <input
                    value={cat.name}
                    onChange={e => p.updateCategory(catIdx, 'name', e.target.value)}
                    placeholder="KATEGORİ ADI"
                    className="flex-1 bg-transparent text-[13px] font-bold uppercase tracking-wider outline-none"
                    style={{ color: 'var(--k-text-primary)' }}
                  />
                  <button
                    onClick={() => p.removeCategory(catIdx)}
                    className="p-1.5 rounded-lg opacity-0 group-hover/cat:opacity-100"
                    style={{
                      color: 'var(--k-error)', background: 'var(--k-error-bg)',
                      transitionProperty: 'opacity', transitionDuration: '150ms',
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  {cat.items.map((item, itemIdx) => {
                    const meta = TYPE_META[item.questionType];
                    return (
                      <div
                        key={item.id ?? `new-${itemIdx}`}
                        className="px-5 py-3 flex items-center gap-3 group/item"
                        style={{ borderBottom: '1px solid var(--k-border)' }}
                      >
                        <span
                          className="text-[10px] font-black w-5 text-center shrink-0 tabular-nums"
                          style={{ color: 'var(--k-text-muted)' }}
                        >{itemIdx + 1}</span>
                        <input
                          value={item.text}
                          onChange={e => p.updateItem(catIdx, itemIdx, 'text', e.target.value)}
                          placeholder="Soru metni..."
                          className="flex-1 bg-transparent text-[13px] outline-none"
                          style={{ color: 'var(--k-text-primary)' }}
                        />
                        <select
                          value={item.questionType}
                          onChange={e => p.updateItem(catIdx, itemIdx, 'questionType', e.target.value as QuestionType)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold shrink-0 cursor-pointer"
                          style={{ background: meta.bg, border: `1px solid ${meta.col}40`, color: meta.col }}
                        >
                          {(Object.entries(TYPE_META) as [QuestionType, { label: string; col: string; bg: string }][]).map(([v, m]) => (
                            <option key={v} value={v}>{m.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isRequired}
                            onChange={e => p.updateItem(catIdx, itemIdx, 'isRequired', e.target.checked)}
                            className="w-3.5 h-3.5 rounded"
                            style={{ accentColor: 'var(--k-primary)' }}
                          />
                          <span className="text-[11px] font-medium" style={{ color: 'var(--k-text-muted)' }}>Zorunlu</span>
                        </label>
                        <button
                          onClick={() => p.removeItem(catIdx, itemIdx)}
                          className="p-1.5 rounded-lg opacity-0 group-hover/item:opacity-100"
                          style={{
                            color: 'var(--k-error)', background: 'var(--k-error-bg)',
                            transitionProperty: 'opacity', transitionDuration: '150ms',
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="px-5 py-3">
                    <button
                      onClick={() => p.addItem(catIdx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{
                        background: 'var(--k-bg)', color: 'var(--k-text-muted)',
                        border: '1px solid var(--k-border)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Soru Ekle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={p.addCategory} className="gap-1.5">
              <Plus className="w-4 h-4" /> Kategori Ekle
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Premium Confirm Dialog — tone-aware (primary/danger/warn)
// ═══════════════════════════════════════════════════════════════════════════

type Tone = 'primary' | 'danger' | 'warn' | 'success' | 'muted';

const toneStyles: Record<Exclude<Tone, 'muted'>, { color: string; bg: string }> = {
  primary: { color: 'var(--k-primary)', bg: 'var(--k-primary-light)' },
  success: { color: 'var(--k-success)', bg: 'var(--k-success-bg)' },
  danger: { color: 'var(--k-error)', bg: 'var(--k-error-bg)' },
  warn: { color: 'var(--k-accent)', bg: '#fffbeb' },
};

function ConfirmDialog({
  open, onOpenChange, tone, icon, title, children,
  ctaLabel, ctaIcon, ctaTone, loading, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tone: Exclude<Tone, 'muted'>;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  ctaLabel: string;
  ctaIcon: React.ReactNode;
  ctaTone?: Exclude<Tone, 'muted'>;
  loading?: boolean;
  onConfirm: () => void;
}) {
  const { color, bg } = toneStyles[tone];
  const ctaColor = ctaTone ? toneStyles[ctaTone].color : color;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Header — accent strip + icon + title */}
        <div
          className="px-6 pt-6 pb-5 flex items-start gap-4"
          style={{ background: bg, borderBottom: `1px solid ${color}33` }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: color, color: 'white' }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <DialogTitle className="text-[16px] font-bold leading-tight" style={{ color: 'var(--k-text-primary)' }}>
              {title}
            </DialogTitle>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3" style={{ color: 'var(--k-text-primary)' }}>
          {children}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-2.5"
          style={{ background: 'var(--k-bg)', borderTop: '1px solid var(--k-border)' }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{
              background: 'var(--k-surface)',
              color: 'var(--k-text-primary)',
              border: '1px solid var(--k-border)',
            }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold disabled:opacity-50"
            style={{
              background: ctaColor,
              color: 'white',
              boxShadow: `0 1px 3px ${ctaColor}40`,
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : ctaIcon}
            {ctaLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoBox({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  if (tone === 'muted') {
    return (
      <div
        className="rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed"
        style={{
          background: 'var(--k-bg)',
          border: '1px solid var(--k-border)',
          color: 'var(--k-text-muted)',
        }}
      >
        {children}
      </div>
    );
  }
  const { color, bg } = toneStyles[tone];
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed"
      style={{ background: bg, border: `1px solid ${color}33`, color: 'var(--k-text-primary)' }}
    >
      {children}
    </div>
  );
}

function MandatoryOption({ active, onClick, icon, label, description, accent, accentBg }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent: string;
  accentBg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-1 px-3 py-2.5 rounded-lg text-left flex items-center gap-2.5"
      style={{
        background: active ? accentBg : 'transparent',
        border: `1px solid ${active ? accent : 'transparent'}`,
        color: active ? 'var(--k-text-primary)' : 'var(--k-text-muted)',
        transitionProperty: 'background, border-color, color',
        transitionDuration: '160ms',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: active ? accent : 'var(--k-bg)',
          color: active ? 'white' : 'var(--k-text-muted)',
          border: active ? 'none' : '1px solid var(--k-border)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-tight">{label}</p>
        <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--k-text-muted)' }}>{description}</p>
      </div>
    </button>
  );
}

function EmptyDetailState() {
  return (
    <div
      className="rounded-2xl p-14 text-center"
      style={{ background: 'var(--k-surface)', border: '2px dashed var(--k-border)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'var(--k-primary-light)' }}
      >
        <FileText className="w-6 h-6" style={{ color: 'var(--k-primary)' }} />
      </div>
      <p className="text-[16px] font-bold mb-1">Soldan bir form seç</p>
      <p className="text-[13px]" style={{ color: 'var(--k-text-muted)' }}>
        Veya &ldquo;Yeni Form&rdquo; butonu ile şablondan oluştur.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Önizleme — personelin göreceği görünümün read-only kopyası
// ═══════════════════════════════════════════════════════════════════════════

function PreviewDialog({ open, onClose, detail }: {
  open: boolean; onClose: () => void; detail: FormDetail | null;
}) {
  if (!detail) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" /> Personel Önizlemesi
          </DialogTitle>
          <DialogDescription>
            Personelin formu nasıl göreceğinin read-only kopyası. Veriler kaydedilmez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="text-center py-4 rounded-xl" style={{ background: 'var(--k-bg)' }}>
            {detail.documentCode && (
              <p className="text-[10px] uppercase tracking-[2.5px] font-bold mb-1.5" style={{ color: 'var(--k-text-muted)' }}>
                {detail.documentCode}
              </p>
            )}
            <h2 className="text-[20px] font-bold">{detail.title}</h2>
            {detail.description && (
              <p className="text-[13px] mt-2 max-w-md mx-auto" style={{ color: 'var(--k-text-muted)' }}>{detail.description}</p>
            )}
          </div>

          {detail.categories.length === 0 ? (
            <p className="text-center text-[13px] py-8" style={{ color: 'var(--k-text-muted)' }}>
              Henüz kategori eklenmedi.
            </p>
          ) : (
            detail.categories.map((cat, ci) => (
              <div key={cat.id ?? ci} className="space-y-3">
                <h3 className="text-[12px] font-bold uppercase tracking-wider pb-1.5"
                  style={{ color: 'var(--k-primary)', borderBottom: '2px solid var(--k-primary)' }}>
                  {cat.name || `Kategori ${ci + 1}`}
                </h3>
                {cat.items.map((item, ii) => (
                  <PreviewItem key={item.id ?? ii} index={ii + 1} item={item} />
                ))}
              </div>
            ))
          )}

          <p className="text-center text-[11px] pt-2" style={{ color: 'var(--k-text-muted)' }}>
            <X className="inline w-3 h-3 align-text-bottom" /> Bu önizlemedir, gönderim yapılmaz.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewItem({ index, item }: { index: number; item: Item }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}>
      <p className="text-[13px] mb-2.5">
        <span className="font-bold" style={{ color: 'var(--k-text-muted)' }}>{index}.</span>{' '}
        {item.text || <span style={{ color: 'var(--k-text-muted)', fontStyle: 'italic' }}>(soru boş)</span>}
        {item.isRequired && <span className="ml-1" style={{ color: 'var(--k-error)' }}>*</span>}
      </p>
      {item.questionType === 'likert_5' ? (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex-1 py-2 rounded-lg text-center text-[12px] font-semibold"
              style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)', color: 'var(--k-text-muted)' }}>
              {n}
            </div>
          ))}
        </div>
      ) : item.questionType === 'yes_partial_no' ? (
        <div className="flex gap-1.5">
          {['Evet', 'Kısmen', 'Hayır'].map(o => (
            <div key={o} className="flex-1 py-2 rounded-lg text-center text-[12px] font-semibold"
              style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)', color: 'var(--k-text-muted)' }}>
              {o}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg p-2.5 text-[12px]"
          style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)', color: 'var(--k-text-muted)' }}>
          (Cevap kutusu)
        </div>
      )}
    </div>
  );
}
