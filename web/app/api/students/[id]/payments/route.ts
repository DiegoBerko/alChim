import { NextRequest, NextResponse } from 'next/server';
import { getPayments, togglePayment, updatePaymentNote } from '@/lib/firestore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  try {
    const payments = await getPayments(id, year);
    return NextResponse.json(payments);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching payments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { year, month } = await req.json();
    const payment = await togglePayment(id, year, month);
    return NextResponse.json(payment);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error toggling payment' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { year, month, note } = await req.json();
    await updatePaymentNote(id, year, month, note ?? '');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error updating payment note' }, { status: 500 });
  }
}
