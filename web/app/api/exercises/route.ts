import { NextRequest, NextResponse } from 'next/server';
import { getExercises, createExercise, seedDefaultExercises } from '@/lib/firestore';

export async function GET() {
  try {
    await seedDefaultExercises();
    const exercises = await getExercises();
    return NextResponse.json(exercises);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching exercises' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const exercise = await createExercise(data);
    return NextResponse.json(exercise, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error creating exercise' }, { status: 500 });
  }
}
