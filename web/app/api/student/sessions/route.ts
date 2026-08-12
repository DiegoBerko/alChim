import { getStudentByLinkCode, getGymSessions, saveGymSession, updateGymSession } from '@/lib/firestore';
import type { GymSession } from '@/lib/types';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return Response.json({ error: 'No code provided' }, { status: 400 });
  }

  const student = await getStudentByLinkCode(code.toUpperCase());
  if (!student) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }

  const sessions = await getGymSessions(student.id);
  return Response.json({ sessions });
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return Response.json({ error: 'No code provided' }, { status: 400 });
  }

  const student = await getStudentByLinkCode(code.toUpperCase());
  if (!student) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }

  let body: Omit<GymSession, 'id' | 'studentId'>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.planId || !body.dayId || !body.startedAt || !body.finishedAt) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const session = await saveGymSession(student.id, body);
  return Response.json({ session }, { status: 201 });
}

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return Response.json({ error: 'No code provided' }, { status: 400 });

  const student = await getStudentByLinkCode(code.toUpperCase());
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  let body: { sessionId: string } & Partial<Omit<GymSession, 'id' | 'studentId'>>;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionId, ...data } = body;
  if (!sessionId) return Response.json({ error: 'Missing sessionId' }, { status: 400 });

  await updateGymSession(student.id, sessionId, data);
  return Response.json({ ok: true });
}
