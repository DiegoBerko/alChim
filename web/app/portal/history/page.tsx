'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GymSession, SessionBlock, EffortLevel } from '@/lib/types';
import { getPortalCode } from '@/lib/student-session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function countDoneSets(blocks: SessionBlock[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const block of blocks) {
    for (const ex of block.exercises) {
      for (const s of ex.sets) {
        total++;
        if (s.done) done++;
      }
    }
  }
  return { done, total };
}

const EFFORT_LABELS: Record<EffortLevel, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  intenso: 'Intenso',
  muy_intenso: 'Muy intenso',
};

const EFFORT_COLORS: Record<EffortLevel, string> = {
  facil: '#22c55e',
  normal: '#3b82f6',
  intenso: '#F5A623',
  muy_intenso: '#ef4444',
};

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: GymSession }) {
  const [expanded, setExpanded] = useState(false);
  const { done, total } = countDoneSets(session.blocks);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      <button
        className="w-full px-4 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs mb-1" style={{ color: '#888' }}>
              {formatDate(session.startedAt)}
            </p>
            <p className="font-semibold text-sm" style={{ color: '#f5f5f5' }}>
              {session.planName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#888' }}>
              {session.dayName}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono font-bold text-sm" style={{ color: '#F5A623' }}>
              {formatDuration(session.durationSeconds)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#888' }}>
              {done}/{total} series
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end mt-2">
          <svg
            style={{ color: '#888', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #2a2a2a' }}>
          {session.blocks.map((block) => (
            <div key={block.planBlockId} className="px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#F5A623' }}>
                {block.name}
              </p>
              {block.exercises.map((ex) => (
                <div key={ex.planExerciseId} className="mb-3">
                  <p className="text-sm font-medium mb-1" style={{ color: '#f5f5f5' }}>
                    {ex.exerciseName}
                  </p>
                  <div className="space-y-1">
                    {ex.sets.map((s) => (
                      <div key={s.setNumber} className="flex items-center gap-2 text-xs" style={{ color: '#888' }}>
                        <span className="w-4">{s.setNumber}.</span>
                        <span>
                          {s.actualReps}
                          {s.mode === 'seconds' ? 's' : ' reps'}
                          {s.actualWeight ? ` · ${s.actualWeight}kg` : ''}
                        </span>
                        {s.effort && (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: `${EFFORT_COLORS[s.effort]}22`,
                              color: EFFORT_COLORS[s.effort],
                            }}
                          >
                            {EFFORT_LABELS[s.effort]}
                          </span>
                        )}
                        {!s.done && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#2a2a2a', color: '#888' }}>
                            Pendiente
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {ex.studentNote && (
                    <p className="text-xs mt-1 italic" style={{ color: '#888' }}>
                      {ex.studentNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))}

          {session.generalNote && (
            <div className="px-4 pb-4" style={{ borderTop: '1px solid #2a2a2a' }}>
              <p className="text-xs font-medium mt-3 mb-1" style={{ color: '#888' }}>
                Nota general
              </p>
              <p className="text-sm" style={{ color: '#f5f5f5' }}>
                {session.generalNote}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────

const DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getMonthDays(year: number, month: number): (Date | null)[] {
  // month: 0-indexed
  const firstDay = new Date(year, month, 1);
  // Monday = 0 in our grid. JS: 0=Sun, 1=Mon...
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6; // Sunday -> 6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

function CalendarTab({ sessions }: { sessions: GymSession[] }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a map of date string -> sessions
  const sessionMap = new Map<string, GymSession[]>();
  for (const s of sessions) {
    const key = s.startedAt.slice(0, 10);
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key)!.push(s);
  }

  const cells = getMonthDays(viewYear, viewMonth);

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
    setSelectedDate(null);
  }

  const selectedSessions = selectedDate ? (sessionMap.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#242424' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5f5f5" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="font-semibold capitalize" style={{ color: '#f5f5f5' }}>
          {monthName}
        </span>
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#242424' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5f5f5" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-bold py-1" style={{ color: '#888' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const key = date.toISOString().slice(0, 10);
          const hasSessions = sessionMap.has(key);
          const isSelected = selectedDate === key;
          const isToday = key === today.toISOString().slice(0, 10);

          return (
            <button
              key={key}
              onClick={() => {
                if (hasSessions) setSelectedDate(isSelected ? null : key);
              }}
              disabled={!hasSessions}
              className="aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-colors"
              style={{
                backgroundColor: isSelected
                  ? '#F5A623'
                  : hasSessions
                  ? 'rgba(245,166,35,0.15)'
                  : 'transparent',
                color: isSelected ? '#0D0D0D' : isToday ? '#F5A623' : hasSessions ? '#f5f5f5' : '#555',
                border: isToday && !isSelected ? '1px solid #F5A623' : '1px solid transparent',
                cursor: hasSessions ? 'pointer' : 'default',
              }}
            >
              {date.getDate()}
              {hasSessions && !isSelected && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: '#F5A623' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day sessions */}
      {selectedDate && selectedSessions.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium" style={{ color: '#888' }}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {selectedSessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    const code = getPortalCode();
    if (!code) {
      router.replace('/portal');
      return;
    }

    fetch(`/api/student/sessions?code=${code}`)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((data: { sessions: GymSession[] }) => {
        setSessions(data.sessions);
      })
      .catch(() => setError('No se pudo cargar el historial. Intentá de nuevo.'))
      .finally(() => setLoading(false));
  }, [router]);

  const tabs: { id: 'list' | 'calendar'; label: string }[] = [
    { id: 'list', label: 'Lista' },
    { id: 'calendar', label: 'Calendario' },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: '#242424', width: '50%' }} />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: '#242424', color: '#f5f5f5' }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#f5f5f5' }}>
        Historial
      </h1>

      {/* Tab bar */}
      <div
        className="flex rounded-xl p-1"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? '#F5A623' : 'transparent',
              color: activeTab === tab.id ? '#0D0D0D' : '#888',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p style={{ color: '#888' }}>No hay sesiones registradas todavía.</p>
        </div>
      ) : activeTab === 'list' ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <CalendarTab sessions={sessions} />
      )}
    </div>
  );
}
