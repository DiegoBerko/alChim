export type SetMode = 'reps' | 'seconds';

export interface Student {
  id: string;
  name: string;
  surname: string;
  apodo?: string;
  phone?: string;
  weight?: number;
  gender?: string;
  extraData?: Record<string, string>;
  linkCode: string;
  createdAt: string;
}

export interface StudentNote {
  id: string;
  studentId: string;
  content: string;
  createdAt: string;
}

export interface StudentAspect {
  id: string;
  studentId: string;
  content: string;
}

export interface Payment {
  id: string; // format: "2025-03"
  studentId: string;
  year: number;
  month: number; // 1-12
  paid: boolean;
  paidAt?: string;
  amount?: number;
  note?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: 'fuerza' | 'cardio' | 'peso_corporal';
  muscleGroups: string[];
  met: number;
}

export interface PlanSet {
  setNumber: number;
  targetReps: string;
  targetWeight?: number;
  mode: SetMode;
}

export interface PlanExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  notes?: string;
  mode: SetMode;
  sets: PlanSet[];
}

export interface PlanBlock {
  id: string;
  name: string;
  orderIndex: number;
  exercises: PlanExercise[];
}

export interface PlanDay {
  id: string;
  name: string;
  blocks: PlanBlock[];
}

export interface Plan {
  id: string;
  studentId: string;
  name: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt: string;
  blocks: PlanBlock[];
  days?: PlanDay[];
  basedOnPlanId?: string;
}

// ─── Student Portal / Session types ──────────────────────────────────────────

export type EffortLevel = 'facil' | 'normal' | 'intenso' | 'muy_intenso';

export interface SessionSet {
  setNumber: number;
  targetReps: string;
  targetWeight?: number;
  mode: SetMode;
  actualReps: string;
  actualWeight?: number;
  done: boolean;
  effort?: EffortLevel;
}

export interface SessionExercise {
  planExerciseId: string;
  exerciseName: string;
  orderIndex: number;
  mode: SetMode;
  notes?: string;
  sets: SessionSet[];
  studentNote: string;
}

export interface SessionBlock {
  planBlockId: string;
  name: string;
  orderIndex: number;
  exercises: SessionExercise[];
}

export interface GymSession {
  id: string;
  studentId: string;
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  durationSeconds: number;
  blocks: SessionBlock[];
  generalNote: string;
}
