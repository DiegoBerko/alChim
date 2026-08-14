import { db } from './firebase';
import type { Student, StudentNote, StudentAspect, Payment, Exercise, Plan, PlanDay, PlanBlock, GymSession, StudentFeedback } from './types';

// ─── Link Code Generation ───────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, I, 1

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db
      .collection('students')
      .where('linkCode', '==', code)
      .limit(1)
      .get();
    if (existing.empty) return code;
    code = generateCode();
    attempts++;
  }
  throw new Error('Could not generate unique link code');
}

// ─── Students ────────────────────────────────────────────────────────────────

export async function getStudents(): Promise<Student[]> {
  const snap = await db.collection('students').orderBy('createdAt', 'desc').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Student));
}

export async function getStudent(id: string): Promise<Student | null> {
  const doc = await db.collection('students').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Student;
}

export async function createStudent(
  data: Omit<Student, 'id' | 'createdAt' | 'linkCode'>
): Promise<Student> {
  const linkCode = await generateUniqueCode();
  const now = new Date().toISOString();
  const payload = { ...data, linkCode, createdAt: now };
  const ref = await db.collection('students').add(payload);
  return { id: ref.id, ...payload };
}

export async function updateStudent(id: string, data: Partial<Student>): Promise<void> {
  await db.collection('students').doc(id).update(data);
}

export async function deleteStudent(id: string): Promise<void> {
  // Delete all sub-collections first
  const batch = db.batch();

  const notes = await db.collection('students').doc(id).collection('notes').get();
  notes.docs.forEach((d) => batch.delete(d.ref));

  const aspects = await db.collection('students').doc(id).collection('aspects').get();
  aspects.docs.forEach((d) => batch.delete(d.ref));

  const payments = await db.collection('students').doc(id).collection('payments').get();
  payments.docs.forEach((d) => batch.delete(d.ref));

  const plans = await db.collection('students').doc(id).collection('plans').get();
  plans.docs.forEach((d) => batch.delete(d.ref));

  batch.delete(db.collection('students').doc(id));
  await batch.commit();
}

export async function regenerateLinkCode(studentId: string): Promise<string> {
  const newCode = await generateUniqueCode();
  await db.collection('students').doc(studentId).update({ linkCode: newCode });
  return newCode;
}

export async function getStudentByLinkCode(code: string): Promise<Student | null> {
  const snap = await db
    .collection('students')
    .where('linkCode', '==', code.toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Student;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function getNotes(studentId: string): Promise<StudentNote[]> {
  const snap = await db
    .collection('students')
    .doc(studentId)
    .collection('notes')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StudentNote));
}

export async function addNote(studentId: string, content: string): Promise<StudentNote> {
  const now = new Date().toISOString();
  const payload = { studentId, content, createdAt: now };
  const ref = await db.collection('students').doc(studentId).collection('notes').add(payload);
  return { id: ref.id, ...payload };
}

export async function deleteNote(studentId: string, noteId: string): Promise<void> {
  await db.collection('students').doc(studentId).collection('notes').doc(noteId).delete();
}

// ─── Aspects ─────────────────────────────────────────────────────────────────

export async function getAspects(studentId: string): Promise<StudentAspect[]> {
  const snap = await db
    .collection('students')
    .doc(studentId)
    .collection('aspects')
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StudentAspect));
}

export async function addAspect(studentId: string, content: string): Promise<StudentAspect> {
  const payload = { studentId, content };
  const ref = await db.collection('students').doc(studentId).collection('aspects').add(payload);
  return { id: ref.id, ...payload };
}

export async function deleteAspect(studentId: string, aspectId: string): Promise<void> {
  await db.collection('students').doc(studentId).collection('aspects').doc(aspectId).delete();
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function getPayments(studentId: string, year: number): Promise<Payment[]> {
  const snap = await db
    .collection('students')
    .doc(studentId)
    .collection('payments')
    .where('year', '==', year)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Payment));
}

