import { getStudentByLinkCode, getPlans } from '@/lib/firestore';

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

  const plans = await getPlans(student.id);
  const published = plans.filter((p) => p.status === 'published');

  return Response.json({
    student: { name: student.name, surname: student.surname },
    plans: published,
  });
}
