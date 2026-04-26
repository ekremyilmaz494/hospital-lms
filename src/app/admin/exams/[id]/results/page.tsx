'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Users,
  Target,
  Clock,
  Download,
  FileSpreadsheet,
  Search,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shared/toast';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/shared/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

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

const cardStyle: React.CSSProperties = {
  background: K.SURFACE,
  border: `1.5px solid ${K.BORDER}`,
  borderRadius: 14,
  boxShadow: K.SHADOW_CARD,
};

const sectionHeading: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  fontFamily: K.FONT_DISPLAY,
  color: K.TEXT_PRIMARY,
};

const ChartSkeleton = () => (
  <div className="h-64 rounded-2xl animate-pulse" style={{ background: K.BG }} />
);
const PassRateRadial = dynamic(() => import('@/components/shared/charts/exam-results-charts').then(m => ({ default: m.PassRateRadial })), { ssr: false, loading: ChartSkeleton });
const ScoreDistributionChart = dynamic(() => import('@/components/shared/charts/exam-results-charts').then(m => ({ default: m.ScoreDistributionChart })), { ssr: false, loading: ChartSkeleton });

interface ExamInfo {
  id: string;
  title: string;
  passingScore: number;
  totalQuestions: number;
  startDate: string;
  endDate: string;
}

interface Summary {
  totalAssigned: number;
  totalStarted: number;
  totalCompleted: number;
  totalPassed: number;
  totalFailed: number;
  avgScore: number;
  avgDurationMinutes: number;
  passRate: number;
}

interface DeptStat {
  departmentName: string;
  totalAssigned: number;
  passed: number;
  passRate: number;
}

interface QuestionStat {
  questionId: string;
  questionText: string;
  correctAnswerRate: number;
  totalAnswers: number;
}

interface Attempt {
  userId: string;
  userFullName: string;
  department: string;
  attemptNumber: number;
  postExamScore: number | null;
  isPassed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number;
}

interface ResultsData {
  exam: ExamInfo;
  summary: Summary;
  departmentStats: DeptStat[];
  questionStats: QuestionStat[];
  attempts: Attempt[];
}

type AttemptFilter = 'all' | 'passed' | 'failed';

