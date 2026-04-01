'use client';

import { useState, useMemo } from 'react';
import {
  Library,
  Plus,
  Search,
  X,
  Trash2,
  Edit,
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  Download,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuestionItem {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  tags: string[];
  points: number;
  options: QuestionOption[];
  createdAt: string;
  updatedAt: string;
}

type Difficulty = '' | 'easy' | 'medium' | 'hard';

const difficultyConfig: Record<string, { label: string; bg: string; text: string }> = {
  easy: { label: 'Kolay', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  medium: { label: 'Orta', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  hard: { label: 'Zor', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

export default function QuestionBankPage() {
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalCategory, setModalCategory] = useState('');
  const [modalDifficulty, setModalDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [modalTags, setModalTags] = useState('');
  const [modalPoints, setModalPoints] = useState(1);
  const [modalOptions, setModalOptions] = useState(['', '', '', '']);
  const [modalCorrect, setModalCorrect] = useState(-1);
  const [saving, setSaving] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);

  const queryParams = new URLSearchParams({ limit: '100' });
  if (searchQuery) queryParams.set('search', searchQuery);
  if (categoryFilter) queryParams.set('category', categoryFilter);
  if (difficultyFilter) queryParams.set('difficulty', difficultyFilter);

  const { data, isLoading, error, refetch } = useFetch<{
    questions: QuestionItem[];
    total: number;
  }>(`/api/admin/question-bank?${queryParams.toString()}`);

  const questions = data?.questions ?? [];

  // Stats
  const stats = useMemo(() => {
    const total = data?.total ?? 0;
    const categoryCounts: Record<string, number> = {};
    for (const q of questions) {
      categoryCounts[q.category] = (categoryCounts[q.category] ?? 0) + 1;
    }
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = questions.filter((q) => new Date(q.createdAt) >= monthStart).length;

    return {
      total,
      topCategory: topCategory ? `${topCategory[0]} (${topCategory[1]})` : '-',
      thisMonth,
    };
  }, [data, questions]);

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(questions.map((q) => q.category).filter(Boolean));
    return Array.from(cats);
  }, [questions]);

  // Modal helpers
  const openAddModal = () => {
    setEditingId(null);
    setModalText('');
    setModalCategory('');
    setModalDifficulty('medium');
    setModalTags('');
    setModalPoints(1);
    setModalOptions(['', '', '', '']);
    setModalCorrect(-1);
    setShowModal(true);
  };

  const openEditModal = (q: QuestionItem) => {
    setEditingId(q.id);
    setModalText(q.text);
    setModalCategory(q.category);
    setModalDifficulty(q.difficulty as 'easy' | 'medium' | 'hard');
    setModalTags(q.tags.join(', '));
    setModalPoints(q.points);
    const sorted = [...q.options].sort((a, b) => a.order - b.order);
    setModalOptions(sorted.map((o) => o.text).concat(Array(4).fill('')).slice(0, 4));
    setModalCorrect(sorted.findIndex((o) => o.isCorrect));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (modalText.length < 5) {
      toast('Soru metni en az 5 karakter olmalı', 'error');
      return;
    }
    if (modalOptions.some((o) => !o.trim())) {
      toast('Tüm şıklar doldurulmalı', 'error');
      return;
    }
    if (modalCorrect < 0) {
      toast('Doğru cevabı seçin', 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        text: modalText,
        category: modalCategory || 'Genel',
        difficulty: modalDifficulty,
        tags: modalTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        points: modalPoints,
        options: modalOptions.map((text, idx) => ({
          text,
          isCorrect: idx === modalCorrect,
          order: idx,
        })),
      };

      const url = editingId
        ? `/api/admin/question-bank/${editingId}`
        : '/api/admin/question-bank';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kayıt başarısız');
      }

      toast(editingId ? 'Soru güncellendi' : 'Soru eklendi', 'success');
      setShowModal(false);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: QuestionItem) => {
    if (!window.confirm(`Bu soruyu silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/admin/question-bank/${q.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('Soru silindi', 'success');
      refetch();
    } catch {
      toast('Soru silinemedi', 'error');
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/question-bank/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İçe aktarma başarısız');
      toast(`${data.imported} soru içe aktarıldı${data.errors > 0 ? `, ${data.errors} hatalı satır atlandı` : ''}`, 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'İçe aktarma hatası', 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = 'Soru\tŞık A\tŞık B\tŞık C\tŞık D\tDoğru (A/B/C/D)\tZorluk\tKategori\tPuan';
    const example = 'Örnek soru metni?\tBirinci şık\tİkinci şık\tÜçüncü şık\tDördüncü şık\tA\tmedium\tGenel\t1';
    const blob = new Blob([`${header}\n${example}`], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soru-bankasi-sablon.tsv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Soru Bankası"
        subtitle={`${questions.length} soru`}
        action={{ label: 'Soru Ekle', icon: Plus, onClick: openAddModal }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="Toplam Soru" value={stats.total} icon={Library} accentColor="var(--color-primary)" />
        <StatCard title="En Çok Kategori" value={stats.topCategory} icon={Tag} accentColor="var(--color-accent)" />
        <StatCard title="Bu Ay Eklenen" value={stats.thisMonth} icon={Plus} accentColor="var(--color-info)" />
      </div>

      {/* Filters + Import */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Difficulty */}
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Zorluk:
        </span>
        {(['', 'easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
          const label = d === '' ? 'Tümü' : difficultyConfig[d]?.label ?? d;
          const isActive = difficultyFilter === d;
          return (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{
                background: isActive && d ? difficultyConfig[d]?.bg : isActive ? 'var(--color-primary-light)' : 'transparent',
                color: isActive && d ? difficultyConfig[d]?.text : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                border: `1.5px solid ${isActive && d ? difficultyConfig[d]?.text : isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {label}
            </button>
          );
        })}

        {/* Category */}
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border px-2.5 py-1 text-xs"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Soru ara..."
            className="pl-8 h-8 w-56 text-xs"
          />
        </div>

        {/* Import */}
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
          <Download className="h-3.5 w-3.5" /> Şablon
        </Button>
        <label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = '';
            }}
          />
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            <FileUp className="h-3.5 w-3.5" /> {importing ? 'İçe aktarılıyor...' : 'Excel İçe Aktar'}
          </span>
        </label>
      </div>

      {/* Question List */}
      <div className="space-y-2">
        {questions.length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Soru bankasında henüz soru yok. &quot;Soru Ekle&quot; butonuyla başlayın.
            </p>
          </div>
        ) : (
          questions.map((q) => {
            const isExpanded = expandedId === q.id;
            const dc = difficultyConfig[q.difficulty] ?? difficultyConfig.medium;
            return (
              <div
                key={q.id}
                className="rounded-xl border"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {/* Badges */}
                  <div className="flex shrink-0 gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: dc.bg, color: dc.text }}
                    >
                      {dc.label}
                    </span>
                    {q.category && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                      >
                        {q.category}
                      </span>
                    )}
                  </div>

                  {/* Text + tags */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {q.text.slice(0, 150)}{q.text.length > 150 ? '...' : ''}
                    </p>
                    {q.tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5">
                        {q.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[9px] rounded px-1 py-0.5" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}
                    >
                      {q.points} puan
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                      className="rounded-md p-1.5"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(q); }}
                      className="rounded-md p-1.5"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    ) : (
                      <ChevronDown className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    )}
                  </div>
                </button>

                {/* Expanded: options */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="grid grid-cols-2 gap-2">
                      {[...q.options].sort((a, b) => a.order - b.order).map((opt, idx) => (
                        <div
                          key={opt.id}
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{
                            background: opt.isCorrect ? 'var(--color-success-bg)' : 'var(--color-bg)',
                            border: `1px solid ${opt.isCorrect ? 'var(--color-success)' : 'var(--color-border)'}`,
                          }}
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{
                              background: opt.isCorrect ? 'var(--color-success)' : 'var(--color-border)',
                              color: opt.isCorrect ? 'white' : 'var(--color-text-muted)',
                            }}
                          >
                            {opt.isCorrect ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
                            {opt.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="mx-4 w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-sm font-bold">{editingId ? 'Soruyu Düzenle' : 'Yeni Soru Ekle'}</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Soru metni */}
              <div>
                <Label>Soru Metni *</Label>
                <textarea
                  value={modalText}
                  onChange={(e) => setModalText(e.target.value)}
                  placeholder="Soru metnini yazın..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm resize-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>

              {/* Kategori + Zorluk + Puan */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Kategori</Label>
                  <Input
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    placeholder="Genel"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Zorluk</Label>
                  <div className="flex gap-1 mt-1">
                    {(['easy', 'medium', 'hard'] as const).map((d) => {
                      const dc = difficultyConfig[d];
                      const isActive = modalDifficulty === d;
                      return (
                        <button
                          key={d}
                          onClick={() => setModalDifficulty(d)}
                          className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold"
                          style={{
                            background: isActive ? dc.bg : 'transparent',
                            color: isActive ? dc.text : 'var(--color-text-muted)',
                            border: `1.5px solid ${isActive ? dc.text : 'var(--color-border)'}`,
                          }}
                        >
                          {dc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>Puan</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={modalPoints}
                    onChange={(e) => setModalPoints(Number(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Etiketler */}
              <div>
                <Label>Etiketler (virgülle ayırın)</Label>
                <Input
                  value={modalTags}
                  onChange={(e) => setModalTags(e.target.value)}
                  placeholder="enfeksiyon, hijyen, el yıkama"
                  className="mt-1"
                />
              </div>

              {/* Şıklar */}
              <div>
                <Label>Şıklar *</Label>
                <div className="mt-1 space-y-2">
                  {['A', 'B', 'C', 'D'].map((letter, idx) => (
                    <label
                      key={letter}
                      className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer"
                      style={{
                        border: `1.5px solid ${modalCorrect === idx ? 'var(--color-success)' : 'var(--color-border)'}`,
                        background: modalCorrect === idx ? 'var(--color-success-bg)' : 'var(--color-surface)',
                      }}
                    >
                      <input
                        type="radio"
                        name="modal-correct"
                        checked={modalCorrect === idx}
                        onChange={() => setModalCorrect(idx)}
                        className="sr-only"
                      />
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{
                          background: modalCorrect === idx ? 'var(--color-success)' : 'var(--color-border)',
                          color: modalCorrect === idx ? 'white' : 'var(--color-text-muted)',
                        }}
                      >
                        {modalCorrect === idx ? <Check className="h-3 w-3" /> : letter}
                      </span>
                      <Input
                        value={modalOptions[idx]}
                        onChange={(e) => {
                          const next = [...modalOptions];
                          next[idx] = e.target.value;
                          setModalOptions(next);
                        }}
                        placeholder={`${letter} şıkkı`}
                        className="flex-1 h-7 border-0 bg-transparent text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-lg">
                İptal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg gap-1.5 text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
