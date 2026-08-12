'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { Plan, PlanDay, SessionBlock, SessionExercise, SessionSet, EffortLevel } from '@/lib/types';
import {
  getPortalCode,
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
  ActiveSession,
} from '@/lib/student-session';

// ─── Helper: build session from plan day ─────────────────────────────────────

function buildSessionFromDay(
  planId: string,
  planName: string,
  day: PlanDay
): ActiveSession {
  return {
    planId,
    planName,
    dayId: day.id,
    dayName: day.name,
    startedAt: Date.now(),
    generalNote: '',
    blocks: day.blocks
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((block) => ({
        planBlockId: block.id,
        name: block.name,
        orderIndex: block.orderIndex,
        exercises: block.exercises
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((ex) => ({
            planExerciseId: ex.id,
            exerciseName: ex.exerciseName,
            orderIndex: ex.orderIndex,
            mode: ex.mode,
            notes: ex.notes,
            studentNote: '',
            sets: ex.sets.map((s) => ({
              setNumber: s.setNumber,
              targetReps: s.targetReps,
              targetWeight: s.targetWeight,
              mode: s.mode ?? ex.mode,
              actualReps: s.targetReps,
              actualWeight: s.targetWeight,
              done: false,
              effort: undefined,
            })),
          })),
      })),
  };
}

// ─── Timer display ────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ─── Effort pill config ───────────────────────────────────────────────────────

const EFFORT_PILLS: { value: EffortLevel; label: string }[] = [
  { value: 'facil', label: 'F' },
  { value: 'normal', label: 'N' },
  { value: 'intenso', label: 'I' },
  { value: 'muy_intenso', label: 'MI' },
];

// ─── Session progress ─────────────────────────────────────────────────────────

