'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, PlanDay, GymSession, PlanExercise } from '@/lib/types';
import { getPortalCode, getActiveSession, getGoalDays, setGoalDays } from '@/lib/student-session';

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const embedUrl = driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
          <span className="font-semibold text-sm truncate pr-4" style={{ color: '#f5f5f5' }}>{name}</span>
          <button onClick={onClose} className="shrink-0 text-lg" style={{ color: '#888' }}>✕</button>
        </div>
        {embedUrl ? (
          <iframe src={embedUrl} className="w-full" style={{ aspectRatio: '16/9' }} allow="autoplay" allowFullScreen />
        ) : (
          <div className="p-6 text-center">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium" style={{ color: '#F5A623' }}>
              Abrir video →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Exercise Video Button ────────────────────────────────────────────────────

function ExerciseVideoButton({ exercise }: { exercise: PlanExercise }) {
  const [showVideo, setShowVideo] = useState(false);
  if (!exercise.videoUrl) return null;
  return (
    <>
      <button
        onClick={() => setShowVideo(true)}
        className="shrink-0 text-xs px-2 py-1 rounded-md"
        style={{ backgroundColor: '#242424', color: '#F5A623', border: '1px solid #333' }}
        title="Ver video"
      >
        ▶
      </button>
      {showVideo && (
        <VideoModal url={exercise.videoUrl!} name={exercise.exerciseName} onClose={() => setShowVideo(false)} />
      )}
    </>
  );
}

interface StudentInfo {
  name: string;
  surname: string;
}

function normalizePlanDays(plan: Plan): PlanDay[] {
  if (plan.days && plan.days.length > 0) {
    return plan.days;
  }
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

function calcWeeklyCount(sessions: GymSession[]): number {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const uniqueDates = new Set(
    sessions
      .filter((s) => s.startedAt.slice(0, 10) >= sevenDaysAgo)
      .map((s) => s.startedAt.slice(0, 10))
  );
  return uniqueDates.size;
}

function GoalPicker({ goal, onChange, onClose }: { goal: number; onChange: (n: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: '#f5f5f5' }}>Meta semanal</h3>
          <button onClick={onClose} style={{ color: '#888' }}>✕</button>
        </div>
        <p className="text-xs" style={{ color: '#888' }}>¿Cuántos días por semana querés entrenar?</p>
        <div className="flex gap-2 justify-between">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => { onChange(n); onClose(); }}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
              style={{
                backgroundColor: n === goal ? '#F5A623' : '#242424',
                color: n === goal ? '#0D0D0D' : '#f5f5f5',
                border: n === goal ? 'none' : '1px solid #333',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ReturnType<typeof getActiveSession>>(null);
  const [sessionStats, setSessionStats] = useState<{ total: number; streak: number; weeklyCount: number } | null>(null);
  const [goal, setGoal] = useState(3);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  useEffect(() => {
    setGoal(getGoalDays());
  }, []);

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
        setSessionStats({
          total: sessions.length,
          streak: calcStreak(sessions),
          weeklyCount: calcWeeklyCount(sessions),
        });
      })
      .catch(() => {/* stats are optional */});

    Promise.all([plansPromise, sessionsPromise])
      .catch(() => setError('No se pudo cargar los planes. Intentá de nuevo.'))
      .finally(() => setLoading(false));
  }, [router]);

  function handleGoalChange(n: number) {
    setGoal(n);
    setGoalDays(n);
  }

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

  const weekMet = sessionStats ? sessionStats.weeklyCount >= goal : false;

  return (
    <div className="space-y-6">
      {showGoalPicker && (
        <GoalPicker goal={goal} onChange={handleGoalChange} onClose={() => setShowGoalPicker(false)} />
      )}

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
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {/* Weekly goal badge */}
            {sessionStats !== null && (
              <button
                onClick={() => setShowGoalPicker(true)}
                className="text-right"
                title="Cambiar meta semanal"
              >
                <p
                  className="text-lg font-bold leading-none"
                  style={{ color: weekMet ? '#22c55e' : '#F5A623' }}
                >
                  {sessionStats.weeklyCount}/{goal} {weekMet ? '✓' : ''}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  esta semana
                </p>
              </button>
            )}

            {/* Daily streak */}
            {sessionStats && sessionStats.streak > 0 && (
              <div className="text-right">
                <p className="text-lg font-bold leading-none" style={{ color: '#F5A623' }}>
                  {sessionStats.streak} 🔥
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {sessionStats.streak === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}

            {sessionStats && sessionStats.total > 0 && (
              <div className="text-right">
                <p className="text-lg font-bold leading-none" style={{ color: '#f5f5f5' }}>
                  {sessionStats.total}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {sessionStats.total === 1 ? 'sesión' : 'sesiones'}
                </p>
              </div>
            )}
          </div>
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