export default function ExamResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useFetch<ResultsData>(
    `/api/admin/standalone-exams/${id}/results`,
  );

  const [attemptFilter, setAttemptFilter] = useState<AttemptFilter>('all');
  const [attemptSearch, setAttemptSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const exam = data?.exam;
  const summary = data?.summary;
  const departmentStats = data?.departmentStats ?? [];
  const attempts = data?.attempts ?? [];

  // Skor dağılımı histogram
  const scoreDistribution = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${i * 10 + 10}`,
      count: 0,
      aboveThreshold: false,
    }));
    for (const a of attempts) {
      if (a.postExamScore === null) continue;
      const binIdx = Math.min(Math.floor(a.postExamScore / 10), 9);
      bins[binIdx].count++;
    }
    const threshold = exam?.passingScore ?? 70;
    for (const bin of bins) {
      const upper = parseInt(bin.range.split('-')[1]);
      bin.aboveThreshold = upper > threshold;
    }
    return bins;
  }, [attempts, exam?.passingScore]);

  // Filtreleme
  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      if (attemptFilter === 'passed' && !a.isPassed) return false;
      if (attemptFilter === 'failed' && a.isPassed) return false;
      if (attemptSearch) {
        const q = attemptSearch.toLowerCase();
        return (
          a.userFullName.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [attempts, attemptFilter, attemptSearch]);

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    setDownloading(format);
    try {
      const res = await fetch(
        `/api/admin/standalone-exams/${id}/export?format=${format}`,
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sinav-sonuclari.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Dosya indirilemedi. Lütfen tekrar deneyin.', 'error');
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: K.ERROR }}>
          {error || 'Veriler yüklenemedi'}
        </div>
      </div>
    );
  }

  const sortedDepts = [...departmentStats].sort((a, b) => b.passRate - a.passRate);
  const attemptColumns: ColumnDef<Attempt>[] = [
    {
      accessorKey: 'userFullName',
      header: 'İsim',
      size: 200,
      cell: ({ row }) => (
        <span className="font-medium truncate block" style={{ color: K.TEXT_PRIMARY }}>
          {row.getValue('userFullName')}
        </span>
      ),
    },
    {
      accessorKey: 'department',
      header: 'Departman',
      size: 130,
      cell: ({ row }) => (
        <span className="text-xs" style={{ color: K.TEXT_SECONDARY }}>
          {row.getValue('department') || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'postExamScore',
      header: 'Puan',
      size: 90,
      cell: ({ row }) => {
        const score = row.original.postExamScore;
        const isBelow = score !== null && score < (exam?.passingScore ?? 70);
        return (
          <span
            className="font-bold"
            style={{
              fontFamily: 'var(--font-mono)',
              color: isBelow ? K.ERROR : K.TEXT_PRIMARY,
            }}
          >
            {score !== null ? `${score}/100` : '-'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Durum',
      size: 90,
      cell: ({ row }) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full"
          style={{
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 600,
            background: row.original.isPassed ? K.PRIMARY_LIGHT : K.ERROR_BG,
            color: row.original.isPassed ? K.PRIMARY : K.ERROR,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: row.original.isPassed ? K.PRIMARY : K.ERROR,
            }}
          />
          {row.original.isPassed ? 'Geçti' : 'Kaldı'}
        </span>
      ),
    },
    {
      accessorKey: 'attemptNumber',
      header: 'Deneme',
      size: 80,
      cell: ({ row }) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          #{row.getValue('attemptNumber')}
        </span>
      ),
    },
    {
      accessorKey: 'durationMinutes',
      header: 'Süre',
      size: 70,
      cell: ({ row }) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: K.TEXT_SECONDARY }}>
          {row.getValue('durationMinutes')} dk
        </span>
      ),
    },
    {
      accessorKey: 'completedAt',
      header: 'Tarih',
      size: 100,
      cell: ({ row }) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: K.TEXT_MUTED }}>
          {row.original.completedAt
            ? new Date(row.original.completedAt).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ ...sectionHeading, fontSize: 22 }} className="text-balance">{exam!.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm" style={{ color: K.TEXT_SECONDARY }}>
              {exam!.totalQuestions} soru · Baraj: {exam!.passingScore}%
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleDownload('pdf')}
            disabled={downloading === 'pdf'}
            className="gap-2 rounded-xl text-sm"
            style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
          >
            <Download className="h-4 w-4" />
            {downloading === 'pdf' ? 'İndiriliyor...' : 'PDF İndir'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload('xlsx')}
            disabled={downloading === 'xlsx'}
            className="gap-2 rounded-xl text-sm"
            style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {downloading === 'xlsx' ? 'İndiriliyor...' : 'Excel İndir'}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Toplam Katılımcı"
          value={summary!.totalAssigned}
          icon={Users}
          accentColor={K.PRIMARY}
        />
        <div
          className="relative overflow-hidden p-6"
          style={cardStyle}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: K.PRIMARY }} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: K.TEXT_MUTED }}>
                Geçme Oranı
              </p>
              <p className="mt-2 text-3xl font-bold" style={{ fontFamily: K.FONT_DISPLAY, color: K.PRIMARY }}>
                %{summary!.passRate}
              </p>
            </div>
            <div style={{ width: 64, height: 64 }}>
              <PassRateRadial passRate={summary!.passRate} />
            </div>
          </div>
        </div>
        <StatCard
          title="Ortalama Puan"
          value={summary!.avgScore}
          icon={Target}
          accentColor={K.ACCENT}
        />
        <StatCard
          title="Ortalama Süre"
          value={`${summary!.avgDurationMinutes} dk`}
          icon={Clock}
          accentColor={K.INFO}
        />
      </div>

      {/* 2 Column: Department + Score Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Departman Analizi */}
        <div className="p-6" style={cardStyle}>
          <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Departman Analizi</h3>
          {sortedDepts.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: K.TEXT_MUTED }}>
              Personel sınavı tamamladıkça sonuçlar burada görünecek.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedDepts.map((d) => (
                <div key={d.departmentName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: K.TEXT_PRIMARY }}>
                      {d.departmentName}
                    </span>
                    <span className="text-xs" style={{ color: K.TEXT_MUTED }}>
                      {d.passed}/{d.totalAssigned} geçti
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full" style={{ background: K.BORDER_LIGHT }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.passRate}%`,
                        background: d.passRate >= 70 ? K.PRIMARY : d.passRate >= 50 ? K.WARNING : K.ERROR,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skor Dağılımı */}
        <div className="p-6" style={cardStyle}>
          <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Skor Dağılımı</h3>
          <ScoreDistributionChart data={scoreDistribution} passingScore={exam!.passingScore} />
        </div>
      </div>


      {/* Katılımcı Tablosu */}
      <div className="p-6" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={sectionHeading}>Katılımcı Sonuçları</h3>
          <div className="flex items-center gap-2">
            {/* Filtreler */}
            {(['all', 'passed', 'failed'] as AttemptFilter[]).map((f) => {
              const labels: Record<AttemptFilter, string> = { all: 'Tümü', passed: 'Geçti', failed: 'Kaldı' };
              const isActive = attemptFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setAttemptFilter(f)}
                  className="rounded-full px-3 py-1"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: isActive ? K.PRIMARY_LIGHT : 'transparent',
                    color: isActive ? K.PRIMARY : K.TEXT_MUTED,
                    border: `1.5px solid ${isActive ? K.PRIMARY : K.BORDER}`,
                  }}
                >
                  {labels[f]}
                </button>
              );
            })}
            {/* Arama */}
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: K.TEXT_MUTED }}
              />
              <Input
                value={attemptSearch}
                onChange={(e) => setAttemptSearch(e.target.value)}
                placeholder="İsim veya departman..."
                className="pl-8 h-8 w-48 text-xs"
              />
              {attemptSearch && (
                <button
                  onClick={() => setAttemptSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3 w-3" style={{ color: K.TEXT_MUTED }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredAttempts.length > 0 ? (
          <DataTable columns={attemptColumns} data={filteredAttempts} />
        ) : (
          <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>
            Katılımcı bulunamadı
          </p>
        )}
      </div>
    </div>
  );
}
