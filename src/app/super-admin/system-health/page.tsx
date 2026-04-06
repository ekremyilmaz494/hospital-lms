'use client'

import { useFetch } from '@/hooks/use-fetch'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoading } from '@/components/shared/page-loading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Database, Server, HardDrive, Mail, Shield,
  Activity, Users, Building2, Clock,
  CheckCircle2, XCircle, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'

interface ServiceStatus {
  name: string
  status: 'up' | 'down' | 'degraded'
  responseTimeMs: number
  lastChecked: string
  message?: string
}

interface HealthMetrics {
  activeUsers: number
  totalOrganizations: number
  totalUsers: number
}

interface HealthData {
  services: ServiceStatus[]
  metrics: HealthMetrics
}

/** Servis adina gore ikon dondurur */
function getServiceIcon(name: string) {
  switch (name) {
    case 'PostgreSQL': return Database
    case 'Redis': return Server
    case 'S3': return HardDrive
    case 'SMTP': return Mail
    case 'Supabase Auth': return Shield
    default: return Activity
  }
}

/** Durum rengini dondurur */
function getStatusColor(status: string): string {
  switch (status) {
    case 'up': return 'var(--color-success, #16a34a)'
    case 'degraded': return 'var(--color-accent, #f59e0b)'
    case 'down': return 'var(--color-error, #dc2626)'
    default: return 'var(--color-muted-foreground)'
  }
}

/** Durum etiketini dondurur */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'up': return 'Aktif'
    case 'degraded': return 'Yavas'
    case 'down': return 'Kapal\u0131'
    default: return 'Bilinmiyor'
  }
}

/** Durum badge variant'i */
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'up': return 'default'
    case 'degraded': return 'secondary'
    case 'down': return 'destructive'
    default: return 'outline'
  }
}

/** Durum ikonu */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'up': return <CheckCircle2 className="h-5 w-5" style={{ color: getStatusColor(status) }} />
    case 'degraded': return <AlertTriangle className="h-5 w-5" style={{ color: getStatusColor(status) }} />
    case 'down': return <XCircle className="h-5 w-5" style={{ color: getStatusColor(status) }} />
    default: return null
  }
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const Icon = getServiceIcon(service.name)
  const lastChecked = new Date(service.lastChecked).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <Card className="relative overflow-hidden">
      {/* Ust kenarda durum rengi */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: getStatusColor(service.status) }}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `color-mix(in srgb, ${getStatusColor(service.status)} 10%, transparent)`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: getStatusColor(service.status) }} />
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
            </div>
          </div>
          <StatusIcon status={service.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Durum</span>
          <Badge variant={getStatusVariant(service.status)}>
            {getStatusLabel(service.status)}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Yanit Suresi</span>
          <span className="font-mono text-sm font-medium">
            {service.responseTimeMs} ms
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Son Kontrol</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {lastChecked}
          </span>
        </div>
        {service.message && (
          <div
            className="mt-2 rounded-lg p-2 text-xs"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-error, #dc2626) 8%, transparent)',
              color: 'var(--color-error, #dc2626)',
            }}
          >
            {service.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users
  label: string
  value: number
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
        >
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-bold">{value.toLocaleString('tr-TR')}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SystemHealthPage() {
  const { data, isLoading, error, refetch } = useFetch<HealthData>(
    '/api/super-admin/system-health',
    { interval: 30_000 }
  )

  if (isLoading && !data) {
    return <PageLoading />
  }

  const services = data?.services ?? []
  const metrics = data?.metrics ?? { activeUsers: 0, totalOrganizations: 0, totalUsers: 0 }

  // Genel durum ozeti
  const downCount = services.filter(s => s.status === 'down').length
  const degradedCount = services.filter(s => s.status === 'degraded').length
  const overallStatus = downCount > 0 ? 'down' : degradedCount > 0 ? 'degraded' : 'up'
  const overallLabel = downCount > 0
    ? `${downCount} servis kapal\u0131`
    : degradedCount > 0
    ? `${degradedCount} servis yavas`
    : 'Tum servisler aktif'

  return (
    <div className="space-y-8">
      <BlurFade delay={0.05}>
        <PageHeader
          title="Sistem Sagligi"
          subtitle="Platform servislerinin anlik durum izlemesi"
          action={{
            label: 'Yenile',
            icon: RotateCcw,
            onClick: refetch,
          }}
        />
      </BlurFade>

      {error && (
        <BlurFade delay={0.1}>
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-error)' }}>
                <XCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      )}

      {/* Genel durum */}
      <BlurFade delay={0.1}>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${getStatusColor(overallStatus)} 10%, transparent)`,
              }}
            >
              <Activity className="h-6 w-6" style={{ color: getStatusColor(overallStatus) }} />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold">Platform Durumu</h3>
              <p className="text-sm text-muted-foreground">{overallLabel}</p>
            </div>
            <Badge
              variant={getStatusVariant(overallStatus)}
              className="ml-auto"
            >
              {getStatusLabel(overallStatus)}
            </Badge>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Servis kartlari */}
      <BlurFade delay={0.15}>
        <div>
          <h3 className="font-heading mb-4 text-lg font-semibold">Servis Durumu</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {services.map((service) => (
              <ServiceCard key={service.name} service={service} />
            ))}
          </div>
        </div>
      </BlurFade>

      {/* Metrikler */}
      <BlurFade delay={0.2}>
        <div>
          <h3 className="font-heading mb-4 text-lg font-semibold">Platform Metrikleri</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              icon={Users}
              label="Aktif Kullanicilar (30 dk)"
              value={metrics.activeUsers}
              color="var(--color-primary, #0d9668)"
            />
            <MetricCard
              icon={Building2}
              label="Toplam Kurum"
              value={metrics.totalOrganizations}
              color="var(--color-info, #3b82f6)"
            />
            <MetricCard
              icon={Users}
              label="Toplam Kullanici"
              value={metrics.totalUsers}
              color="var(--color-accent, #f59e0b)"
            />
          </div>
        </div>
      </BlurFade>

      {/* Otomatik yenileme bilgisi */}
      <BlurFade delay={0.25}>
        <p className="text-center text-xs text-muted-foreground">
          Veriler her 30 saniyede bir otomatik olarak guncellenir
        </p>
      </BlurFade>
    </div>
  )
}
