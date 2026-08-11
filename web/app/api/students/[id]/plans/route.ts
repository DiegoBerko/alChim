import { NextRequest, NextResponse } from 'next/server';
import { getPlans, createPlan, createPlanFromExisting } from '@/lib/firestore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const plans = await getPlans(id);
    return NextResponse.json(plans);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error fetching plans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, basedOnPlanId } = await req.json();
    let plan;
    if (basedOnPlanId) {
      plan = await createPlanFromExisting(id, name, basedOnPlanId);
    } else {
      plan = await createPlan(id, name);
    }
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error creating plan' }, { status: 500 });
  }
}
