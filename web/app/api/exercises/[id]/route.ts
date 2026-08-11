import { NextRequest, NextResponse } from 'next/server';
import { deleteExercise } from '@/lib/firestore';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteExercise(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error deleting exercise' }, { status: 500 });
  }
}
