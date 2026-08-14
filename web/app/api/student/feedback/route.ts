import { getStudentByLinkCode, getFeedback, addFeedback, markFeedbackRead } from '@/lib/firestore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return Response.json({ error: 'No code' }, { status: 400 });

  const student = await getStudentByLinkCode(code.toUpperCase());
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const feedback = await getFeedback(student.id);
  return Response.json({ feedback });
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return Response.json({ error: 'No code' }, { status: 400 });

  const student = await getStudentByLinkCode(code.toUpperCase());
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  let body: { content: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.content?.trim()) return Response.json({ error: 'Empty content' }, { status: 400 });

  const item = await addFeedback(student.id, body.content.trim());
  return Response.json({ item }, { status: 201 });
}

export async function PATCH(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return Response.json({ error: 'No code' }, { status: 400 });

  const student = await getStudentByLinkCode(code.toUpperCase());
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  let body: { feedbackId: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.feedbackId) return Response.json({ error: 'Missing feedbackId' }, { status: 400 });

  await markFeedbackRead(student.id, body.feedbackId);
  return Response.json({ ok: true });
}
