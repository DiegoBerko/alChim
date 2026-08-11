import { BACKEND_URL as DEFAULT_BACKEND_URL } from '../config/api';
import { storage } from './storage';
import type { PlannedSession, PlannedExercise, PlannedSet, SetMode } from '../types';

// ─── Web types (mirrors web/lib/types.ts) ────────────────────────────────────

interface WebPlanSet {
  setNumber: number;
  targetReps: string;
  targetWeight?: number;
  mode: SetMode;
}

interface WebPlanExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  mode: SetMode;
  sets: WebPlanSet[];
  notes?: string;
  orderIndex: number;
}

interface WebPlanBlock {
  id: string;
  name: string;
  orderIndex: number;
  exercises: WebPlanExercise[];
}

interface WebPlanDay {
  id: string;
  name: string;
  blocks: WebPlanBlock[];
}

interface WebPlan {
  id: string;
  name: string;
  status: 'draft' | 'published';
  createdAt: string;
  publishedAt?: string;
  days?: WebPlanDay[];
  blocks?: WebPlanBlock[]; // legacy flat structure
}

// ─── Conversion ───────────────────────────────────────────────────────────────

function blockExercisesToPlanned(
  blocks: WebPlanBlock[],
): PlannedExercise[] {
  const sorted = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const result: PlannedExercise[] = [];
  for (const block of sorted) {
    const exSorted = [...block.exercises].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    for (const ex of exSorted) {
      const setTargets: PlannedSet[] = ex.sets.map(s => ({
        targetReps: s.targetReps,
        targetWeight: s.targetWeight,
        mode: s.mode ?? ex.mode ?? 'reps',
      }));
      result.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        targetSets: ex.sets.length || 1,
        targetReps: ex.sets[0]?.targetReps ?? '10',
        targetWeight: ex.sets[0]?.targetWeight,
        setTargets: setTargets.length > 0 ? setTargets : undefined,
        bloque: block.name,
        notes: ex.notes,
        mode: ex.mode ?? 'reps',
      });
    }
  }
  return result;
}

function planDayToPlannedSession(
  plan: WebPlan,
  day: WebPlanDay,
  multiDay: boolean,
): PlannedSession {
  const cloudId = `${plan.id}_${day.id}`;
  // When multiDay, the session name is just the day name (e.g. "Día 1").
  // The parent plan name is shown in the group card header.
  // When single day, just use the plan name.
  const name = multiDay ? day.name : plan.name;
  return {
    id: `cloud_${cloudId}`,
    cloudId,
    name,
    createdAt: plan.publishedAt ?? plan.createdAt,
    active: true,
    exercises: blockExercisesToPlanned(day.blocks),
    planGroupId: multiDay ? plan.id : undefined,
    planGroupName: multiDay ? plan.name : undefined,
  };
}

function normalisePlanDays(plan: WebPlan): WebPlanDay[] {
  if (plan.days && plan.days.length > 0) return plan.days;
  // Legacy flat-blocks plan → treat as single day
  return [
    {
      id: plan.id,
      name: 'Día 1',
      blocks: plan.blocks ?? [],
    },
  ];
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  added: number;
  updated: number;
  skipped: number;
  studentName?: string;
  error?: string;
}

export async function syncPlansFromCloud(
  linkCode: string,
  backendUrl?: string,
): Promise<SyncResult> {
  const base = (backendUrl?.trim().replace(/\/$/, '') || DEFAULT_BACKEND_URL);
  let data: { student: { name: string; surname: string }; plans: WebPlan[] };

  try {
    const res = await fetch(
      `${base}/api/student/plans?code=${encodeURIComponent(
        linkCode.trim().toUpperCase(),
      )}`,
    );
    if (res.status === 404) {
      return { added: 0, updated: 0, skipped: 0, error: 'Código no encontrado.' };
    }
    if (!res.ok) {
      return { added: 0, updated: 0, skipped: 0, error: `Error del servidor (${res.status}).` };
    }
    data = await res.json();
  } catch {
    return { added: 0, updated: 0, skipped: 0, error: 'Sin conexión. Revisá internet.' };
  }

  const existing = await storage.getPlannedSessions();
  const existingByCloudId = new Map(
    existing.filter(s => s.cloudId).map(s => [s.cloudId!, s]),
  );

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const plan of data.plans) {
    const days = normalisePlanDays(plan);
    const multiDay = days.length > 1;

    for (const day of days) {
      const session = planDayToPlannedSession(plan, day, multiDay);
      const prev = existingByCloudId.get(session.cloudId!);

      if (!prev) {
        await storage.savePlannedSession(session);
        added++;
      } else {
        // Update name/exercises in case the plan was republished with changes,
        // but preserve lastUsed and active state
        const updated_session: PlannedSession = {
          ...session,
          id: prev.id,
          active: prev.active,
          lastUsed: prev.lastUsed,
        };
        await storage.savePlannedSession(updated_session);
        updated++;
      }
    }
  }

  skipped = existing.filter(s => s.cloudId && !data.plans.some(p =>
    normalisePlanDays(p).some(d => `${p.id}_${d.id}` === s.cloudId)
  )).length;

  return {
    added,
    updated,
    skipped,
    studentName: data.student
      ? `${data.student.name} ${data.student.surname}`.trim()
      : undefined,
  };
}
