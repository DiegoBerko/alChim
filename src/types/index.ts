export type EffortLevel = 'fácil' | 'normal' | 'intenso' | 'muy_intenso';
export type ExerciseCategory = 'fuerza' | 'cardio' | 'peso_corporal';
export type SetMode = 'reps' | 'seconds';

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  category: ExerciseCategory;
  met: number;
}

export interface ExerciseSet {
  setNumber: number;
  reps: number;
  weight?: number; // kg
  feedback?: string;
  effort?: EffortLevel;
  mode?: SetMode;    // defaults to 'reps'
  seconds?: number;  // valor cuando mode === 'seconds'
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  sets: ExerciseSet[];
  feedback?: string;
  effort?: EffortLevel;
  completionOrder?: number; // 0-based index in which this exercise was marked done
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // ISO
  endTime?: string;
  exercises: SessionExercise[];
  estimatedKcal?: number;
  notes?: string;
  status: 'planned' | 'completed';
  plannedSessionId?: string; // ID of the PlannedSession this was started from
}

// Per-set target (reps + optional weight)
export interface PlannedSet {
  targetReps: string;    // "10", "30''", "10 c/lado"
  targetWeight?: number; // kg
  mode?: SetMode;        // defaults to 'reps'
}

export interface PlannedExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;        // fallback when no setTargets
  targetReps: string;        // fallback when no setTargets
  targetWeight?: number;     // fallback weight for all sets
  setTargets?: PlannedSet[]; // per-set reps + weight (overrides targetSets/targetReps)
  bloque?: string;           // "Entrada en calor" | "Bloque Principal" | "Bloque Accesorio"
  notes?: string;
  mode?: SetMode;            // default mode del ejercicio
}

export interface PlannedSession {
  id: string;
  name?: string;
  createdAt: string; // ISO
  exercises: PlannedExercise[];
  active?: boolean;   // true (default) = shown in Inicio; false = archived
  lastUsed?: string;  // ISO — when last started as a session
  cloudId?: string;      // "${planId}_${dayId}" — set when synced from backend, used for dedup
  planGroupId?: string;  // cloud plan ID — all days of the same plan share this
  planGroupName?: string; // display name of the parent plan (e.g. "Rutina Agosto")
}

export interface SessionTemplate {
  id: string;
  name: string;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetReps: string;
    targetWeight?: number;
    setTargets?: PlannedSet[];
    bloque?: string;
    mode?: SetMode;
  }[];
}

export interface UserProfile {
  name?: string;
  age: number;
  gender: 'Masculino' | 'Femenino';
  height: number; // cm
  weight: number; // kg
  bodyFatPct?: number; // %
  groqKey?: string;
  linkCode?: string;    // código de acceso para sincronizar planes del backoffice
  backendUrl?: string;  // URL del backoffice (ej: https://alchim.vercel.app)
}