export async function togglePayment(
  studentId: string,
  year: number,
  month: number
): Promise<Payment> {
  const docId = `${year}-${String(month).padStart(2, '0')}`;
  const ref = db.collection('students').doc(studentId).collection('payments').doc(docId);
  const doc = await ref.get();

  if (doc.exists) {
    const current = doc.data() as Omit<Payment, 'id'>;
    const newPaid = !current.paid;
    const updated: Record<string, unknown> = { ...current, paid: newPaid };
    if (newPaid) {
      updated.paidAt = new Date().toISOString();
    } else {
      delete updated.paidAt; // never pass undefined to Firestore
    }
    await ref.set(updated);
    return { id: docId, ...(updated as Omit<Payment, 'id'>) };
  } else {
    const newPayment: Omit<Payment, 'id'> = {
      studentId,
      year,
      month,
      paid: true,
      paidAt: new Date().toISOString(),
    };
    await ref.set(newPayment);
    return { id: docId, ...newPayment };
  }
}

export async function updatePaymentNote(
  studentId: string,
  year: number,
  month: number,
  note: string
): Promise<void> {
  const docId = `${year}-${String(month).padStart(2, '0')}`;
  const ref = db.collection('students').doc(studentId).collection('payments').doc(docId);
  const doc = await ref.get();
  if (doc.exists) {
    await ref.update({ note });
  } else {
    // Create the doc with note so it persists
    const newPayment = { studentId, year, month, paid: false, note };
    await ref.set(newPayment);
  }
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  const snap = await db.collection('exercises').orderBy('name').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Exercise));
}

export async function createExercise(data: Omit<Exercise, 'id'>): Promise<Exercise> {
  const ref = await db.collection('exercises').add(data);
  return { id: ref.id, ...data };
}

export async function deleteExercise(id: string): Promise<void> {
  await db.collection('exercises').doc(id).delete();
}

export async function updateExercise(id: string, data: Partial<Omit<Exercise, 'id'>>): Promise<void> {
  await db.collection('exercises').doc(id).update(data as FirebaseFirestore.UpdateData<Record<string, unknown>>);
}

export async function seedDefaultExercises(): Promise<void> {
  const snap = await db.collection('exercises').limit(1).get();
  if (!snap.empty) return;

  const defaults: Omit<Exercise, 'id'>[] = [
    { name: 'Sentadilla', category: 'fuerza', muscleGroups: ['cuádriceps', 'glúteos', 'isquiotibiales'], met: 5 },
    { name: 'Press de banca', category: 'fuerza', muscleGroups: ['pecho', 'tríceps', 'hombros'], met: 5 },
    { name: 'Peso muerto', category: 'fuerza', muscleGroups: ['espalda baja', 'glúteos', 'isquiotibiales'], met: 6 },
    { name: 'Dominadas', category: 'peso_corporal', muscleGroups: ['espalda', 'bíceps'], met: 8 },
    { name: 'Fondos en paralelas', category: 'peso_corporal', muscleGroups: ['pecho', 'tríceps'], met: 7 },
    { name: 'Plancha', category: 'peso_corporal', muscleGroups: ['core', 'abdominales'], met: 3 },
    { name: 'Remo con barra', category: 'fuerza', muscleGroups: ['espalda', 'bíceps'], met: 5 },
    { name: 'Cinta caminadora', category: 'cardio', muscleGroups: ['piernas'], met: 7 },
    { name: 'Bicicleta estática', category: 'cardio', muscleGroups: ['piernas'], met: 6 },
    { name: 'Press militar', category: 'fuerza', muscleGroups: ['hombros', 'tríceps'], met: 5 },
  ];

  const batch = db.batch();
  for (const ex of defaults) {
    const ref = db.collection('exercises').doc();
    batch.set(ref, ex);
  }
  await batch.commit();
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function getPlans(studentId: string): Promise<Plan[]> {
  const snap = await db
    .collection('students')
    .doc(studentId)
    .collection('plans')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Plan));
}

export async function getPlan(studentId: string, planId: string): Promise<Plan | null> {
  const doc = await db
    .collection('students')
    .doc(studentId)
    .collection('plans')
    .doc(planId)
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Plan;
}

export async function createPlan(studentId: string, name: string): Promise<Plan> {
  const now = new Date().toISOString();
  const newPlan: Omit<Plan, 'id'> = {
    studentId,
    name,
    status: 'draft',
    createdAt: now,
    blocks: [
      { id: crypto.randomUUID(), name: 'Entrada en calor', orderIndex: 0, exercises: [] },
      { id: crypto.randomUUID(), name: 'Bloque Principal', orderIndex: 1, exercises: [] },
      { id: crypto.randomUUID(), name: 'Bloque Accesorio', orderIndex: 2, exercises: [] },
    ],
  };
  const ref = await db.collection('students').doc(studentId).collection('plans').add(newPlan);
  return { id: ref.id, ...newPlan };
}