function countSets(blocks: SessionBlock[]): { done: number; total: number } {
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

// ─── Conflict dialog ─────────────────────────────────────────────────────────

function ConflictDialog({
  existingDayName,
  onDiscard,
  onGoBack,
}: {
  existingDayName: string;
  onDiscard: () => void;
  onGoBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <h2 className="font-bold text-lg" style={{ color: '#f5f5f5' }}>Sesión en curso</h2>
        <p className="text-sm" style={{ color: '#888' }}>
          Hay una sesión de <span style={{ color: '#F5A623' }}>{existingDayName}</span> sin terminar. ¿Qué querés hacer?
        </p>
        <div className="space-y-2">
          <button
            onClick={onDiscard}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}
          >
            Descartar sesión anterior y empezar nueva
          </button>
          <button
            onClick={onGoBack}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#242424', color: '#f5f5f5', border: '1px solid #2a2a2a' }}
          >
            Volver y retomar sesión anterior
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Finish modal ─────────────────────────────────────────────────────────────

function FinishModal({
  session,
  elapsed,
  onClose,
  onSave,
  saving,
  saveError,
  onNoteChange,
}: {
  session: ActiveSession;
  elapsed: number;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  onNoteChange: (note: string) => void;
}) {
  const { done, total } = countSets(session.blocks);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <h2 className="font-bold text-xl" style={{ color: '#f5f5f5' }}>Finalizar sesión</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#242424' }}>
            <p className="text-xs mb-1" style={{ color: '#888' }}>Tiempo total</p>
            <p className="font-bold text-lg" style={{ color: '#F5A623' }}>{formatTime(elapsed)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#242424' }}>
            <p className="text-xs mb-1" style={{ color: '#888' }}>Series hechas</p>
            <p className="font-bold text-lg" style={{ color: done === total && total > 0 ? '#22c55e' : '#f5f5f5' }}>
              {done}/{total}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#888' }}>
            Nota general (opcional)
          </label>
          <textarea
            value={session.generalNote}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            placeholder="¿Cómo fue el entrenamiento?"
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ backgroundColor: '#242424', border: '1px solid #2a2a2a', color: '#f5f5f5' }}
          />
        </div>

        {saveError && (
          <p className="text-sm text-center" style={{ color: '#ef4444' }}>{saveError}</p>
        )}

        <div className="space-y-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold"
            style={{
              backgroundColor: '#F5A623',
              color: '#0D0D0D',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Guardando...' : 'Guardar sesión'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#242424', color: '#f5f5f5', border: '1px solid #2a2a2a' }}
          >
            Seguir entrenando
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({
  set,
  onUpdate,
}: {
  set: SessionSet;
  onUpdate: (updated: Partial<SessionSet>) => void;
}) {
  const targetLabel =
    set.mode === 'seconds'
      ? `${set.targetReps}s${set.targetWeight ? ` · ${set.targetWeight}kg` : ''}`
      : `${set.targetReps} reps${set.targetWeight ? ` · ${set.targetWeight}kg` : ''}`;

  return (
    <div
      className="rounded-lg p-2.5 transition-colors"
      style={{
        backgroundColor: set.done ? 'rgba(245,166,35,0.08)' : '#0D0D0D',
        border: set.done ? '1px solid rgba(245,166,35,0.3)' : '1px solid #2a2a2a',
      }}
    >
      <div className="flex items-center gap-2">
        {/* Set number */}
        <span
          className="text-xs font-bold w-5 text-center shrink-0"
          style={{ color: '#888' }}
        >
          {set.setNumber}
        </span>

        {/* Target */}
        <span className="text-xs w-16 shrink-0" style={{ color: '#888' }}>
          {targetLabel}
        </span>

        {/* Actual reps */}
        <input
          type="text"
          value={set.actualReps}
          onChange={(e) => onUpdate({ actualReps: e.target.value })}
          placeholder={set.mode === 'seconds' ? 'seg' : 'reps'}
          className="w-14 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#f5f5f5',
          }}
        />

        {/* Actual weight */}
        <input
          type="number"
          value={set.actualWeight ?? ''}
          onChange={(e) => onUpdate({ actualWeight: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
          placeholder="kg"
          min={0}
          step={0.5}
          className="w-14 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#f5f5f5',
          }}
        />

        {/* Done button */}
        <button
          onClick={() => onUpdate({ done: !set.done })}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ml-auto"
          style={{
            backgroundColor: set.done ? '#F5A623' : '#1a1a1a',
            border: set.done ? 'none' : '1px solid #2a2a2a',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={set.done ? '#0D0D0D' : '#888'} strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      {/* Effort pills */}
      <div className="flex gap-1.5 mt-2 ml-7">
        {EFFORT_PILLS.map((pill) => (
          <button
            key={pill.value}
            onClick={() => onUpdate({ effort: set.effort === pill.value ? undefined : pill.value })}
            className="px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
            style={{
              backgroundColor: set.effort === pill.value ? '#F5A623' : '#1a1a1a',
              color: set.effort === pill.value ? '#0D0D0D' : '#888',
              border: set.effort === pill.value ? 'none' : '1px solid #2a2a2a',
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  onUpdateSet,
  onUpdateNote,
}: {
  exercise: SessionExercise;
  onUpdateSet: (setIndex: number, updated: Partial<SessionSet>) => void;
  onUpdateNote: (note: string) => void;
}) {
  const allDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.done);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
        <div className="flex items-center gap-2">
          {allDone && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <h3 className="font-semibold text-sm" style={{ color: allDone ? '#22c55e' : '#f5f5f5' }}>
            {exercise.exerciseName}
          </h3>
        </div>
        {exercise.notes && (
          <p className="text-xs mt-1" style={{ color: '#888' }}>
            {exercise.notes}
          </p>
        )}
      </div>

      <div className="px-3 py-3 space-y-2">
        {exercise.sets.map((set, si) => (
          <SetRow
            key={set.setNumber}
            set={set}
            onUpdate={(updated) => onUpdateSet(si, updated)}
          />
        ))}
      </div>

      <div className="px-3 pb-3">
        <textarea
          value={exercise.studentNote}
          onChange={(e) => onUpdateNote(e.target.value)}
          rows={2}
          placeholder="Tu nota para este ejercicio..."
          className="w-full px-3 py-2 rounded-lg text-xs resize-none outline-none"
          style={{
            backgroundColor: '#0D0D0D',
            border: '1px solid #2a2a2a',
            color: '#f5f5f5',
          }}
        />
      </div>
    </div>
  );
}

// ─── Main page (inner, uses useSearchParams) ──────────────────────────────────

function SessionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const planId = searchParams.get('planId') ?? '';
  const dayId = searchParams.get('dayId') ?? '';
  const planName = searchParams.get('planName') ?? '';
  const dayName = searchParams.get('dayName') ?? '';

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [initialising, setInitialising] = useState(true);
  const [conflictSession, setConflictSession] = useState<ActiveSession | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounce ref for auto-save
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Wake Lock ────────────────────────────────────────────────────────────
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if ('wakeLock' in navigator) {
        try {
          lock = await (navigator as any).wakeLock.request('screen');
        } catch {}
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release();
    };
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const startedAt = session.startedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startedAt]);

  // ── Initialise ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!planId || !dayId) {
      router.replace('/portal/plans');
      return;
    }

    const code = getPortalCode();
    if (!code) {
      router.replace('/portal');
      return;
    }

    const existing = getActiveSession();

    if (existing) {
      if (existing.planId === planId && existing.dayId === dayId) {
        // Resume
        setSession(existing);
        setInitialising(false);
        return;
      } else {
        // Conflict
        setConflictSession(existing);
        setInitialising(false);
        return;
      }
    }

    // Build fresh
    fetch(`/api/student/plans?code=${code}`)
      .then((r) => r.json())
      .then((data: { plans: Plan[] }) => {
        const plan = data.plans.find((p) => p.id === planId);
        if (!plan) throw new Error('plan not found');

        let day: PlanDay | undefined;
        if (plan.days && plan.days.length > 0) {
          day = plan.days.find((d) => d.id === dayId);
        } else if (dayId === '__single__') {
          day = { id: '__single__', name: 'Día 1', blocks: plan.blocks };
        }

        if (!day) throw new Error('day not found');

        const newSession = buildSessionFromDay(planId, planName || plan.name, day);
        saveActiveSession(newSession);
        setSession(newSession);
      })
      .catch(() => {
        router.replace('/portal/plans');
      })
      .finally(() => setInitialising(false));
  }, [planId, dayId, planName, router]);

  // ── Auto-save on session change ──────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveActiveSession(session);
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [session]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateSet = useCallback(
    (blockIdx: number, exIdx: number, setIdx: number, updated: Partial<SessionSet>) => {
      setSession((prev) => {
        if (!prev) return prev;
        const blocks = prev.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block;
          return {
            ...block,
            exercises: block.exercises.map((ex, ei) => {
              if (ei !== exIdx) return ex;
              return {
                ...ex,
                sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, ...updated } : s)),
              };
            }),
          };
        });
        return { ...prev, blocks };
      });
    },
    []
  );

  const updateNote = useCallback(
    (blockIdx: number, exIdx: number, note: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const blocks = prev.blocks.map((block, bi) => {
          if (bi !== blockIdx) return block;
          return {
            ...block,
            exercises: block.exercises.map((ex, ei) =>
              ei !== exIdx ? ex : { ...ex, studentNote: note }
            ),
          };
        });
        return { ...prev, blocks };
      });
    },
    []
  );

  const updateGeneralNote = useCallback((note: string) => {
    setSession((prev) => (prev ? { ...prev, generalNote: note } : prev));
  }, []);

  async function handleSave() {
    if (!session) return;
    const code = getPortalCode();
    if (!code) return;

    setSaving(true);
    setSaveError(null);

    const finishedAt = new Date().toISOString();
    const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);

    const body = {
      planId: session.planId,
      planName: session.planName,
      dayId: session.dayId,
      dayName: session.dayName,
      startedAt: new Date(session.startedAt).toISOString(),
      finishedAt,
      durationSeconds,
      blocks: session.blocks,
      generalNote: session.generalNote,
    };

    try {
      const res = await fetch(`/api/student/sessions?code=${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      clearActiveSession();
      router.push('/portal/history');
    } catch {
      setSaveError('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
      setSaving(false);
    }
  }

  // ── Render states ────────────────────────────────────────────────────────

  if (initialising) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#F5A623', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (conflictSession) {
    return (
      <ConflictDialog
        existingDayName={conflictSession.dayName}
        onDiscard={() => {
          clearActiveSession();
          setConflictSession(null);
          setInitialising(true);
          // Re-trigger init by calling fetch directly
          const code = getPortalCode();
          if (!code) { router.replace('/portal'); return; }
          fetch(`/api/student/plans?code=${code}`)
            .then((r) => r.json())
            .then((data: { plans: Plan[] }) => {
              const plan = data.plans.find((p) => p.id === planId);
              if (!plan) throw new Error('plan not found');
              let day: PlanDay | undefined;
              if (plan.days && plan.days.length > 0) {
                day = plan.days.find((d) => d.id === dayId);
              } else if (dayId === '__single__') {
                day = { id: '__single__', name: 'Día 1', blocks: plan.blocks };
              }
              if (!day) throw new Error('day not found');
              const newSession = buildSessionFromDay(planId, planName || plan.name, day);
              saveActiveSession(newSession);
              setSession(newSession);
            })
            .catch(() => router.replace('/portal/plans'))
            .finally(() => setInitialising(false));
        }}
        onGoBack={() => router.replace('/portal/plans')}
      />
    );
  }

  if (!session) return null;

  const { done, total } = countSets(session.blocks);
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-40"
        style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a', margin: '0 -1rem', padding: '0 1rem' }}
      >
        <div className="max-w-lg mx-auto">
          <div className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: '#f5f5f5' }}>
                {session.planName}
              </p>
              <p className="text-xs truncate" style={{ color: '#888' }}>
                {session.dayName}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-lg font-bold" style={{ color: '#F5A623' }}>
                {formatTime(elapsed)}
              </span>
              <button
                onClick={() => setShowFinish(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: '#F5A623', color: '#0D0D0D' }}
              >
                Finalizar
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pb-2">
            <div className="flex justify-between text-xs mb-1" style={{ color: '#888' }}>
              <span>{done}/{total} series</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ backgroundColor: '#F5A623', width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 pt-4">
        {session.blocks.map((block, bi) => (
          <div key={block.planBlockId}>
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: '#F5A623' }}
            >
              {block.name}
            </h2>
            <div className="space-y-3">
              {block.exercises.map((ex, ei) => (
                <ExerciseCard
                  key={ex.planExerciseId}
                  exercise={ex}
                  onUpdateSet={(si, updated) => updateSet(bi, ei, si, updated)}
                  onUpdateNote={(note) => updateNote(bi, ei, note)}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ height: '2rem' }} />
      </div>

      {/* Finish modal */}
      {showFinish && (
        <FinishModal
          session={session}
          elapsed={elapsed}
          onClose={() => { setShowFinish(false); setSaveError(null); }}
          onSave={handleSave}
          saving={saving}
          saveError={saveError}
          onNoteChange={updateGeneralNote}
        />
      )}
    </>
  );
}

// ─── Exported page (wraps inner in Suspense for useSearchParams) ──────────────

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#F5A623', borderTopColor: 'transparent' }}
          />
        </div>
      }
    >
      <SessionPageInner />
    </Suspense>
  );
}
