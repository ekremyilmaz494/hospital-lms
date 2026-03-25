'use client';

import { useState } from 'react';
import {
  BarChart3, Download, FileText, Users, GraduationCap, Building2, AlertTriangle, Clock, Printer,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { ChartCard } from '@/components/shared/chart-card';

// ── MOCK DATA ──

const overviewData = {
  stats: [
    { title: 'Toplam Eğitim', value: 32, icon: GraduationCap, accentColor: 'var(--color-primary)' },
    { title: 'Toplam Personel', value: 245, icon: Users, accentColor: 'var(--color-info)' },
    { title: 'Tamamlanma Oranı', value: '89.2%', icon: BarChart3, accentColor: 'var(--color-success)' },
    { title: 'Ort. Başarı Puanı', value: '78.5', icon: BarChart3, accentColor: 'var(--color-accent)' },
  ],
  monthly: [
    { month: 'Oca', tamamlanan: 45, basarisiz: 5 },
    { month: 'Şub', tamamlanan: 62, basarisiz: 8 },
    { month: 'Mar', tamamlanan: 78, basarisiz: 6 },
    { month: 'Nis', tamamlanan: 55, basarisiz: 4 },
    { month: 'May', tamamlanan: 90, basarisiz: 7 },
    { month: 'Haz', tamamlanan: 85, basarisiz: 3 },
  ],
};

const trainingData = [
  { name: 'Enfeksiyon Kontrol', atanan: 120, tamamlayan: 98, basarili: 92, basarisiz: 6, ort: 78.5 },
  { name: 'İş Güvenliği', atanan: 245, tamamlayan: 210, basarili: 195, basarisiz: 15, ort: 75.2 },
  { name: 'Hasta Hakları', atanan: 80, tamamlayan: 80, basarili: 78, basarisiz: 2, ort: 85.1 },
  { name: 'Radyoloji Güvenlik', atanan: 35, tamamlayan: 28, basarili: 25, basarisiz: 3, ort: 72.8 },
  { name: 'El Hijyeni', atanan: 200, tamamlayan: 185, basarili: 180, basarisiz: 5, ort: 82.3 },
  { name: 'İlaç Yönetimi', atanan: 55, tamamlayan: 48, basarili: 45, basarisiz: 3, ort: 79.6 },
];

const staffPerformance = [
  { name: 'Elif Kaya', dept: 'Hemşirelik', completed: 8, avgScore: 97, status: 'Yıldız' },
  { name: 'Hasan Kılıç', dept: 'Laboratuvar', completed: 8, avgScore: 91, status: 'Yıldız' },
  { name: 'Zeynep Arslan', dept: 'Eczane', completed: 5, avgScore: 93, status: 'Yıldız' },
  { name: 'Mehmet Demir', dept: 'Acil Servis', completed: 7, avgScore: 95, status: 'Yıldız' },
  { name: 'Ali Veli', dept: 'Temizlik', completed: 2, avgScore: 55, status: 'Risk' },
  { name: 'Osman Yurt', dept: 'Güvenlik', completed: 1, avgScore: 45, status: 'Risk' },
];

const departmentData = [
  { dept: 'Hemşirelik', personel: 45, tamamlanma: 94, ortPuan: 88, basarisiz: 1 },
  { dept: 'Acil Servis', personel: 28, tamamlanma: 89, ortPuan: 82, basarisiz: 2 },
  { dept: 'Radyoloji', personel: 12, tamamlanma: 85, ortPuan: 78, basarisiz: 1 },
  { dept: 'Laboratuvar', personel: 18, tamamlanma: 92, ortPuan: 85, basarisiz: 0 },
  { dept: 'Eczane', personel: 15, tamamlanma: 96, ortPuan: 90, basarisiz: 0 },
  { dept: 'Temizlik', personel: 22, tamamlanma: 65, ortPuan: 62, basarisiz: 5 },
  { dept: 'İdari', personel: 20, tamamlanma: 80, ortPuan: 75, basarisiz: 2 },
  { dept: 'Güvenlik', personel: 10, tamamlanma: 55, ortPuan: 58, basarisiz: 3 },
];

const failureData = [
  { name: 'Ali Veli', dept: 'Temizlik', training: 'İş Güvenliği', attempts: 3, lastScore: 55, status: 'locked' },
  { name: 'Osman Yurt', dept: 'Güvenlik', training: 'Enfeksiyon Kontrol', attempts: 3, lastScore: 48, status: 'locked' },
  { name: 'Cemile Tan', dept: 'İdari', training: 'Radyoloji Güvenlik', attempts: 2, lastScore: 62, status: 'failed' },
  { name: 'Hüseyin Ak', dept: 'Temizlik', training: 'Hasta Hakları', attempts: 3, lastScore: 50, status: 'locked' },
];

const durationData = [
  { training: 'Enfeksiyon Kontrol', avgVideoMin: 42, avgExamMin: 22, avgTotalMin: 64 },
  { training: 'İş Güvenliği', avgVideoMin: 55, avgExamMin: 25, avgTotalMin: 80 },
  { training: 'Hasta Hakları', avgVideoMin: 30, avgExamMin: 18, avgTotalMin: 48 },
  { training: 'Radyoloji Güvenlik', avgVideoMin: 38, avgExamMin: 20, avgTotalMin: 58 },
  { training: 'El Hijyeni', avgVideoMin: 25, avgExamMin: 15, avgTotalMin: 40 },
  { training: 'İlaç Yönetimi', avgVideoMin: 35, avgExamMin: 22, avgTotalMin: 57 },
];

const pieColors = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)'];

