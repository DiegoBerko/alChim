import { NextRequest, NextResponse } from 'next/server';
import { regenerateLinkCode } from '@/lib/firestore';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const newCode = await regenerateLinkCode(id);
    return NextResponse.json({ linkCode: newCode });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error regenerating code' }, { status: 500 });
  }
}
