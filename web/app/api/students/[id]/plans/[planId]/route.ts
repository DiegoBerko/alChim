import { NextRequest, NextResponse } from 'next/server';
import { getPlan, updatePlan, deletePlan, publishPlan } from '@/lib/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const { id, planId } = await params;
  try {
    const plan = await getPlan(id, planId);
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching plan' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const { id, planId } = await params;
  try {
    const data = await req.json();
    await updatePlan(id, planId, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error updating plan' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const { id, planId } = await params;
  try {
    await deletePlan(id, planId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error deleting plan' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const { id, planId } = await params;
  try {
    const { action } = await req.json();
    if (action === 'publish') {
      await publishPlan(id, planId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