const statusColors: Record<string, { bg: string; text: string }> = {
  'Yıldız': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  'Risk': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  'locked': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  'failed': { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
};

function ExportButtons() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        <Download className="h-3.5 w-3.5" /> Excel
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        <FileText className="h-3.5 w-3.5" /> PDF
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        <Printer className="h-3.5 w-3.5" /> Yazdır
      </Button>
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{children}</th>;
}

function TD({ children, mono, color }: { children: React.ReactNode; mono?: boolean; color?: string }) {
  return <td className="px-4 py-3 text-sm" style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, color: color || 'var(--color-text-primary)' }}>{children}</td>;
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Raporlar" subtitle="Eğitim performansını analiz edin" />
        <ExportButtons />
      </div>

      <Tabs defaultValue="overview">
        <TabsList style={{ background: 'var(--color-surface-hover)' }}>
          <TabsTrigger value="overview">Genel Özet</TabsTrigger>
          <TabsTrigger value="training">Eğitim Bazlı</TabsTrigger>
          <TabsTrigger value="staff">Personel Bazlı</TabsTrigger>
          <TabsTrigger value="department">Departman</TabsTrigger>
          <TabsTrigger value="failure">Başarısızlık</TabsTrigger>
          <TabsTrigger value="duration">Süre Analizi</TabsTrigger>
        </TabsList>

        {/* 1. Genel Özet */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewData.stats.map((s) => <StatCard key={s.title} {...s} />)}
          </div>
          <ChartCard title="Aylık Tamamlanma Trendi" icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewData.monthly} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="tamamlanan" name="Tamamlanan" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="basarisiz" name="Başarısız" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </TabsContent>

        {/* 2. Eğitim Bazlı */}
        <TabsContent value="training" className="mt-6 space-y-6">
          <TableWrapper>
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}><TH>Eğitim</TH><TH>Atanan</TH><TH>Tamamlayan</TH><TH>Başarılı</TH><TH>Başarısız</TH><TH>Ort. Puan</TH><TH>Oran</TH></tr></thead>
              <tbody>
                {trainingData.map((t) => {
                  const rate = Math.round((t.tamamlayan / t.atanan) * 100);
                  const rateColor = rate >= 80 ? 'var(--color-success)' : rate >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
                  return (
                    <tr key={t.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <TD><span className="font-medium">{t.name}</span></TD>
                      <TD mono>{t.atanan}</TD><TD mono>{t.tamamlayan}</TD>
                      <TD mono color="var(--color-success)">{t.basarili}</TD>
                      <TD mono color="var(--color-error)">{t.basarisiz}</TD>
                      <TD mono>{t.ort}%</TD>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full" style={{ background: 'var(--color-border)' }}>
                            <div className="h-full rounded-full" style={{ width: `${rate}%`, background: rateColor }} />
                          </div>
                          <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: rateColor }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrapper>
        </TabsContent>

        {/* 3. Personel Bazlı */}
        <TabsContent value="staff" className="mt-6 space-y-6">
          <TableWrapper>
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}><TH>Personel</TH><TH>Departman</TH><TH>Tamamlanan</TH><TH>Ort. Puan</TH><TH>Durum</TH></tr></thead>
              <tbody>
                {staffPerformance.map((s) => {
                  const sc = statusColors[s.status];
                  return (
                    <tr key={s.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <TD><span className="font-medium">{s.name}</span></TD>
                      <TD>{s.dept}</TD><TD mono>{s.completed}</TD>
                      <TD mono color={s.avgScore >= 70 ? 'var(--color-success)' : 'var(--color-error)'}>{s.avgScore}%</TD>
                      <td className="px-4 py-3"><span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: sc.bg, color: sc.text }}>{s.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrapper>
        </TabsContent>

        {/* 4. Departman */}
        <TabsContent value="department" className="mt-6 space-y-6">
          <ChartCard title="Departman Karşılaştırması" icon={<Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="dept" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="tamamlanma" name="Tamamlanma %" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="ortPuan" name="Ort. Puan" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <TableWrapper>
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}><TH>Departman</TH><TH>Personel</TH><TH>Tamamlanma</TH><TH>Ort. Puan</TH><TH>Başarısız</TH></tr></thead>
              <tbody>
                {departmentData.map((d) => (
                  <tr key={d.dept} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <TD><span className="font-medium">{d.dept}</span></TD>
                    <TD mono>{d.personel}</TD>
                    <TD mono color={d.tamamlanma >= 80 ? 'var(--color-success)' : d.tamamlanma >= 60 ? 'var(--color-warning)' : 'var(--color-error)'}>{d.tamamlanma}%</TD>
                    <TD mono>{d.ortPuan}%</TD>
                    <TD mono color={d.basarisiz > 0 ? 'var(--color-error)' : 'var(--color-success)'}>{d.basarisiz}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </TabsContent>

        {/* 5. Başarısızlık */}
        <TabsContent value="failure" className="mt-6 space-y-6">
          <div className="rounded-lg p-4" style={{ background: 'var(--color-error-bg)', borderLeft: '4px solid var(--color-error)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>{failureData.length} personel 3 deneme hakkını tüketmiş durumda</p>
            </div>
          </div>
          <TableWrapper>
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}><TH>Personel</TH><TH>Departman</TH><TH>Eğitim</TH><TH>Deneme</TH><TH>Son Puan</TH><TH>Durum</TH></tr></thead>
              <tbody>
                {failureData.map((f, i) => {
                  const sc = statusColors[f.status];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <TD><span className="font-medium">{f.name}</span></TD>
                      <TD>{f.dept}</TD><TD>{f.training}</TD>
                      <TD mono>{f.attempts}/3</TD>
                      <TD mono color="var(--color-error)">{f.lastScore}%</TD>
                      <td className="px-4 py-3"><span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: sc.bg, color: sc.text }}>{f.status === 'locked' ? 'Kilitli' : 'Başarısız'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrapper>
        </TabsContent>

        {/* 6. Süre Analizi */}
        <TabsContent value="duration" className="mt-6 space-y-6">
          <ChartCard title="Ortalama Süre Karşılaştırması (dakika)" icon={<Clock className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit=" dk" />
                  <YAxis dataKey="training" type="category" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="avgVideoMin" name="Video Süresi" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={16} />
                  <Bar dataKey="avgExamMin" name="Sınav Süresi" fill="var(--color-accent)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <TableWrapper>
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}><TH>Eğitim</TH><TH>Ort. Video (dk)</TH><TH>Ort. Sınav (dk)</TH><TH>Ort. Toplam (dk)</TH></tr></thead>
              <tbody>
                {durationData.map((d) => (
                  <tr key={d.training} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <TD><span className="font-medium">{d.training}</span></TD>
                    <TD mono>{d.avgVideoMin}</TD><TD mono>{d.avgExamMin}</TD>
                    <TD mono><strong>{d.avgTotalMin}</strong></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </TabsContent>
      </Tabs>
    </div>
  );
}
