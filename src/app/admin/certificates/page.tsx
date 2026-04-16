'use client'

import { useState } from 'react'
import { Award, Download, Info } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { CertStatsBar } from './_components/cert-stats-bar'
import { CertRenewalBanner } from './_components/cert-renewal-banner'
import { CertFilterBar } from './_components/cert-filter-bar'
import { CertGroup } from './_components/cert-group'
import { CertTable } from './_components/cert-table'
import { CertDetailModal } from './_components/cert-detail-modal'
import { CertPdfTemplate } from './_components/cert-pdf-template'
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

  const { certPdfRef, isPending, downloadSingle, downloadGroup, downloadAll } = useCertPdf()

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
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    )
  }

  return (
    <div>
      <BlurFade delay={0}>
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
                boxShadow: '0 4px 14px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
              }}
            >
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Sertifika Yönetimi
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Personel sertifikalarını görüntüleyin ve yönetin
              </p>
            </div>
          </div>
          <button
            aria-label="Sertifikaları dışa aktar"
            disabled={isPending('all')}
            className="flex items-center gap-2 rounded-xl h-10 px-5 text-[13px] font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
            }}
            onClick={() => downloadAll(filters)}
          >
            {isPending('all') ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Dışa Aktar{filtersActive ? ' (Filtreli)' : ''}
          </button>
        </div>
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
          <div
            className="flex flex-col items-center justify-center rounded-2xl border py-20"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
              <Award className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-[14px] font-semibold mb-1">Sertifika bulunamadı</p>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
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
                style={{ color: 'var(--color-text-muted)' }}
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
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
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
          <CertPdfTemplate ref={certPdfRef} cert={selectedCert} />
        </>
      )}

      {!selectedCert && <CertPdfTemplate ref={certPdfRef} cert={null} />}

      {groups.length > 0 && viewMode === 'grouped' && filtered.length > 0 && (
        <p
          className="text-center text-[11px] mt-6"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Toplam {filtered.length} sertifika, {groups.length} eğitim grubunda
        </p>
      )}
    </div>
  )
}
