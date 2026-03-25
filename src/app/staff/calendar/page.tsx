'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';

const events = [
  { date: 2, title: 'El Hijyeni tamamlandı', type: 'completed', color: 'var(--color-success)' },
  { date: 5, title: 'Hasta Hakları atandı', type: 'assigned', color: 'var(--color-info)' },
  { date: 8, title: 'Hasta Hakları başladı', type: 'in_progress', color: 'var(--color-warning)' },
  { date: 10, title: 'Radyoloji Güvenlik', type: 'deadline', color: 'var(--color-error)' },
  { date: 12, title: 'Hasta Hakları tamamlandı', type: 'completed', color: 'var(--color-success)' },
  { date: 15, title: 'İlaç Yönetimi atandı', type: 'assigned', color: 'var(--color-info)' },
  { date: 18, title: 'İlaç Yönetimi başladı', type: 'in_progress', color: 'var(--color-warning)' },
  { date: 20, title: 'İlaç Yönetimi tamamlandı', type: 'completed', color: 'var(--color-success)' },
  { date: 22, title: 'İş Güvenliği başladı', type: 'in_progress', color: 'var(--color-warning)' },
  { date: 26, title: 'İş Güvenliği son tarih', type: 'deadline', color: 'var(--color-error)' },
  { date: 28, title: 'Enfeksiyon Kontrol atandı', type: 'assigned', color: 'var(--color-info)' },
  { date: 31, title: 'Enfeksiyon Kontrol son tarih', type: 'deadline', color: 'var(--color-error)' },
];

const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function CalendarPage() {
  const [currentMonth] = useState('Mart 2026');
  const today = 24;
  const daysInMonth = 31;
  const startDay = 6; // March 2026 starts on Sunday (index 6 in Mon-start week)

  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="space-y-6">
      <PageHeader title="Takvim" subtitle="Eğitim takvimi ve son tarihler" />

      <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" style={{ color: 'var(--color-text-secondary)' }}><ChevronLeft className="h-5 w-5" /></Button>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{currentMonth}</h3>
          <Button variant="ghost" size="icon" style={{ color: 'var(--color-text-secondary)' }}><ChevronRight className="h-5 w-5" /></Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const event = events.find((e) => e.date === day);
            const isToday = day === today;
            return (
              <div key={day} className="relative min-h-[100px] rounded-lg border p-2" style={{ borderColor: isToday ? 'var(--color-primary)' : 'var(--color-border)', background: isToday ? 'var(--color-primary-light)' : 'transparent', borderWidth: isToday ? '2px' : '1px' }}>
                <span className={`text-sm font-semibold ${isToday ? 'inline-flex h-6 w-6 items-center justify-center rounded-full text-white' : ''}`} style={{ fontFamily: 'var(--font-mono)', color: isToday ? 'white' : 'var(--color-text-primary)', background: isToday ? 'var(--color-primary)' : 'transparent' }}>{day}</span>
                {event && (
                  <div className="mt-1 rounded px-1.5 py-0.5" style={{ background: `${event.color}15` }}>
                    <p className="truncate text-[10px] font-semibold" style={{ color: event.color }}>{event.title}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-error)' }} /> Son tarih</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-warning)' }} /> Devam ediyor</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-success)' }} /> Tamamlandı</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-info)' }} /> Atandı</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded" style={{ background: 'var(--color-primary)' }} /> Bugün</div>
      </div>
    </div>
  );
}
