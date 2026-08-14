import { getFeedback, markFeedbackRead } from '@/lib/firestore';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const feedback = await getFeedback(params.id);
  return Response.json({ feedback });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: { feedbackId: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.feedbackId) return Response.json({ error: 'Missing feedbackId' }, { status: 400 });

  await markFeedbackRead(params.id, body.feedbackId);
  return Response.json({ ok: true });
}
