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

// ─── Constants ────────────────────────────────────────────────────────────────

const EFFORT_CYCLE: EffortLevel[] = ['facil', 'normal', 'intenso', 'muy_intenso'];
const EFFORT_LABEL: Record<EffortLevel, string> = {
  facil: 'Fácil', normal: 'Normal', intenso: 'Intenso', muy_intenso: 'Máx',
};
const EFFORT_SHORT: Record<EffortLevel, string> = {
  facil: 'F', normal: 'N', intenso: 'I', muy_intenso: 'MI',
};
const EFFORT_COLOR: Record<EffortLevel, string> = {
  facil: '#4CAF50', normal: '#F5A623', intenso: '#FF9800', muy_intenso: '#F44336',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildSetSummary(sets: SessionSet[]): string {
  return sets
    .map((s) => {
      const reps = s.actualReps || s.targetReps;
      const w = s.actualWeight ?? s.targetWeight;
      if (s.mode === 'seconds') return w ? `${reps}''×${w}kg` : `${reps}''`;
      return w ? `${reps}×${w}kg` : reps;
    })
    .join(' / ');
}

function buildSessionFromDay(planId: string, planName: string, day: PlanDay): ActiveSession {
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
            done: false,
            sets: ex.sets.map((s) => ({
              setNumber: s.setNumber,
              targetReps: s.targetReps,
              targetWeight: s.targetWeight,
              mode: s.mode ?? ex.mode,
              actualReps: s.targetReps,
              actualWeight: s.targetWeight,
              done: false,
            })),
          })),
      })),
  };
}

function countProgress(blocks: SessionBlock[]): { done: number; total: number } {
  let done = 0, total = 0;
  for (const b of blocks) for (const ex of b.exercises) { total++; if (ex.done) done++; }
  return { done, total };
}

// ─── Set Row ──────────────────────────────────────────────────────────────────