export async function updatePlan(
  studentId: string,
  planId: string,
  data: Partial<Plan>
): Promise<void> {
  await db.collection('students').doc(studentId).collection('plans').doc(planId).update(data);
}

export async function deletePlan(studentId: string, planId: string): Promise<void> {
  await db.collection('students').doc(studentId).collection('plans').doc(planId).delete();
}

export async function publishPlan(studentId: string, planId: string): Promise<void> {
  await db
    .collection('students')
    .doc(studentId)
    .collection('plans')
    .doc(planId)
    .update({ status: 'published', publishedAt: new Date().toISOString() });
}

// ─── Gym Sessions ─────────────────────────────────────────────────────────────

export async function saveGymSession(
  studentId: string,
  data: Omit<GymSession, 'id' | 'studentId'>
): Promise<GymSession> {
  const payload = { ...data, studentId };
  const ref = await db
    .collection('students')
    .doc(studentId)
    .collection('gymSessions')
    .add(payload);
  return { id: ref.id, ...payload };
}

export async function getGymSessions(studentId: string): Promise<GymSession[]> {
  const snap = await db
    .collection('students')
    .doc(studentId)
    .collection('gymSessions')
    .orderBy('startedAt', 'desc')
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as GymSession));
}

// ─── Feedback / Consultas ─────────────────────────────────────────────────────

export async function getFeedback(studentId: string): Promise<StudentFeedback[]> {
  const snap = await db
    .collection('students')
    .doc(studentId)
    .collection('feedback')
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StudentFeedback));
}

export async function addFeedback(studentId: string, content: string): Promise<StudentFeedback> {
  const payload = { studentId, content, createdAt: new Date().toISOString(), read: false };
  const ref = await db.collection('students').doc(studentId).collection('feedback').add(payload);
  return { id: ref.id, ...payload };
}

export async function markFeedbackRead(studentId: string, feedbackId: string): Promise<void> {
  await db
    .collection('students')
    .doc(studentId)
    .collection('feedback')
    .doc(feedbackId)
    .update({ read: true });
}

export async function updateGymSession(
  studentId: string,
  sessionId: string,
  data: Partial<Omit<GymSession, 'id' | 'studentId'>>
): Promise<void> {
  await db
    .collection('students')
    .doc(studentId)
    .collection('gymSessions')
    .doc(sessionId)
    .update(data as FirebaseFirestore.UpdateData<Record<string, unknown>>);
}

export async function createPlanFromExisting(
  studentId: string,
  name: string,
  sourcePlanId: string
): Promise<Plan> {
  const sourceDoc = await db
    .collection('students')
    .doc(studentId)
    .collection('plans')
    .doc(sourcePlanId)
    .get();

  if (!sourceDoc.exists) {
    throw new Error('Source plan not found');
  }

  const source = { id: sourceDoc.id, ...sourceDoc.data() } as Plan;
  const now = new Date().toISOString();

  // Deep-clone days or blocks, generating new IDs
  let clonedDays: PlanDay[] | undefined;
  let clonedBlocks: PlanBlock[];

  if (source.days && source.days.length > 0) {
    clonedDays = source.days.map((day) => ({
      ...day,
      id: crypto.randomUUID(),
      blocks: day.blocks.map((block) => ({
        ...block,
        id: crypto.randomUUID(),
        exercises: block.exercises.map((ex) => ({
          ...ex,
          id: crypto.randomUUID(),
          sets: ex.sets.map((s) => ({ ...s })),
        })),
      })),
    }));
    clonedBlocks = [];
  } else {
    clonedBlocks = source.blocks.map((block) => ({
      ...block,
      id: crypto.randomUUID(),
      exercises: block.exercises.map((ex) => ({
        ...ex,
        id: crypto.randomUUID(),
        sets: ex.sets.map((s) => ({ ...s })),
      })),
    }));
  }

  const newPlan: Omit<Plan, 'id'> = {
    studentId,
    name,
    status: 'draft',
    createdAt: now,
    blocks: clonedBlocks,
    basedOnPlanId: sourcePlanId,
    ...(clonedDays ? { days: clonedDays } : {}),
  };

  const ref = await db.collection('students').doc(studentId).collection('plans').add(newPlan);
  return { id: ref.id, ...newPlan };
}
