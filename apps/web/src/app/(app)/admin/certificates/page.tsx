'use client'

import { useState } from 'react'
import { Award, Download, Info, ChevronRight } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { CertStatsBar } from './_components/cert-stats-bar'
import { CertRenewalBanner } from './_components/cert-renewal-banner'
import { CertFilterBar } from './_components/cert-filter-bar'
import { CertGroup } from './_components/cert-group'
import { CertTable } from './_components/cert-table'
import { CertDetailModal } from './_components/cert-detail-modal'
import { useCertFilters } from './_hooks/use-cert-filters'
import { useCertPdf, type BundleFormat } from './_hooks/use-cert-pdf'
import type { Certificate, CertPageData, FilterState, ViewMode } from './_types'

const API_URL = '/api/admin/certificates'
const VIEW_MODE_STORAGE_KEY = 'certificates:viewMode'

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'grouped'
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
  return stored === 'flat' ? 'flat' : 'grouped'
}

export default function CertificatesPage() {
  const { data, isLoading, error, refetch } = useFetch<CertPageData>(API_URL)

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    trainingId: '',
    category: '',
  })
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null)

  const { isPending, downloadSingle, downloadGroup, downloadAll } = useCertPdf()

  const stats = data?.stats ?? { totalCerts: 0, activeCerts: 0, expiredCerts: 0, revokedCerts: 0, expiringSoon: 0 }
  const trainingsWithoutRenewal = data?.trainingsWithoutRenewal ?? []
  const certificates = data?.certificates ?? []
  const allTrainings = data?.trainings ?? []
  const categories = data?.categories ?? []

  const { filtered, groups, filterStats } = useCertFilters(certificates, filters, allTrainings)

  const updateFilters = (patch: Partial<FilterState>) => setFilters(prev => ({ ...prev, ...patch }))

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    }
  }

  const filtersActive = !!(filters.search || filters.status !== 'all' || filters.trainingId || filters.category)

  const handleMutated = () => {
    invalidateFetchCache(API_URL)
    refetch()
    setSelectedCert(null)
  }

  const handleGroupDownload = (trainingId: string, format: BundleFormat) => {
    downloadGroup({
      trainingId,
      format,
      status: filters.status,
      search: filters.search,
      category: filters.category || undefined,
    })
  }

  if (isLoading) return <PageLoading />

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span data-current="true">Sertifikalar</span>
            </div>
            <h1 className="k-page-title">Sertifika Yönetimi</h1>
            <p className="k-page-subtitle">
              {stats.totalCerts > 0 ? (
                <>
                  <strong style={{ color: 'var(--k-text-primary)' }}>{stats.totalCerts}</strong> toplam sertifika ·{' '}
                  <strong style={{ color: 'var(--k-text-primary)' }}>{stats.activeCerts}</strong> aktif ·{' '}
                  <strong style={{ color: 'var(--k-warning)' }}>{stats.expiringSoon}</strong> yakında dolacak
                </>
              ) : 'Personel sertifikalarını görüntüleyin ve yönetin'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Sertifikaları PDF özet listesi olarak indir"
              title={filtersActive
                ? 'Mevcut filtrelere uyan sertifikaların özet PDF listesini indirir'
                : 'Tüm sertifikaların özet PDF listesini indirir'}
              disabled={isPending('all')}
              className="k-btn k-btn-primary"
              onClick={() => downloadAll(filters)}
            >
              {isPending('all') ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Download size={15} />
              )}
              Liste İndir (PDF){filtersActive ? ' · Filtreli' : ''}
            </button>
          </div>
        </header>
      </BlurFade>

      <CertStatsBar stats={stats} filterStats={filterStats} filtersActive={filtersActive} />

      <CertRenewalBanner trainings={trainingsWithoutRenewal} />

      <CertFilterBar
        filters={filters}
        onFilterChange={updateFilters}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        trainings={allTrainings}
        categories={categories}
        resultCount={filtered.length}
      />

      <BlurFade delay={0.09}>
        {filtered.length === 0 ? (
          <div className="k-card flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--k-bg)' }}>
              <Award className="h-7 w-7" style={{ color: 'var(--k-text-muted)' }} />
            </div>
            <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>Sertifika bulunamadı</p>
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              {filtersActive
                ? 'Filtrelere uygun sertifika yok'
                : 'Personel eğitimi tamamladığında sertifika otomatik oluşturulur'}
            </p>
          </div>
        ) : viewMode === 'grouped' ? (
          <div>
            {groups.length > 1 && (
              <div
                className="flex items-center gap-2 text-[12px] mb-3 px-1"
                style={{ color: 'var(--k-text-muted)' }}
              >
                <Info className="h-3.5 w-3.5" />
                <span>
                  {groups.length} eğitim grubu · {filtered.length} sertifika · gruplara tıklayarak detayları görün
                </span>
              </div>
            )}
            {groups.map((group, idx) => (
              <CertGroup
                key={group.training.id}
                group={group}
                defaultOpen={groups.length === 1 || idx === 0}
                onSelectCert={setSelectedCert}
                onDownload={handleGroupDownload}
                isDownloading={isPending}
              />
            ))}
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <CertTable certificates={filtered} onSelect={setSelectedCert} />
          </div>
        )}
      </BlurFade>

      {selectedCert && (
        <>
          <CertDetailModal
            cert={selectedCert}
            onClose={() => setSelectedCert(null)}
            onMutated={handleMutated}
            onDownload={() => downloadSingle(selectedCert)}
            isPdfPending={isPending(`single:${selectedCert.id}`)}
          />
        </>
      )}

      {groups.length > 0 && viewMode === 'grouped' && filtered.length > 0 && (
        <p className="text-center text-[11px] mt-2" style={{ color: 'var(--k-text-muted)' }}>
          Toplam {filtered.length} sertifika, {groups.length} eğitim grubunda
        </p>
      )}
    </div>
  )
}