function SetRow({
  set,
  disabled,
  onUpdate,
}: {
  set: SessionSet;
  disabled: boolean;
  onUpdate: (u: Partial<SessionSet>) => void;
}) {
  function cycleEffort() {
    if (disabled) return;
    const cur = set.effort ?? 'facil';
    const idx = EFFORT_CYCLE.indexOf(cur);
    onUpdate({ effort: EFFORT_CYCLE[(idx + 1) % EFFORT_CYCLE.length] });
  }

  const color = set.effort ? EFFORT_COLOR[set.effort] : '#444';

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Set number */}
      <span className="w-6 text-center text-xs font-bold shrink-0" style={{ color: '#555' }}>
        S{set.setNumber}
      </span>

      {/* Reps */}
      <input
        type="text"
        value={set.actualReps}
        onChange={(e) => onUpdate({ actualReps: e.target.value })}
        disabled={disabled}
        inputMode="numeric"
        className="w-14 px-2 py-1.5 rounded-lg text-sm text-center outline-none transition-colors"
        style={{
          backgroundColor: disabled ? '#111' : '#0D0D0D',
          border: `1px solid #2a2a2a`,
          color: disabled ? '#555' : '#f5f5f5',
        }}
      />
      <span className="text-xs shrink-0" style={{ color: '#444' }}>
        {set.mode === 'seconds' ? 'seg' : 'reps'}
      </span>

      <span className="text-xs shrink-0" style={{ color: '#444' }}>×</span>

      {/* Weight */}
      <input
        type="number"
        value={set.actualWeight ?? ''}
        onChange={(e) =>
          onUpdate({ actualWeight: e.target.value === '' ? undefined : parseFloat(e.target.value) })
        }
        disabled={disabled}
        min={0}
        step={0.5}
        placeholder="—"
        className="w-14 px-2 py-1.5 rounded-lg text-sm text-center outline-none transition-colors"
        style={{
          backgroundColor: disabled ? '#111' : '#0D0D0D',
          border: `1px solid #2a2a2a`,
          color: disabled ? '#555' : '#f5f5f5',
        }}
      />
      <span className="text-xs shrink-0" style={{ color: '#444' }}>kg</span>

      {/* Effort cycling pill */}
      <button
        onClick={cycleEffort}
        disabled={disabled}
        className="ml-auto px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors"
        style={{
          backgroundColor: set.effort ? `${color}20` : '#1a1a1a',
          border: `1px solid ${set.effort ? color : '#2a2a2a'}`,
          color: set.effort ? color : '#555',
          minWidth: '2.5rem',
          textAlign: 'center',
        }}
        title={set.effort ? EFFORT_LABEL[set.effort] : 'Marcar esfuerzo'}
      >
        {set.effort ? EFFORT_SHORT[set.effort] : '—'}
      </button>
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  onUpdateSet,
  onUpdateNote,
  onUpdateEffort,
  onToggleDone,
}: {
  exercise: SessionExercise;
  onUpdateSet: (si: number, u: Partial<SessionSet>) => void;
  onUpdateNote: (note: string) => void;
  onUpdateEffort: (effort: EffortLevel | undefined) => void;
  onToggleDone: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isDone = !!exercise.done;

  // Auto-collapse on done
  useEffect(() => { if (isDone) setCollapsed(true); }, [isDone]);

  const summary = buildSetSummary(exercise.sets);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        backgroundColor: '#1a1a1a',
        border: isDone ? '1px solid rgba(245,166,35,0.4)' : '1px solid #2a2a2a',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? 'none' : '1px solid #222' }}
        onClick={() => !isDone && setCollapsed((v) => !v)}
      >
        {/* Collapse chevron */}
        {!isDone && (
          <span className="text-xs shrink-0" style={{ color: '#444' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        )}

        {/* Name + summary */}
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-sm truncate"
            style={{ color: isDone ? '#F5A623' : '#f5f5f5' }}
          >
            {isDone && <span className="mr-1.5">✓</span>}
            {exercise.exerciseName}
          </p>
          {(collapsed || isDone) && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#555' }}>
              {exercise.sets.length} serie{exercise.sets.length !== 1 ? 's' : ''}
              {summary ? `  ·  ${summary}` : ''}
            </p>
          )}
        </div>

        {/* Done button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all text-sm font-bold"
          style={{
            backgroundColor: isDone ? '#F5A623' : 'transparent',
            border: isDone ? 'none' : '2px solid #444',
            color: isDone ? '#0D0D0D' : '#555',
          }}
          title={isDone ? 'Desmarcar' : 'Marcar como hecho'}
        >
          {isDone ? '✓' : '○'}
        </button>
      </div>

      {/* Body — hidden when collapsed or done */}
      {!collapsed && !isDone && (
        <div className="px-3 pt-2 pb-3">
          {/* Plan notes (read-only hint) */}
          {exercise.notes && (
            <p className="text-xs mb-2 px-1" style={{ color: '#666', fontStyle: 'italic' }}>
              {exercise.notes}
            </p>
          )}

          {/* Target header */}
          <div className="flex items-center gap-2 px-1 mb-1">
            <span className="w-6" />
            <span className="w-14 text-center text-xs" style={{ color: '#444' }}>Reps</span>
            <span className="text-xs" style={{ color: 'transparent' }}>seg</span>
            <span className="text-xs" style={{ color: 'transparent' }}>×</span>
            <span className="w-14 text-center text-xs" style={{ color: '#444' }}>Peso</span>
          </div>

          {/* Set rows */}
          <div className="divide-y" style={{ borderColor: '#1a1a1a' }}>
            {exercise.sets.map((set, si) => (
              <SetRow
                key={set.setNumber}
                set={set}
                disabled={false}
                onUpdate={(u) => onUpdateSet(si, u)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid #222' }}>
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs transition-colors"
              style={{ color: exercise.studentNote || exercise.done ? '#F5A623' : '#555' }}
            >
              {showDetails
                ? '▲ cerrar'
                : exercise.studentNote
                ? `nota ↓`
                : 'esfuerzo · notas ›'}
            </button>
          </div>

          {/* Details panel */}
          {showDetails && (
            <div
              className="mt-2 p-3 rounded-xl space-y-3"
              style={{ backgroundColor: '#111', border: '1px solid #222' }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#555' }}>
                  Esfuerzo general
                </p>
                <div className="flex gap-2 flex-wrap">
                  {EFFORT_CYCLE.map((e) => {
                    const active = exercise.sets.every((s) => s.effort === e) && exercise.sets.length > 0;
                    return (
                      <button
                        key={e}
                        onClick={() => {
                          // Apply effort to all sets
                          exercise.sets.forEach((_, si) => onUpdateSet(si, { effort: e }));
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          backgroundColor: active ? `${EFFORT_COLOR[e]}20` : '#1a1a1a',
                          border: `1px solid ${active ? EFFORT_COLOR[e] : '#2a2a2a'}`,
                          color: active ? EFFORT_COLOR[e] : '#888',
                        }}
                      >
                        {EFFORT_LABEL[e]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#555' }}>
                  Nota del ejercicio
                </p>
                <textarea
                  value={exercise.studentNote}
                  onChange={(e) => onUpdateNote(e.target.value)}
                  rows={2}
                  placeholder="¿Algo para recordar de este ejercicio?"
                  className="w-full px-3 py-2 rounded-lg text-xs resize-none outline-none"
                  style={{
                    backgroundColor: '#0D0D0D',
                    border: '1px solid #2a2a2a',
                    color: '#f5f5f5',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Conflict dialog ──────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <h2 className="font-bold text-lg" style={{ color: '#f5f5f5' }}>Sesión en curso</h2>
        <p className="text-sm" style={{ color: '#888' }}>
          Tenés una sesión de <span style={{ color: '#F5A623' }}>{existingDayName}</span> sin terminar.
        </p>
        <div className="space-y-2">
          <button onClick={onDiscard} className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}>
            Descartar y empezar nueva
          </button>
          <button onClick={onGoBack} className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#242424', color: '#f5f5f5', border: '1px solid #2a2a2a' }}>
            Volver y retomar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Finish modal ─────────────────────────────────────────────────────────────

function FinishModal({
  session, elapsed, onClose, onSave, saving, saveError, onNoteChange,
}: {
  session: ActiveSession; elapsed: number; onClose: () => void; onSave: () => void;
  saving: boolean; saveError: string | null; onNoteChange: (note: string) => void;
}) {
  const { done, total } = countProgress(session.blocks);
  const allDone = done === total && total > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <h2 className="font-bold text-xl" style={{ color: '#f5f5f5' }}>Finalizar sesión</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#242424' }}>
            <p className="text-xs mb-1 font-medium uppercase tracking-wider" style={{ color: '#555' }}>Tiempo</p>
            <p className="font-bold text-xl font-mono" style={{ color: '#F5A623' }}>{formatTime(elapsed)}</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#242424' }}>
            <p className="text-xs mb-1 font-medium uppercase tracking-wider" style={{ color: '#555' }}>Ejercicios</p>
            <p className="font-bold text-xl" style={{ color: allDone ? '#22c55e' : '#f5f5f5' }}>
              {done}/{total}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#555' }}>
            Nota general
          </label>
          <textarea
            value={session.generalNote}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            placeholder="¿Cómo fue el entrenamiento?"
            className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
            style={{ backgroundColor: '#242424', border: '1px solid #2a2a2a', color: '#f5f5f5' }}
          />
        </div>

        {saveError && <p className="text-sm text-center" style={{ color: '#ef4444' }}>{saveError}</p>}

        <div className="space-y-2">
          <button onClick={onSave} disabled={saving} className="w-full py-3.5 rounded-xl font-bold text-base transition-opacity"
            style={{ backgroundColor: '#F5A623', color: '#0D0D0D', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar sesión'}
          </button>
          <button onClick={onClose} disabled={saving} className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#242424', color: '#f5f5f5', border: '1px solid #2a2a2a' }}>
            Seguir entrenando
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main session page ────────────────────────────────────────────────────────

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
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Wake Lock ────────────────────────────────────────────────────────────
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if ('wakeLock' in navigator) {
        try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen'); } catch {}
      }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release(); };
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

  // ── Load fresh session from API ──────────────────────────────────────────
  const loadFresh = useCallback((code: string, onDone?: () => void) => {
    fetch(`/api/student/plans?code=${code}`)
      .then((r) => r.json())
      .then((data: { plans: Plan[] }) => {
        const plan = data.plans.find((p) => p.id === planId);
        if (!plan) throw new Error('plan not found');
        let day: PlanDay | undefined;
        if (plan.days && plan.days.length > 0) day = plan.days.find((d) => d.id === dayId);
        else if (dayId === '__single__') day = { id: '__single__', name: 'Día 1', blocks: plan.blocks };
        if (!day) throw new Error('day not found');
        const newSession = buildSessionFromDay(planId, planName || plan.name, day);
        saveActiveSession(newSession);
        setSession(newSession);
      })
      .catch(() => router.replace('/portal/plans'))
      .finally(() => { setInitialising(false); onDone?.(); });
  }, [planId, dayId, planName, router]);

  // ── Initialise ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!planId || !dayId) { router.replace('/portal/plans'); return; }
    const code = getPortalCode();
    if (!code) { router.replace('/portal'); return; }
    const existing = getActiveSession();
    if (existing) {
      if (existing.planId === planId && existing.dayId === dayId) {
        setSession(existing); setInitialising(false); return;
      }
      setConflictSession(existing); setInitialising(false); return;
    }
    loadFresh(code);
  }, [planId, dayId, loadFresh, router]);

  // ── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveActiveSession(session), 500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [session]);

  // ── Mutators ─────────────────────────────────────────────────────────────
  const updateSet = useCallback((bi: number, ei: number, si: number, u: Partial<SessionSet>) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b, bIdx) =>
          bIdx !== bi ? b : {
            ...b,
            exercises: b.exercises.map((ex, eIdx) =>
              eIdx !== ei ? ex : {
                ...ex,
                sets: ex.sets.map((s, sIdx) => sIdx !== si ? s : { ...s, ...u }),
              }
            ),
          }
        ),
      };
    });
  }, []);

  const updateNote = useCallback((bi: number, ei: number, note: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b, bIdx) =>
          bIdx !== bi ? b : {
            ...b,
            exercises: b.exercises.map((ex, eIdx) =>
              eIdx !== ei ? ex : { ...ex, studentNote: note }
            ),
          }
        ),
      };
    });
  }, []);

  const updateEffort = useCallback((bi: number, ei: number, effort: EffortLevel | undefined) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b, bIdx) =>
          bIdx !== bi ? b : {
            ...b,
            exercises: b.exercises.map((ex, eIdx) =>
              eIdx !== ei ? ex : {
                ...ex,
                sets: ex.sets.map((s) => ({ ...s, effort })),
              }
            ),
          }
        ),
      };
    });
  }, []);

  const toggleExDone = useCallback((bi: number, ei: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b, bIdx) =>
          bIdx !== bi ? b : {
            ...b,
            exercises: b.exercises.map((ex, eIdx) => {
              if (eIdx !== ei) return ex;
              const nowDone = !ex.done;
              return {
                ...ex,
                done: nowDone,
                sets: ex.sets.map((s) => ({ ...s, done: nowDone })),
              };
            }),
          }
        ),
      };
    });
  }, []);

  const updateGeneralNote = useCallback((note: string) => {
    setSession((prev) => (prev ? { ...prev, generalNote: note } : prev));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!session) return;
    const code = getPortalCode();
    if (!code) return;
    setSaving(true); setSaveError(null);
    const body = {
      planId: session.planId, planName: session.planName,
      dayId: session.dayId, dayName: session.dayName,
      startedAt: new Date(session.startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSeconds: Math.floor((Date.now() - session.startedAt) / 1000),
      blocks: session.blocks,
      generalNote: session.generalNote,
    };
    try {
      const res = await fetch(`/api/student/sessions?code=${code}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      clearActiveSession();
      router.push('/portal/history');
    } catch {
      setSaveError('No se pudo guardar. Revisá tu conexión.'); setSaving(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (initialising) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#F5A623', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (conflictSession) {
    return (
      <ConflictDialog
        existingDayName={conflictSession.dayName}
        onDiscard={() => {
          clearActiveSession(); setConflictSession(null); setInitialising(true);
          const code = getPortalCode();
          if (!code) { router.replace('/portal'); return; }
          loadFresh(code);
        }}
        onGoBack={() => router.replace('/portal/plans')}
      />
    );
  }

  if (!session) return null;

  const { done, total } = countProgress(session.blocks);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      {/* ── Sticky header ── */}
      <div
        className="sticky z-40"
        style={{
          top: 0,
          backgroundColor: '#111',
          borderBottom: '1px solid #222',
          margin: '0 -1rem',
          padding: '0 1rem',
        }}
      >
        <div className="max-w-lg mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: '#f5f5f5' }}>
                {session.planName}
              </p>
              <p className="text-xs truncate" style={{ color: '#888' }}>{session.dayName}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xl font-bold" style={{ color: '#F5A623' }}>
                {formatTime(elapsed)}
              </span>
              <button
                onClick={() => setShowFinish(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ backgroundColor: '#F5A623', color: '#0D0D0D' }}
              >
                Finalizar
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pb-3">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#555' }}>
              <span>{done} de {total} ejercicios</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#222' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ backgroundColor: '#F5A623', width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="space-y-8 pt-5 pb-16">
        {session.blocks.map((block, bi) => (
          <div key={block.planBlockId}>
            {/* Block header */}
            <p
              className="text-xs font-bold uppercase tracking-wider mb-3 px-1"
              style={{ color: '#F5A623' }}
            >
              {block.name}
            </p>

            <div className="space-y-3">
              {block.exercises.map((ex, ei) => (
                <ExerciseCard
                  key={ex.planExerciseId}
                  exercise={ex}
                  onUpdateSet={(si, u) => updateSet(bi, ei, si, u)}
                  onUpdateNote={(note) => updateNote(bi, ei, note)}
                  onUpdateEffort={(effort) => updateEffort(bi, ei, effort)}
                  onToggleDone={() => toggleExDone(bi, ei)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Finish modal ── */}
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

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#F5A623', borderTopColor: 'transparent' }} />
      </div>
    }>
      <SessionPageInner />
    </Suspense>
  );
}
