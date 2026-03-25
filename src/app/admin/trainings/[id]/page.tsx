'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, Users, TrendingUp, Clock, Edit, Play, BarChart3, FileText, RotateCcw, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const training = {
  title: 'Enfeksiyon Kontrol Eğitimi',
  category: 'Enfeksiyon',
  description: 'Hastane personeli için enfeksiyon kontrol prosedürleri, el hijyeni, kişisel koruyucu ekipman kullanımı ve izolasyon önlemleri hakkında kapsamlı eğitim.',
  passingScore: 70,
  maxAttempts: 3,
  examDuration: 30,
  startDate: '01.03.2026',
  endDate: '31.03.2026',
  videoCount: 5,
  questionCount: 20,
  assignedCount: 120,
  completedCount: 98,
  passedCount: 92,
  failedCount: 6,
  avgScore: 78.5,
};

const assignedStaff = [
  { name: 'Elif Kaya', department: 'Hemşirelik', attempt: 1, preScore: 65, postScore: 92, status: 'passed', completedAt: '15.03.2026' },
  { name: 'Mehmet Demir', department: 'Acil Servis', attempt: 1, preScore: 58, postScore: 85, status: 'passed', completedAt: '14.03.2026' },
  { name: 'Ayşe Yıldız', department: 'Radyoloji', attempt: 2, preScore: 45, postScore: 78, status: 'passed', completedAt: '18.03.2026' },
  { name: 'Ali Veli', department: 'Temizlik', attempt: 3, preScore: 30, postScore: 55, status: 'failed', completedAt: '-' },
  { name: 'Fatma Ak', department: 'Hemşirelik', attempt: 1, preScore: null, postScore: null, status: 'in_progress', completedAt: '-' },
  { name: 'Hasan Kılıç', department: 'Laboratuvar', attempt: 1, preScore: 72, postScore: 88, status: 'passed', completedAt: '16.03.2026' },
];

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
};

export default function TrainingDetailPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{training.title}</h2>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>Aktif</span>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>{training.category} • Baraj: {training.passingScore}% • {training.maxAttempts} deneme hakkı • {training.examDuration} dk sınav</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push(`/admin/trainings/${training.title}/edit`)} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><Edit className="h-4 w-4" /> Düzenle</Button>
          <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)', transition: 'background var(--transition-fast)' }}><Users className="h-4 w-4" /> Personel Ata</Button>
        </div>
      </div>

      <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{training.description}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Atanan" value={training.assignedCount} icon={Users} accentColor="var(--color-info)" />
        <StatCard title="Tamamlayan" value={training.completedCount} icon={TrendingUp} accentColor="var(--color-primary)" />
        <StatCard title="Başarılı" value={training.passedCount} icon={GraduationCap} accentColor="var(--color-success)" />
        <StatCard title="Başarısız" value={training.failedCount} icon={GraduationCap} accentColor="var(--color-error)" />
        <StatCard title="Ort. Puan" value={training.avgScore} icon={BarChart3} accentColor="var(--color-accent)" />
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <Tabs defaultValue="staff">
          <div className="flex items-center justify-between mb-1">
            <TabsList style={{ background: 'var(--color-surface-hover)' }}>
            <TabsTrigger value="staff">Personel Durumu</TabsTrigger>
            <TabsTrigger value="videos">Videolar ({training.videoCount})</TabsTrigger>
            <TabsTrigger value="questions">Sorular ({training.questionCount})</TabsTrigger>
          </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><Download className="h-3.5 w-3.5" /> Excel</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><FileText className="h-3.5 w-3.5" /> PDF</Button>
            </div>
          </div>

          <TabsContent value="staff" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Deneme</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ön Sınav</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Sınav</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedStaff.map((s) => {
                    const st = statusMap[s.status] || statusMap.assigned;
                    return (
                      <tr key={s.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: 'var(--color-primary)' }}>{s.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                            <div><p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.name}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.department}</p></div>
                          </div>
                        </td>
                        <td className="py-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{s.attempt}/{training.maxAttempts}</td>
                        <td className="py-3" style={{ fontFamily: 'var(--font-mono)', color: s.preScore !== null && s.preScore >= training.passingScore ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{s.preScore !== null ? `${s.preScore}%` : '-'}</td>
                        <td className="py-3" style={{ fontFamily: 'var(--font-mono)', color: s.postScore !== null && s.postScore >= training.passingScore ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{s.postScore !== null ? `${s.postScore}%` : '-'}</td>
                        <td className="py-3"><span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.text }} />{st.label}</span></td>
                        <td className="py-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{s.completedAt}</td>
                        <td className="py-3 text-right">
                          {s.status === 'failed' && (
                            <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                              <RotateCcw className="h-3.5 w-3.5" /> Yeni Hak Ver
                            </Button>
                          )}
                          {s.status === 'passed' && (
                            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              <Eye className="h-3.5 w-3.5" /> Detay
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            <div className="space-y-3">
              {['Enfeksiyon Kontrolüne Giriş', 'El Hijyeni Teknikleri', 'Kişisel Koruyucu Ekipman', 'İzolasyon Önlemleri', 'Dezenfeksiyon Prosedürleri'].map((title, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                    <Play className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="flex-1"><p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{title}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Video {i + 1}</p></div>
                  <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{10 + i * 5}:00</span></div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="questions" className="mt-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{i + 1}</div>
                  <div className="flex-1"><p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Soru {i + 1}: Enfeksiyon kontrolü ile ilgili örnek soru metni burada yer alacaktır.</p></div>
                  <div className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>10 puan</span></div>
                </div>
              ))}
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>... ve {training.questionCount - 5} soru daha</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
