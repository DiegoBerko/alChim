'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, PlanDay, GymSession } from '@/lib/types';
import { getPortalCode, getActiveSession } from '@/lib/student-session';

interface StudentInfo {
  name: string;
  surname: string;
}

function normalizePlanDays(plan: Plan): PlanDay[] {
  if (plan.days && plan.days.length > 0) {
    return plan.days;
  }
  // Wrap blocks into a single synthetic day
  return [
    {
      id: '__single__',
      name: 'Día 1',
      blocks: plan.blocks,
    },
  ];
}

function calcStreak(sessions: GymSession[]): number {
  if (sessions.length === 0) return 0;
  const uniqueDates = Array.from(new Set(sessions.map((s) => s.startedAt.slice(0, 10)))).sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]).getTime();
    const curr = new Date(uniqueDates[i]).getTime();
    if (Math.round((prev - curr) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ReturnType<typeof getActiveSession>>(null);
  const [sessionStats, setSessionStats] = useState<{ total: number; streak: number } | null>(null);

  useEffect(() => {
    const code = getPortalCode();
    if (!code) {
      router.replace('/portal');
      return;
    }

    const saved = getActiveSession();
    setActiveSession(saved);

    const plansPromise = fetch(`/api/student/plans?code=${code}`)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data) => {
        setStudent(data.student);
        setPlans(data.plans);
        if (data.plans.length > 0) setExpandedPlanId(data.plans[0].id);
      });

    const sessionsPromise = fetch(`/api/student/sessions?code=${code}`)
      .then((r) => r.json())
      .then((data: { sessions: GymSession[] }) => {
        const sessions = data.sessions ?? [];
        setSessionStats({ total: sessions.length, streak: calcStreak(sessions) });
      })
      .catch(() => {/* stats are optional */});

    Promise.all([plansPromise, sessionsPromise])
      .catch(() => setError('No se pudo cargar los planes. Intentá de nuevo.'))
      .finally(() => setLoading(false));
  }, [router]);

  function handleDaySelect(plan: Plan, day: PlanDay) {
    const params = new URLSearchParams({
      planId: plan.id,
      dayId: day.id,
      planName: plan.name,
      dayName: day.name,
    });
    router.push(`/portal/session?${params.toString()}`);
  }

  function handlePreview(plan: Plan, day: PlanDay) {
    const params = new URLSearchParams({
      planId: plan.id,
      dayId: day.id,
      planName: plan.name,
      dayName: day.name,
      preview: 'true',
    });
    router.push(`/portal/session?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: '#242424', width: '60%' }} />
        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: '#242424', width: '40%' }} />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl animate-pulse"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: '#242424', color: '#f5f5f5' }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {student && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#f5f5f5' }}>
              Hola, {student.name}!
            </h1>
            <p className="text-sm mt-1" style={{ color: '#888' }}>
              Elegí un plan y día para entrenar
            </p>
          </div>
          {sessionStats && sessionStats.total > 0 && (
            <div className="flex items-center gap-3 shrink-0 pt-1">
              {sessionStats.streak > 0 && (
                <div className="text-right">
                  <p className="text-lg font-bold leading-none" style={{ color: '#F5A623' }}>
                    {sessionStats.streak} 🔥
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                    {sessionStats.streak === 1 ? 'día' : 'días'}
                  </p>
                </div>
              )}
              <div className="text-right">
                <p className="text-lg font-bold leading-none" style={{ color: '#f5f5f5' }}>
                  {sessionStats.total}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {sessionStats.total === 1 ? 'sesión' : 'sesiones'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSession && (
        <div
          className="rounded-xl p-4 flex items-center justify-between"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #F5A623' }}
        >
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: '#F5A623' }}>
              Sesión en curso
            </p>
            <p className="text-sm font-semibold" style={{ color: '#f5f5f5' }}>
              {activeSession.dayName}
            </p>
            <p className="text-xs" style={{ color: '#888' }}>
              {activeSession.planName}
            </p>
          </div>
          <button
            onClick={() => {
              const params = new URLSearchParams({
                planId: activeSession.planId,
                dayId: activeSession.dayId,
                planName: activeSession.planName,
                dayName: activeSession.dayName,
              });
              router.push(`/portal/session?${params.toString()}`);
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#F5A623', color: '#0D0D0D' }}
          >
            Retomar
          </button>
        </div>
      )}

      {plans.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p style={{ color: '#888' }}>
            No tenés planes publicados todavía. Consultá con tu entrenador.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isExpanded = expandedPlanId === plan.id;
            const days = normalizePlanDays(plan);

            return (
              <div
                key={plan.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              >
                <button
                  className="w-full px-4 py-4 flex items-center justify-between text-left transition-colors"
                  style={{
                    backgroundColor: isExpanded ? '#242424' : '#1a1a1a',
                  }}
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                >
                  <div>
                    <span className="font-semibold" style={{ color: '#f5f5f5' }}>
                      {plan.name}
                    </span>
                    <span className="ml-2 text-xs" style={{ color: '#888' }}>
                      {days.length} {days.length === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                  <svg
                    className="transition-transform"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      color: '#888',
                    }}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div
                    className="px-3 pb-3 space-y-2"
                    style={{ borderTop: '1px solid #2a2a2a' }}
                  >
                    {days.map((day) => (
                      <div
                        key={day.id}
                        className="w-full px-4 py-3 rounded-lg flex items-center justify-between mt-2"
                        style={{ backgroundColor: '#0D0D0D', border: '1px solid #2a2a2a' }}
                      >
                        <div>
                          <span className="font-medium text-sm" style={{ color: '#f5f5f5' }}>
                            {day.name}
                          </span>
                          <span className="block text-xs mt-0.5" style={{ color: '#888' }}>
                            {day.blocks.reduce((acc, b) => acc + b.exercises.length, 0)} ejercicios
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePreview(plan, day)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: '#242424', color: '#888', border: '1px solid #333' }}
                          >
                            Ver plan
                          </button>
                          <button
                            onClick={() => handleDaySelect(plan, day)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ backgroundColor: '#F5A623', color: '#0D0D0D' }}
                          >
                            Empezar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
