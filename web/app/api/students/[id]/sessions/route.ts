import { NextRequest, NextResponse } from 'next/server';
import { getGymSessions } from '@/lib/firestore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sessions = await getGymSessions(id);
    return NextResponse.json(sessions);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching sessions' }, { status: 500 });
  }
}
