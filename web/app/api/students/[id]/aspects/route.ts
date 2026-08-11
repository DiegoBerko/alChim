import { NextRequest, NextResponse } from 'next/server';
import { getAspects, addAspect, deleteAspect } from '@/lib/firestore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const aspects = await getAspects(id);
    return NextResponse.json(aspects);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching aspects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { content } = await req.json();
    const aspect = await addAspect(id, content);
    return NextResponse.json(aspect, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error adding aspect' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { aspectId } = await req.json();
    await deleteAspect(id, aspectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error deleting aspect' }, { status: 500 });
  }
}
