'use client';

/**
 * Eğitim Takvimi — "Clinical Editorial" redesign.
 * Notifications sayfasıyla aynı dil: cream + ink + gold + mono caps + serif display.
 * Calendar grid editorial bar-chart feel ile, day cells borderless hairline ruled.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2,
  BookOpen, AlertTriangle, X, ArrowRight, Lock, ClipboardList,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useMobile } from '@/hooks/use-mobile';

type ViewMode = 'month' | 'week' | 'agenda';

/* ─────────────────────────────────────────────────────
   Domain
   ───────────────────────────────────────────────────── */

type CalendarStatus = 'assigned' | 'in_progress' | 'completed' | 'failed' | 'locked';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string | null;
  status: CalendarStatus;
  trainingId: string;
  eventType: 'training' | 'exam';
}

const DAYS_TR = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ'] as const;
const MONTHS_TR = [
  'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
  'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK',
] as const;

interface StatusToken {
  label: string;
  ink: string;
  bg: string;
  icon: typeof BookOpen;
}

const STATUS: Record<CalendarStatus, StatusToken> = {
  assigned:    { label: 'ATANDI',     ink: '#2c55b8', bg: '#eef2fb', icon: BookOpen },
  in_progress: { label: 'DEVAM',      ink: '#b4820b', bg: '#fef6e7', icon: Clock },
  completed:   { label: 'TAMAMLANDI', ink: '#0a7a47', bg: '#eaf6ef', icon: CheckCircle2 },
  failed:      { label: 'BAŞARISIZ',  ink: '#b3261e', bg: '#fdf5f2', icon: AlertTriangle },
  locked:      { label: 'KİLİTLİ',    ink: '#8a5a11', bg: '#f4efdf', icon: Lock },
};

/* ─── Date helpers ─── */

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getStartDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}
function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
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

/* ─── Editorial palette ─── */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

