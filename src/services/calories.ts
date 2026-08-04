import type { EffortLevel, SessionExercise } from '../types';

// Per-exercise estimate used during active session (simpler input)
export function estimateKcalForExercise(params: {
  met: number;
  weightKg: number;
  completedSets: number;
  effort: EffortLevel;
  bodyFatPct?: number;
}): number {
  const { met, weightKg, completedSets, effort, bodyFatPct } = params;
  if (completedSets === 0) return 0;
  const compositionFactor = bodyFatPct !== undefined ? 1 + (100 - bodyFatPct) / 1000 : 1;
  const durationHours = (completedSets * 3) / 60;
  return met * weightKg * durationHours * EFFORT_MULTIPLIER[effort] * compositionFactor;
}

// Effort multipliers
const EFFORT_MULTIPLIER: Record<EffortLevel, number> = {
  fácil: 0.8,
  normal: 1.0,
  intenso: 1.2,
  muy_intenso: 1.4,
};

/**
 * Estimates kcal burned for a set of session exercises.
 *
 * Kcal = MET × weightKg × durationHours × effortMultiplier × compositionFactor
 *
 * durationHours = totalSets × ~3 minutes per set / 60
 * compositionFactor = 1 + (leanMassPct / 1000) where leanMassPct = 100 - bodyFatPct
 * If no bodyFatPct, compositionFactor = 1
 */
export function estimateKcal(params: {
  exercises: SessionExercise[];
  weightKg: number;
  bodyFatPct?: number;
  exerciseMets: Record<string, number>; // exerciseId -> met
}): number {
  const { exercises, weightKg, bodyFatPct, exerciseMets } = params;

  const compositionFactor =
    bodyFatPct !== undefined ? 1 + (100 - bodyFatPct) / 1000 : 1;

  let totalKcal = 0;

  for (const sessionEx of exercises) {
    const met = exerciseMets[sessionEx.exerciseId] ?? 4; // fallback MET
    const totalSets = sessionEx.sets.length;
    if (totalSets === 0) continue;

    const durationHours = (totalSets * 3) / 60;

    // Use the exercise-level effort if set, otherwise look at the last set, fallback to 'normal'
    const effortLevel: EffortLevel =
      sessionEx.effort ??
      sessionEx.sets[sessionEx.sets.length - 1]?.effort ??
      'normal';
    const effortMultiplier = EFFORT_MULTIPLIER[effortLevel];

    totalKcal += met * weightKg * durationHours * effortMultiplier * compositionFactor;
  }

  return Math.round(totalKcal);
}
