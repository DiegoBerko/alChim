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
  startTime: string; // ISO
  endTime?: string;
  exercises: SessionExercise[];
  estimatedKcal?: number;
  notes?: string;
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
