export type EffortLevel = 'fácil' | 'normal' | 'intenso' | 'muy_intenso';
export type ExerciseCategory = 'fuerza' | 'cardio' | 'peso_corporal';

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
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  sets: ExerciseSet[];
  feedback?: string;
  effort?: EffortLevel;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // ISO — undefined if status='planned'
  endTime?: string;
  exercises: SessionExercise[];
  estimatedKcal?: number;
  notes?: string;
  status: 'planned' | 'completed';
}

export interface PlannedExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;        // e.g. 3
  targetReps: string;        // e.g. "12/10/8", "3x10", "30''"
  notes?: string;            // e.g. "usar 7kg", "elastico potente"
}

export interface PlannedSession {
  id: string;
  name?: string;             // optional label, e.g. "Día 1 - Lunes"
  createdAt: string;         // ISO
  exercises: PlannedExercise[];
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
}
