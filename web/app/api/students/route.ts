import { NextRequest, NextResponse } from 'next/server';
import { createStudent, getStudents } from '@/lib/firestore';

export async function GET() {
  try {
    const students = await getStudents();
    return NextResponse.json(students);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching students' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const student = await createStudent(data);
    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error creating student' }, { status: 500 });
  }
}
