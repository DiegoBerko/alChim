import { NextRequest, NextResponse } from 'next/server';
import { getNotes, addNote, deleteNote } from '@/lib/firestore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const notes = await getNotes(id);
    return NextResponse.json(notes);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching notes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { content } = await req.json();
    const note = await addNote(id, content);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error adding note' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { noteId } = await req.json();
    await deleteNote(id, noteId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error deleting note' }, { status: 500 });
  }
}