/* ─────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────── */

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const isMobile = useMobile();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // null = follow device default (mobile → agenda, desktop → month).
  // Once the user picks explicitly, the override wins even if they rotate the device.
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const viewMode: ViewMode = viewOverride ?? (isMobile ? 'agenda' : 'month');
  const handleViewChange = useCallback((v: ViewMode) => setViewOverride(v), []);

  const { data, isLoading, error } = useFetch<{ events: CalendarEvent[]; total: number }>(
    '/api/staff/calendar',
  );
  const events = data?.events ?? null;

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

  /* Calendar grid build (42 cells = 6 weeks) */
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getStartDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);
    const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return cells;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!events) return map;
    const firstDay = calendarDays[0]?.date;
    const lastDay = calendarDays[calendarDays.length - 1]?.date;
    if (!firstDay || !lastDay) return map;

    events.forEach(evt => {
      const start = new Date(evt.start);
      const end = new Date(evt.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const keyDates: Date[] = [start];
      if (start.getTime() !== end.getTime()) keyDates.push(end);
      keyDates.forEach(d => {
        if (d >= firstDay && d <= lastDay) {
          const key = d.toDateString();
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(evt);
        }
      });
    });
    return map;
  }, [events, calendarDays]);

  const selectedDayEvents = useMemo(() => {
    if (selectedDay === null) return [];
    const date = new Date(year, month, selectedDay);
    return eventsByDate.get(date.toDateString()) ?? [];
  }, [selectedDay, year, month, eventsByDate]);

  const upcomingDeadlines = useMemo(() => {
    if (!events) return [];
    return events
      .filter(e => {
        const days = daysUntil(e.end);
        const actionable = e.status === 'assigned' || e.status === 'in_progress';
        return days >= 0 && days <= 30 && actionable;
      })
      .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime())
      .slice(0, 6);
  }, [events]);

  const monthStats = useMemo(() => {
    if (!events) return { total: 0, upcoming: 0, completed: 0, inProgress: 0 };
    const monthEvents = events.filter(e => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      return (start.getMonth() === month && start.getFullYear() === year)
          || (end.getMonth() === month && end.getFullYear() === year);
    });
    return {
      total: monthEvents.length,
      upcoming: monthEvents.filter(e => e.status === 'assigned').length,
      completed: monthEvents.filter(e => e.status === 'completed').length,
      inProgress: monthEvents.filter(e => e.status === 'in_progress').length,
    };
  }, [events, month, year]);

  /* Cream theme bleed (same trick as notifications) */
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main as HTMLElement;
    const prevBg = el.style.backgroundColor;
    const prevVar = el.style.getPropertyValue('--color-bg-rgb');
    el.style.backgroundColor = CREAM;
    el.style.setProperty('--color-bg-rgb', '250, 247, 242');
    return () => {
      el.style.backgroundColor = prevBg;
      if (prevVar) el.style.setProperty('--color-bg-rgb', prevVar);
      else el.style.removeProperty('--color-bg-rgb');
    };
  }, []);

  if (isLoading) return <CalendarSkeleton />;
  if (error) return <CalendarError message={error} />;

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayStr = today.toLocaleDateString('tr-TR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase();

  return (
    <div
      className="-mx-4 -my-4 md:-mx-8 md:-my-8"
      style={{ backgroundColor: CREAM, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="px-4 pt-4 pb-24 sm:px-10 lg:px-16">
        {/* ═══════════════ COMPACT MASTHEAD — single row ═══════════════ */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-4"
          style={{ borderColor: INK }}
        >
          <div className="flex min-w-0 items-end gap-3 sm:gap-4">
            <p
              className="pb-1 hidden sm:block text-[10px] uppercase tracking-[0.26em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              № 02 · Takvim
            </p>
            <h1
              className="leading-none tracking-[-0.02em]"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
                color: INK,
                fontWeight: 800,
              }}
            >
              {MONTHS_TR[month].toLowerCase()}
              <span style={{ color: GOLD }}>.</span>
              <span
                className="ml-2 text-[0.55em] align-top"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', fontWeight: 700 }}
              >
                {year}
              </span>
            </h1>
          </div>

          {/* Inline nav + stats + today button — wrap-safe on mobile */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-4 text-[11px] tracking-[0.18em]" style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}>
              <span>
                <span style={{ color: INK, fontWeight: 700 }}>{monthStats.total.toString().padStart(2, '0')}</span> TOPLAM
              </span>
              <span style={{ color: RULE }}>·</span>
              <span>
                <span style={{ color: monthStats.upcoming > 0 ? GOLD : INK_SOFT, fontWeight: 700 }}>{monthStats.upcoming.toString().padStart(2, '0')}</span> BEKLEYEN
              </span>
            </div>

            <div className="flex items-center gap-1">
              <NavButton onClick={goToPrevMonth} aria-label="Önceki ay">
                <ChevronLeft className="h-4 w-4" />
              </NavButton>
              <NavButton onClick={goToNextMonth} aria-label="Sonraki ay">
                <ChevronRight className="h-4 w-4" />
              </NavButton>
            </div>

            {!isCurrentMonth && (
              <button
                type="button"
                onClick={goToToday}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-150"
                style={{
                  backgroundColor: INK,
                  color: CREAM,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                }}
              >
                <CalendarIcon className="h-3 w-3" />
                Bugün
              </button>
            )}
          </div>
        </header>

        {/* ═══════════════ VIEW SWITCHER — Ay / Hafta / Ajanda ═══════════════ */}
        <ViewSwitcher value={viewMode} onChange={handleViewChange} />

        {/* ═══════════════ MAIN GRID: VIEW + SIDEBAR ═══════════════ */}
        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {viewMode === 'month' && (
              <MonthView
                calendarDays={calendarDays}
                today={today}
                selectedDay={selectedDay}
                eventsByDate={eventsByDate}
                onSelectDay={day => setSelectedDay(day === selectedDay ? null : day)}
              />
            )}
            {viewMode === 'week' && (
              <WeekView
                today={today}
                year={year}
                month={month}
                selectedDay={selectedDay}
                eventsByDate={eventsByDate}
                onSelectDay={day => setSelectedDay(day === selectedDay ? null : day)}
              />
            )}
            {viewMode === 'agenda' && (
              <AgendaView
                events={events ?? []}
                today={today}
                year={year}
                month={month}
              />
            )}
          </div>

          {/* Sidebar — only for month/week views; agenda already is a list */}
          {viewMode !== 'agenda' && (
            <aside className="space-y-8">
              {selectedDay !== null && (
                <SelectedDayPanel
                  day={selectedDay}
                  month={month}
                  year={year}
                  events={selectedDayEvents}
                  onClose={() => setSelectedDay(null)}
                />
              )}

              <DeadlinesPanel events={upcomingDeadlines} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   View Switcher — segmented control in the editorial dialect
   ───────────────────────────────────────────────────── */

function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { id: ViewMode; label: string }[] = [
    { id: 'month',  label: 'AY' },
    { id: 'week',   label: 'HAFTA' },
    { id: 'agenda', label: 'AJANDA' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Takvim görünümü"
      className="mt-4 inline-flex items-stretch"
      style={{ border: `1px solid ${INK}` }}
    >
      {options.map((opt, i) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className="px-4 py-2 text-[11px] tracking-[0.22em] transition-colors duration-150"
            style={{
              backgroundColor: active ? INK : 'transparent',
              color: active ? CREAM : INK,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              borderLeft: i === 0 ? 'none' : `1px solid ${INK}`,
              minHeight: 40, // touch-friendly
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Month View — the original 6×7 grid extracted
   ───────────────────────────────────────────────────── */

function MonthView({
  calendarDays, today, selectedDay, eventsByDate, onSelectDay,
}: {
  calendarDays: { day: number; isCurrentMonth: boolean; date: Date }[];
  today: Date;
  selectedDay: number | null;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDay: (day: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b pb-3" style={{ borderColor: INK }}>
        {DAYS_TR.map(d => (
          <div
            key={d}
            className="text-center text-[10px] tracking-[0.22em]"
            style={{ color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" style={{ borderTop: 'none' }}>
        {calendarDays.map((cell, i) => {
          const isToday = cell.isCurrentMonth && isSameDay(cell.date, today);
          const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
          const dayEvents = eventsByDate.get(cell.date.toDateString()) ?? [];
          const hasDeadline = dayEvents.some(e =>
            isSameDay(new Date(e.end), cell.date)
            && (e.status === 'assigned' || e.status === 'in_progress'),
          );
          const isPast = cell.date < today && !isToday;
          const weekIndex = Math.floor(i / 7);
          const colIndex = i % 7;

          return (
            <CalendarCell
              key={i}
              cell={cell}
              isToday={isToday}
              isSelected={isSelected}
              isPast={isPast}
              hasDeadline={hasDeadline}
              dayEvents={dayEvents}
              weekIndex={weekIndex}
              colIndex={colIndex}
              onClick={() => cell.isCurrentMonth && onSelectDay(cell.day)}
            />
          );
        })}
      </div>

      <div
        className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] tracking-[0.18em]"
        style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
      >
        <LegendItem color="#2c55b8" label="EĞİTİM" />
        <LegendItem color="#1a3a28" label="SINAV" />
        <LegendItem color="#b3261e" label="SON TARİH" isDot />
        <LegendItem color={GOLD} label="BUGÜN" isRing />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────── */

function StatBlock({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div
        className="leading-none tabular-nums"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.25rem, 4vw, 3rem)',
          fontWeight: 800,
          color: accent ? INK : INK_SOFT,
          letterSpacing: '-0.04em',
        }}
      >
        {value.toString().padStart(2, '0')}
      </div>
      <div
        className="mt-1 text-[10px] tracking-[0.3em]"
        style={{
          color: accent ? GOLD : INK_SOFT,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function NavButton({
  onClick, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center transition-colors duration-150 hover:bg-[var(--hover)]"
      style={{
        ['--hover' as string]: 'rgba(10,22,40,0.06)',
        color: INK,
        border: `1px solid ${RULE}`,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function LegendItem({ color, label, isDot, isRing }: { color: string; label: string; isDot?: boolean; isRing?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {isRing ? (
        <span
          className="h-3 w-3 rounded-full"
          style={{ border: `1.5px solid ${color}`, backgroundColor: 'transparent' }}
        />
      ) : isDot ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="h-2 w-2" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}

function CalendarCell({
  cell, isToday, isSelected, isPast, hasDeadline, dayEvents, weekIndex, colIndex, onClick,
}: {
  cell: { day: number; isCurrentMonth: boolean; date: Date };
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  hasDeadline: boolean;
  dayEvents: CalendarEvent[];
  weekIndex: number;
  colIndex: number;
  onClick: () => void;
}) {
  const opacity = !cell.isCurrentMonth ? 0.25 : isPast ? 0.55 : 1;
  const trainingCount = dayEvents.filter(e => e.eventType === 'training').length;
  const examCount = dayEvents.filter(e => e.eventType === 'exam').length;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!cell.isCurrentMonth}
      aria-label={`${cell.day}, ${dayEvents.length} kayıt`}
      className="group relative flex h-[64px] flex-col justify-between p-2 text-left transition-colors duration-150 sm:h-[72px] sm:p-2.5"
      style={{
        opacity,
        cursor: cell.isCurrentMonth ? 'pointer' : 'default',
        borderTop: weekIndex === 0 ? 'none' : `1px solid ${RULE}`,
        borderLeft: colIndex === 0 ? 'none' : `1px solid ${RULE}`,
        backgroundColor: isSelected ? '#fffaef' : 'transparent',
      }}
      onMouseEnter={e => {
        if (cell.isCurrentMonth && !isSelected) {
          e.currentTarget.style.backgroundColor = 'rgba(10,22,40,0.025)';
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Day number row */}
      <div className="flex items-start justify-between">
        <span
          className="leading-none tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.95rem, 1.4vw, 1.125rem)',
            fontWeight: isToday ? 800 : 600,
            color: isToday ? INK : isSelected ? INK : INK_SOFT,
            ...(isToday && {
              borderBottom: `2px solid ${GOLD}`,
              paddingBottom: '2px',
            }),
          }}
        >
          {cell.day.toString().padStart(2, '0')}
        </span>

        {hasDeadline && (
          <span
            aria-label="Son tarih"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#b3261e' }}
          />
        )}
      </div>

      {/* Event indicator strip — minimal, uniform across all cells */}
      {cell.isCurrentMonth && dayEvents.length > 0 && (
        <div className="flex items-center gap-1.5">
          {trainingCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5" style={{ backgroundColor: '#2c55b8' }} />
              <span
                className="text-[9px] tabular-nums leading-none"
                style={{ color: '#2c55b8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              >
                {trainingCount}
              </span>
            </span>
          )}
          {examCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5" style={{ backgroundColor: OLIVE }} />
              <span
                className="text-[9px] tabular-nums leading-none"
                style={{ color: OLIVE, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              >
                {examCount}
              </span>
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────
   Week View — 7 day rows with inline events. Mobile-first:
   vertical stack, horizontal on tablet+.
   ───────────────────────────────────────────────────── */

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-based week
  date.setDate(date.getDate() + diff);
  return date;
}

function WeekView({
  today, year, month, selectedDay, eventsByDate, onSelectDay,
}: {
  today: Date;
  year: number;
  month: number;
  selectedDay: number | null;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDay: (day: number) => void;
}) {
  // Anchor the week to: (a) selected day if in view month, otherwise (b) today if in view month, (c) first day of view month.
  const anchor = useMemo(() => {
    if (selectedDay !== null) return new Date(year, month, selectedDay);
    if (today.getFullYear() === year && today.getMonth() === month) return today;
    return new Date(year, month, 1);
  }, [selectedDay, year, month, today]);

  const weekDays = useMemo(() => {
    const start = getWeekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  return (
    <div className="space-y-3">
      <p
        className="text-[10px] tracking-[0.22em]"
        style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
      >
        {weekDays[0].getDate().toString().padStart(2, '0')}
        {' – '}
        {weekDays[6].getDate().toString().padStart(2, '0')}
        {' '}
        {MONTHS_TR[weekDays[6].getMonth()]}
      </p>

      <ol className="list-none space-y-2 p-0">
        {weekDays.map(d => {
          const evts = eventsByDate.get(d.toDateString()) ?? [];
          const isToday = isSameDay(d, today);
          const isInMonth = d.getMonth() === month && d.getFullYear() === year;
          const daySelectable = isInMonth;
          const isSelectedHere = daySelectable && selectedDay === d.getDate();

          return (
            <li
              key={d.toISOString()}
              className="border bg-white"
              style={{
                borderColor: isSelectedHere ? INK : RULE,
                borderLeftWidth: '3px',
                borderLeftColor: isToday ? GOLD : isSelectedHere ? INK : RULE,
              }}
            >
              <button
                type="button"
                onClick={() => daySelectable && onSelectDay(d.getDate())}
                disabled={!daySelectable}
                className="flex w-full items-start gap-3 p-3 text-left"
                style={{ minHeight: 56, cursor: daySelectable ? 'pointer' : 'default' }}
              >
                <div className="w-14 shrink-0">
                  <div
                    className="text-[10px] tracking-[0.2em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  >
                    {DAYS_TR[(d.getDay() + 6) % 7]}
                  </div>
                  <div
                    className="tabular-nums leading-none"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: isInMonth ? INK : INK_SOFT,
                      opacity: isInMonth ? 1 : 0.4,
                    }}
                  >
                    {d.getDate().toString().padStart(2, '0')}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  {evts.length === 0 ? (
                    <p
                      className="text-[11px] tracking-[0.18em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                    >
                      —
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {evts.slice(0, 3).map(e => (
                        <li key={e.id} className="flex items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 shrink-0"
                            style={{ backgroundColor: e.eventType === 'exam' ? OLIVE : '#2c55b8' }}
                          />
                          <span
                            className="truncate text-[13px] leading-snug"
                            style={{ color: INK, fontFamily: 'var(--font-display)', fontWeight: 600 }}
                          >
                            {e.title}
                          </span>
                        </li>
                      ))}
                      {evts.length > 3 && (
                        <li
                          className="text-[10px] tracking-[0.18em]"
                          style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                        >
                          +{evts.length - 3} DAHA
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Agenda View — chronological bucketed list.
   Mobile default; shows only actionable (future) events by default.
   ───────────────────────────────────────────────────── */

type AgendaBucket = { key: string; label: string; events: CalendarEvent[] };

/**
 * Group events into human-friendly time buckets for agenda view.
 * Buckets: Bugün / Yarın / Bu Hafta / Sonraki Hafta / Daha Sonra.
 * Shows only events starting or ending in the next 90 days.
 */
function groupAgendaEvents(events: CalendarEvent[], today: Date): AgendaBucket[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const todayKey = start.toDateString();

  const tomorrow = new Date(start);
  tomorrow.setDate(start.getDate() + 1);
  const tomorrowKey = tomorrow.toDateString();

  const endOfWeek = new Date(start);
  const daysUntilSunday = (7 - start.getDay()) % 7 || 7;
  endOfWeek.setDate(start.getDate() + daysUntilSunday);

  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);

  const cutoff = new Date(start);
  cutoff.setDate(start.getDate() + 90);

  const buckets: Record<string, AgendaBucket> = {
    today:    { key: 'today',    label: 'BUGÜN',         events: [] },
    tomorrow: { key: 'tomorrow', label: 'YARIN',         events: [] },
    thisWeek: { key: 'thisWeek', label: 'BU HAFTA',      events: [] },
    nextWeek: { key: 'nextWeek', label: 'SONRAKİ HAFTA', events: [] },
    later:    { key: 'later',    label: 'DAHA SONRA',    events: [] },
  };

  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  for (const evt of sorted) {
    const evtStart = new Date(evt.start);
    const evtEnd = new Date(evt.end);
    // Use end for past-filtering (show until the deadline passes).
    if (evtEnd < start) continue;
    if (evtStart > cutoff) continue;

    const refDate = evtStart < start ? start : evtStart;
    const refKey = refDate.toDateString();

    if (refKey === todayKey) buckets.today.events.push(evt);
    else if (refKey === tomorrowKey) buckets.tomorrow.events.push(evt);
    else if (refDate <= endOfWeek) buckets.thisWeek.events.push(evt);
    else if (refDate <= endOfNextWeek) buckets.nextWeek.events.push(evt);
    else buckets.later.events.push(evt);
  }

  return Object.values(buckets).filter(b => b.events.length > 0);
}

function AgendaView({
  events, today,
}: {
  events: CalendarEvent[];
  today: Date;
  year: number;
  month: number;
}) {
  const buckets = useMemo(() => groupAgendaEvents(events, today), [events, today]);

  if (buckets.length === 0) {
    return (
      <div
        className="flex flex-col items-center py-16 text-center"
        style={{ border: `1.5px dashed ${RULE}` }}
      >
        <CalendarIcon className="h-8 w-8" style={{ color: INK_SOFT }} strokeWidth={1.25} />
        <p
          className="mt-4 text-[11px] tracking-[0.22em]"
          style={{ color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
        >
          YAKLAŞAN KAYIT YOK
        </p>
        <p
          className="mt-2 text-[13px]"
          style={{ color: INK_SOFT }}
        >
          Önümüzdeki 90 gün için planlı eğitim ya da sınav görünmüyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {buckets.map(bucket => (
        <section key={bucket.key}>
          <header
            className="flex items-center gap-3 border-y py-2 text-[10px] tracking-[0.22em]"
            style={{ borderColor: INK, color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            <span>{bucket.label}</span>
            <span className="h-px flex-1" style={{ backgroundColor: RULE }} />
            <span style={{ color: INK_SOFT }}>
              {bucket.events.length.toString().padStart(2, '0')}
            </span>
          </header>

          <ul className="mt-3 list-none space-y-2 p-0">
            {bucket.events.map(evt => (
              <li key={evt.id}>
                <AgendaEventCard evt={evt} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AgendaEventCard({ evt }: { evt: CalendarEvent }) {
  const cfg = STATUS[evt.status];
  const Icon = evt.eventType === 'exam' ? ClipboardList : cfg.icon;
  const days = daysUntil(evt.end);
  const urgent = days >= 0 && days <= 3 && (evt.status === 'assigned' || evt.status === 'in_progress');
  return (
    <Link
      href={`/staff/my-trainings/${evt.trainingId}`}
      className="group flex items-start gap-3 border bg-white p-3 transition-[border-color] duration-150 hover:border-[var(--ink)]"
      style={{
        ['--ink' as string]: INK,
        borderColor: RULE,
        borderLeftWidth: '3px',
        borderLeftColor: cfg.ink,
        minHeight: 56,
      }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: cfg.ink }} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] tracking-[0.22em]"
            style={{ color: cfg.ink, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            {evt.eventType === 'exam' ? 'SINAV' : 'EĞİTİM'} · {cfg.label}
          </span>
          {urgent && (
            <span
              className="text-[10px] tracking-[0.14em]"
              style={{ color: '#b3261e', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              · {days} GÜN
            </span>
          )}
        </div>
        <h4
          className="mt-1 leading-snug tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            color: INK,
            fontWeight: 700,
            fontSize: '0.9375rem',
          }}
        >
          {evt.title}
        </h4>
        <p
          className="mt-1 text-[11px] tabular-nums"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
        >
          {formatDateRange(evt.start, evt.end)}
        </p>
      </div>
      <ArrowRight
        className="mt-1 h-3 w-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ color: INK_SOFT }}
      />
    </Link>
  );
}

function SelectedDayPanel({
  day, month, year, events, onClose,
}: {
  day: number;
  month: number;
  year: number;
  events: CalendarEvent[];
  onClose: () => void;
}) {
  return (
    <section>
      <header
        className="flex items-center gap-3 border-y py-2 text-[10px] tracking-[0.22em]"
        style={{ borderColor: INK, color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
      >
        <span>SEÇİLİ GÜN</span>
        <span className="h-px flex-1" style={{ backgroundColor: RULE }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="text-[10px] tracking-[0.18em] hover:text-[var(--ink-soft)]"
          style={{ ['--ink-soft' as string]: INK_SOFT, color: INK_SOFT }}
        >
          <X className="h-3 w-3" />
        </button>
      </header>

      <div className="mt-4 flex items-baseline gap-3">
        <span
          className="leading-none tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '3rem',
            fontWeight: 800,
            color: INK,
            letterSpacing: '-0.04em',
          }}
        >
          {day.toString().padStart(2, '0')}
        </span>
        <span
          className="text-[12px] tracking-[0.2em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
        >
          {MONTHS_TR[month]} {year}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {events.length === 0 ? (
          <div
            className="flex flex-col items-center py-10 text-center"
            style={{ border: `1.5px dashed ${RULE}` }}
          >
            <CalendarIcon className="h-6 w-6" style={{ color: INK_SOFT }} strokeWidth={1.5} />
            <p
              className="mt-3 text-[11px] tracking-[0.22em]"
              style={{ color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              KAYIT YOK
            </p>
          </div>
        ) : (
          events.map(evt => {
            const cfg = STATUS[evt.status];
            const Icon = evt.eventType === 'exam' ? ClipboardList : cfg.icon;
            const days = daysUntil(evt.end);
            return (
              <Link
                key={evt.id}
                href={`/staff/my-trainings/${evt.trainingId}`}
                className="group block border bg-white p-4 transition-[border-color] duration-150 hover:border-[var(--ink)]"
                style={{
                  ['--ink' as string]: INK,
                  borderColor: RULE,
                  borderLeftWidth: '3px',
                  borderLeftColor: cfg.ink,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3 w-3" style={{ color: cfg.ink }} strokeWidth={2.5} />
                  <span
                    className="text-[10px] tracking-[0.22em]"
                    style={{ color: cfg.ink, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  >
                    {evt.eventType === 'exam' ? 'SINAV' : 'EĞİTİM'} · {cfg.label}
                  </span>
                </div>

                <h4
                  className="mt-2 leading-snug tracking-tight"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: INK,
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                  }}
                >
                  {evt.title}
                </h4>

                <div className="mt-2 flex items-center justify-between">
                  <p
                    className="text-[11px] tabular-nums"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                  >
                    {formatDateRange(evt.start, evt.end)}
                  </p>
                  {days >= 0 && days <= 7 && (evt.status === 'assigned' || evt.status === 'in_progress') && (
                    <span
                      className="text-[10px] tracking-[0.14em]"
                      style={{
                        color: days <= 3 ? '#b3261e' : '#b4820b',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                      }}
                    >
                      {days} GÜN
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function DeadlinesPanel({ events }: { events: CalendarEvent[] }) {
  return (
    <section>
      <header
        className="flex items-center gap-3 border-y py-2 text-[10px] tracking-[0.22em]"
        style={{ borderColor: INK, color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
      >
        <span>YAKLAŞAN SON TARİHLER</span>
        <span className="h-px flex-1" style={{ backgroundColor: RULE }} />
        <span style={{ color: INK_SOFT }}>30 GÜN</span>
      </header>

      <div className="mt-5">
        {events.length === 0 ? (
          <div
            className="flex flex-col items-center py-8 text-center"
            style={{ border: `1.5px dashed ${RULE}` }}
          >
            <CheckCircle2 className="h-6 w-6" style={{ color: '#0a7a47' }} strokeWidth={1.5} />
            <p
              className="mt-3 text-[11px] tracking-[0.22em]"
              style={{ color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              YAKLAŞAN SON TARİH YOK
            </p>
          </div>
        ) : (
          <ol className="list-none space-y-3 p-0">
            {events.map((evt, i) => {
              const days = daysUntil(evt.end);
              const cfg = STATUS[evt.status];
              const urgency = days <= 3 ? '#b3261e' : days <= 7 ? '#b4820b' : INK_SOFT;
              return (
                <li
                  key={evt.id}
                  className="grid items-stretch gap-3"
                  style={{ gridTemplateColumns: '24px 1fr' }}
                >
                  <span
                    className="pt-2 text-[10px] tabular-nums tracking-[0.14em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                  >
                    {(i + 1).toString().padStart(2, '0')}
                  </span>
                  <Link
                    href={`/staff/my-trainings/${evt.trainingId}`}
                    className="group flex items-center gap-3 border bg-white p-3 transition-[border-color] duration-150 hover:border-[var(--ink)]"
                    style={{
                      ['--ink' as string]: INK,
                      borderColor: RULE,
                    }}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center"
                      style={{
                        border: `1px solid ${urgency}`,
                        color: urgency,
                      }}
                    >
                      <span
                        className="text-[14px] tabular-nums leading-none"
                        style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
                      >
                        {days}
                      </span>
                      <span
                        className="mt-0.5 text-[8px] tracking-[0.2em]"
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                      >
                        GÜN
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[13px] leading-tight tracking-tight"
                        style={{ color: INK, fontFamily: 'var(--font-display)', fontWeight: 700 }}
                      >
                        {evt.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5" style={{ backgroundColor: cfg.ink }} />
                        <span
                          className="text-[10px] tracking-[0.18em]"
                          style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <ArrowRight
                      className="h-3 w-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                      style={{ color: INK_SOFT }}
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function CalendarSkeleton() {
  return (
    <div
      className="-mx-4 -my-4 md:-mx-8 md:-my-8"
      style={{ backgroundColor: CREAM, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="animate-pulse px-6 pt-6 sm:px-10 lg:px-16">
        <div className="h-4 border-y py-2" style={{ borderColor: INK }} />
        <div className="mt-8 h-12 w-64 rounded" style={{ backgroundColor: RULE }} />
        <div className="mt-10 h-[3px]" style={{ backgroundColor: INK }} />
        <div className="mt-10 grid grid-cols-7 gap-px">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-24" style={{ backgroundColor: 'rgba(229,224,213,0.4)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarError({ message }: { message: string }) {
  return (
    <div
      className="-mx-4 -my-4 md:-mx-8 md:-my-8"
      style={{ backgroundColor: CREAM, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="px-6 pt-10 pb-24 sm:px-10 lg:px-16">
        <div
          className="flex items-center gap-4 text-[10px] tracking-[0.22em]"
          style={{ color: '#b3261e', fontFamily: 'var(--font-mono)' }}
        >
          <span>—</span>
          <span style={{ fontWeight: 700 }}>HATA</span>
          <span className="h-px flex-1" style={{ backgroundColor: '#b3261e' }} />
        </div>
        <h1
          className="mt-6 leading-tight tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            color: INK,
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 800,
          }}
        >
          Takvim yüklenemedi<span style={{ color: '#b3261e' }}>.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[14px] leading-relaxed" style={{ color: INK_SOFT }}>
          {message || 'Sunucuya bağlanırken bir sorun oluştu.'}
        </p>
      </div>
    </div>
  );
}
