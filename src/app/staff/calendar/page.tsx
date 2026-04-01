'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2,
  BookOpen, AlertTriangle, X, ArrowRight, Play, Target, Layers, ClipboardList,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

/* ─── Types ─── */
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed';
  trainingId: string;
  eventType: 'training' | 'exam';
}

/* ─── Constants ─── */
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

const STATUS_CONFIG = {
  assigned: { label: 'Atandı', color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: BookOpen },
  in_progress: { label: 'Devam Ediyor', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: Clock },
  completed: { label: 'Tamamlandı', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle2 },
  failed: { label: 'Başarısız', color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: AlertTriangle },
} as const;

/* ─── Helpers ─── */
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isDateInRange(date: Date, start: Date, end: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getStartDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday-first
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.toLocaleDateString('tr-TR', opts)}`;
  }
  return `${s.toLocaleDateString('tr-TR', opts)} – ${e.toLocaleDateString('tr-TR', opts)}`;
}

/* ─── Page ─── */
export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const { data: events, isLoading, error } = useFetch<CalendarEvent[]>('/api/staff/calendar');

  const goToPrevMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 0) { setYear(y => y - 1); return 11; }
      return prev - 1;
    });
    setSelectedDay(null);
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 11) { setYear(y => y + 1); return 0; }
      return prev + 1;
    });
    setSelectedDay(null);
  }, []);

  const goToToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }, [today]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getStartDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);

    const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    // Previous month trailing days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    // Next month leading days
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }

    return cells;
  }, [year, month]);

  // Map events to dates
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!events) return map;
    events.forEach(evt => {
      const start = new Date(evt.start);
      const end = new Date(evt.end);
      // For each day of the calendar, check if event overlaps
      calendarDays.forEach(cell => {
        if (isDateInRange(cell.date, start, end)) {
          const key = cell.date.toDateString();
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(evt);
        }
      });
    });
    return map;
  }, [events, calendarDays]);

  // Selected day events
  const selectedDayEvents = useMemo(() => {
    if (selectedDay === null) return [];
    const date = new Date(year, month, selectedDay);
    return eventsByDate.get(date.toDateString()) ?? [];
  }, [selectedDay, year, month, eventsByDate]);

  // Upcoming deadlines (next 30 days)
  const upcomingDeadlines = useMemo(() => {
    if (!events) return [];
    return events
      .filter(e => {
        const days = daysUntil(e.end);
        return days >= 0 && days <= 30 && e.status !== 'completed';
      })
      .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime())
      .slice(0, 5);
  }, [events]);

  // Month stats
  const monthStats = useMemo(() => {
    if (!events) return { total: 0, upcoming: 0, completed: 0, inProgress: 0 };
    const monthEvents = events.filter(e => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      return (start.getMonth() === month && start.getFullYear() === year) ||
             (end.getMonth() === month && end.getFullYear() === year);
    });
    return {
      total: monthEvents.length,
      upcoming: monthEvents.filter(e => e.status === 'assigned').length,
      completed: monthEvents.filter(e => e.status === 'completed').length,
      inProgress: monthEvents.filter(e => e.status === 'in_progress').length,
    };
  }, [events, month, year]);

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 14px rgba(13, 150, 104, 0.25)',
              }}
            >
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Eğitim Takvimi
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Eğitim programınızı ve son tarihleri takip edin
              </p>
            </div>
          </div>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-transform duration-200 hover:scale-[1.02]"
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                border: '1px solid rgba(13, 150, 104, 0.15)',
              }}
            >
              <Target className="h-3.5 w-3.5" />
              Bugün
            </button>
          )}
        </div>
      </BlurFade>

      {/* Stats Row */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Bu Ay', value: monthStats.total, icon: Layers, color: 'var(--color-primary)' },
            { label: 'Bekleyen', value: monthStats.upcoming, icon: BookOpen, color: 'var(--color-info)' },
            { label: 'Devam Eden', value: monthStats.inProgress, icon: Clock, color: 'var(--color-warning)' },
            { label: 'Tamamlanan', value: monthStats.completed, icon: CheckCircle2, color: 'var(--color-success)' },
          ].map(s => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl p-3.5"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${s.color}12` }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold font-mono leading-none">{s.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Main Grid: Calendar + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar Card */}
        <BlurFade delay={0.06}>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
            {/* Month Navigation */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <button
                onClick={goToPrevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="text-center">
                <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  {MONTHS_TR[month]} {year}
                </h3>
              </div>
              <button
                onClick={goToNextMonth}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 px-3 pt-3">
              {DAYS_TR.map(d => (
                <div
                  key={d}
                  className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px px-3 pb-3">
              {calendarDays.map((cell, i) => {
                const isToday = cell.isCurrentMonth && isSameDay(cell.date, today);
                const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
                const dayEvents = eventsByDate.get(cell.date.toDateString()) ?? [];
                const hasDeadline = dayEvents.some(e => isSameDay(new Date(e.end), cell.date) && e.status !== 'completed');
                const isPast = cell.date < today && !isToday;

                return (
                  <button
                    key={i}
                    onClick={() => cell.isCurrentMonth && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
                    disabled={!cell.isCurrentMonth}
                    className="group relative flex flex-col items-start rounded-xl p-1.5 text-left transition-all duration-150"
                    style={{
                      minHeight: '80px',
                      opacity: cell.isCurrentMonth ? (isPast ? 0.55 : 1) : 0.25,
                      background: isSelected
                        ? 'var(--color-primary-light)'
                        : isToday
                          ? 'rgba(13, 150, 104, 0.04)'
                          : 'transparent',
                      border: isSelected
                        ? '2px solid var(--color-primary)'
                        : isToday
                          ? '2px solid rgba(13, 150, 104, 0.3)'
                          : '1px solid transparent',
                      cursor: cell.isCurrentMonth ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => {
                      if (cell.isCurrentMonth && !isSelected) {
                        e.currentTarget.style.background = 'var(--color-surface-hover)';
                        e.currentTarget.style.border = '1px solid var(--color-border)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (cell.isCurrentMonth && !isSelected) {
                        e.currentTarget.style.background = isToday ? 'rgba(13, 150, 104, 0.04)' : 'transparent';
                        e.currentTarget.style.border = isToday ? '2px solid rgba(13, 150, 104, 0.3)' : '1px solid transparent';
                      }
                    }}
                  >
                    {/* Day Number */}
                    <span
                      className={`text-[13px] font-semibold font-mono leading-none ${
                        isToday ? 'flex h-7 w-7 items-center justify-center rounded-lg text-white' : 'px-1 py-0.5'
                      }`}
                      style={{
                        background: isToday ? 'var(--color-primary)' : 'transparent',
                        color: isToday ? 'white' : isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                      }}
                    >
                      {cell.day}
                    </span>

                    {/* Deadline dot */}
                    {hasDeadline && !isToday && (
                      <span
                        className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                        style={{ background: 'var(--color-error)', boxShadow: '0 0 0 2px var(--color-surface)' }}
                      />
                    )}

                    {/* Event pills (max 2 + overflow) */}
                    {cell.isCurrentMonth && dayEvents.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5 w-full min-w-0">
                        {dayEvents.slice(0, 2).map(evt => {
                          const cfg = STATUS_CONFIG[evt.status];
                          const pillColor = evt.eventType === 'exam' ? 'var(--color-accent)' : cfg.color;
                          const PillIcon = evt.eventType === 'exam' ? ClipboardList : BookOpen;
                          return (
                            <div
                              key={evt.id}
                              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 w-full min-w-0"
                              style={{ background: `${pillColor}12` }}
                            >
                              <PillIcon className="h-2.5 w-2.5 shrink-0" style={{ color: pillColor }} />
                              <span
                                className="truncate text-[9px] font-semibold leading-tight"
                                style={{ color: pillColor }}
                              >
                                {evt.title}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <span className="text-[9px] font-bold px-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            +{dayEvents.length - 2} daha
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div
              className="flex flex-wrap items-center gap-2 px-6 py-3"
              style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
            >
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 rounded-full px-2.5 py-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: cfg.color }} />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {cfg.label}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <BookOpen className="h-3 w-3" style={{ color: 'var(--color-info)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Eğitim
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <ClipboardList className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Sınav
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 ml-auto">
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-error)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Son tarih
                </span>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Selected Day Panel */}
          {selectedDay !== null && (
            <BlurFade delay={0}>
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold font-mono text-white"
                      style={{ background: 'var(--color-primary)' }}
                    >
                      {selectedDay}
                    </span>
                    <span className="text-[13px] font-semibold">
                      {MONTHS_TR[month]} {year}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 space-y-2.5">
                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-6">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-3"
                        style={{ background: 'var(--color-bg)' }}
                      >
                        <CalendarIcon className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Bu tarihte eğitim yok
                      </p>
                    </div>
                  ) : (
                    selectedDayEvents.map(evt => {
                      const cfg = STATUS_CONFIG[evt.status];
                      const Icon = evt.eventType === 'exam' ? ClipboardList : cfg.icon;
                      const iconBg = evt.eventType === 'exam' ? 'var(--color-accent-light)' : cfg.bg;
                      const iconColor = evt.eventType === 'exam' ? 'var(--color-accent)' : cfg.color;
                      const days = daysUntil(evt.end);
                      return (
                        <Link
                          key={evt.id}
                          href={`/staff/my-trainings/${evt.trainingId}`}
                          className="flex items-start gap-3 rounded-xl p-3.5 transition-all duration-200 group"
                          style={{ border: `1px solid var(--color-border)` }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--color-surface-hover)';
                            e.currentTarget.style.borderColor = cfg.color;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                          }}
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5"
                            style={{ background: iconBg }}
                          >
                            <Icon className="h-4 w-4" style={{ color: iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate group-hover:text-clip">{evt.title}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              {formatDateRange(evt.start, evt.end)}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: cfg.bg, color: cfg.color }}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                                {cfg.label}
                              </span>
                              {days >= 0 && days <= 7 && evt.status !== 'completed' && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                  style={{
                                    background: days <= 3 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                                    color: days <= 3 ? 'var(--color-error)' : 'var(--color-warning)',
                                  }}
                                >
                                  {days} gün kaldı
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight
                            className="h-4 w-4 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            style={{ color: 'var(--color-text-muted)' }}
                          />
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </BlurFade>
          )}

          {/* Upcoming Deadlines */}
          <BlurFade delay={0.1}>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="flex items-center gap-3 px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'var(--color-error-bg)' }}
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold">Yaklaşan Son Tarihler</h3>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Önümüzdeki 30 gün</p>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {upcomingDeadlines.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--color-success)' }} />
                    <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Yaklaşan son tarih yok
                    </p>
                  </div>
                ) : (
                  upcomingDeadlines.map(evt => {
                    const days = daysUntil(evt.end);
                    const cfg = STATUS_CONFIG[evt.status];
                    const urgency = days <= 3 ? 'var(--color-error)' : days <= 7 ? 'var(--color-warning)' : 'var(--color-text-muted)';
                    return (
                      <Link
                        key={evt.id}
                        href={`/staff/my-trainings/${evt.trainingId}`}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors duration-150 group"
                        style={{ border: '1px solid var(--color-border)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div
                          className="flex flex-col items-center justify-center h-10 w-10 shrink-0 rounded-lg"
                          style={{ background: `${urgency}10`, border: `1px solid ${urgency}20` }}
                        >
                          <span className="text-[10px] font-bold leading-none" style={{ color: urgency }}>
                            {days}
                          </span>
                          <span className="text-[8px] font-semibold" style={{ color: urgency }}>gün</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate">{evt.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{cfg.label}</span>
                          </div>
                        </div>
                        <Play
                          className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          style={{ color: 'var(--color-primary)' }}
                        />
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
