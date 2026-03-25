'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface CalendarEvent {
  date: number;
  title: string;
  type: string;
  color: string;
}

interface CalendarData {
  events: CalendarEvent[];
  month: string;
  year: number;
  today: number;
  daysInMonth: number;
  startDay: number;
}

const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const legendItems = [
  { label: 'Son tarih', color: 'var(--color-error)' },
  { label: 'Devam ediyor', color: 'var(--color-warning)' },
  { label: 'Tamamlandı', color: 'var(--color-success)' },
  { label: 'Atandı', color: 'var(--color-info)' },
];

export default function CalendarPage() {
  const { data, isLoading, error } = useFetch<CalendarData>('/api/staff/calendar');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const events = data?.events ?? [];
  const currentMonth = data?.month ? `${data.month} ${data.year}` : 'Mart 2026';
  const today = data?.today ?? new Date().getDate();
  const daysInMonth = data?.daysInMonth ?? 31;
  const startDay = data?.startDay ?? 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="space-y-6">
      <PageHeader title="Takvim" subtitle="Eğitim takvimi ve son tarihler" />

      <BlurFade delay={0.05}>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-6 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="rounded-xl" style={{ color: 'var(--color-text-secondary)' }}><ChevronLeft className="h-5 w-5" /></Button>
            <h3 className="text-xl font-bold">{currentMonth}</h3>
            <Button variant="ghost" size="icon" className="rounded-xl" style={{ color: 'var(--color-text-secondary)' }}><ChevronRight className="h-5 w-5" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {daysOfWeek.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const event = events.find((e) => e.date === day);
              const isToday = day === today;
              const isPast = day < today;
              return (
                <div
                  key={day}
                  className="relative min-h-24 rounded-xl border p-2.5 transition-all duration-150 cursor-default"
                  style={{
                    borderColor: isToday ? 'var(--color-primary)' : 'var(--color-border)',
                    background: isToday ? 'var(--color-primary-light)' : 'transparent',
                    borderWidth: isToday ? '2px' : '1px',
                    opacity: isPast && !isToday ? 0.6 : 1,
                  }}
                >
                  <span
                    className={`text-sm font-semibold font-mono ${isToday ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-white' : ''}`}
                    style={{ color: isToday ? 'white' : 'var(--color-text-primary)', background: isToday ? 'var(--color-primary)' : 'transparent' }}
                  >
                    {day}
                  </span>
                  {event && (
                    <div className="mt-1.5 rounded-lg px-1.5 py-1" style={{ background: `${event.color}12` }}>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
                        <p className="truncate text-[9px] font-semibold" style={{ color: event.color }}>{event.title}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.15}>
        <div className="flex flex-wrap items-center gap-3">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: `${item.color}10`, border: `1px solid ${item.color}20` }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'var(--color-primary-light)' }}>
            <span className="h-2.5 w-2.5 rounded-lg" style={{ background: 'var(--color-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>Bugün</span>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
