'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Plan, PlanSet, SetMode } from '@/lib/types';

export default function PlansPage() {
  const params = useParams();
  const studentId = params.id as string;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    const res = await fetch(`/api/students/${studentId}/plans`);
    const data = await res.json();
    setPlans(data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function handleDelete(planId: string) {
    if (!confirm('¿Eliminar este plan?')) return;
    setDeletingId(planId);
    const res = await fetch(`/api/students/${studentId}/plans/${planId}`, { method: 'DELETE' });
    if (res.ok) setPlans((prev) => prev.filter((p) => p.id !== planId));
    setDeletingId(null);
  }

  async function handleShare(planId: string) {
    setSharingId(planId);
    try {
      const res = await fetch(`/api/students/${studentId}/plans/${planId}`);
      const plan: Plan = await res.json();
      const allDays = plan.days && plan.days.length > 0
        ? plan.days
        : [{ id: '__single__', name: 'Día 1', blocks: plan.blocks ?? [] }];
      let text = `*${plan.name}*\n\n`;
      for (const day of allDays) {
        text += `📅 *${day.name}*\n`;
        const sorted = [...day.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
        for (const block of sorted) {
          text += `\n_${block.name}_\n`;
          for (const ex of block.exercises) {
            const setsStr = ex.sets.map((s: PlanSet) => {
              const r = (ex.mode as SetMode) === 'seconds' ? `${s.targetReps}''` : `${s.targetReps} reps`;
              return s.targetWeight ? `${r} × ${s.targetWeight}kg` : r;
            }).join(' / ');
            text += `• ${ex.exerciseName}: ${setsStr}\n`;
            if (ex.notes) text += `  _${ex.notes}_\n`;
          }
        }
        text += '\n';
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text.trim())}`, '_blank');
    } finally {
      setSharingId(null);
    }
  }

  async function handlePublish(planId: string) {
    if (!confirm('¿Publicar este plan? El alumno podrá verlo desde la app.')) return;
    setPublishingId(planId);
    const res = await fetch(`/api/students/${studentId}/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    });
    if (res.ok) {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? { ...p, status: 'published', publishedAt: new Date().toISOString() }
            : p
        )
      );
    }
    setPublishingId(null);
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/students" className="text-text-secondary hover:text-white transition-colors">
          Alumnos
        </Link>
        <span className="text-border">/</span>
        <Link
          href={`/students/${studentId}`}
          className="text-text-secondary hover:text-white transition-colors"
        >
          Alumno
        </Link>
        <span className="text-border">/</span>
        <span className="text-white">Planes</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Planes de entrenamiento</h1>
        <Link
          href={`/students/${studentId}/plans/new`}
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          + Nuevo plan
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-3xl mb-4">📋</p>
          <p className="font-medium">Sin planes todavía</p>
          <p className="text-sm mt-1">Creá el primer plan para este alumno.</p>
          <Link
            href={`/students/${studentId}/plans/new`}
            className="inline-block mt-4 bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            + Nuevo plan
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-surface border border-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white truncate">{plan.name}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        plan.status === 'published'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {plan.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-text-secondary text-xs">
                    Creado: {new Date(plan.createdAt).toLocaleDateString('es-AR')}
                    {plan.publishedAt &&
                      ` · Publicado: ${new Date(plan.publishedAt).toLocaleDateString('es-AR')}`}
                  </p>
                  <p className="text-text-secondary text-xs mt-1">
                    {plan.blocks.length} {plan.blocks.length === 1 ? 'bloque' : 'bloques'} ·{' '}
                    {plan.blocks.reduce((sum, b) => sum + b.exercises.length, 0)} ejercicios
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {plan.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(plan.id)}
                      disabled={publishingId === plan.id}
                      className="bg-accent hover:bg-accent-hover text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {publishingId === plan.id ? '...' : 'Publicar'}
                    </button>
                  )}
                  <Link
                    href={`/students/${studentId}/plans/${plan.id}`}
                    className="border border-border text-text-secondary hover:text-white hover:border-white/30 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleShare(plan.id)}
                    disabled={sharingId === plan.id}
                    className="text-text-secondary hover:text-green-400 transition-colors disabled:opacity-50 px-1"
                    title="Compartir por WhatsApp"
                  >
                    {sharingId === plan.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    disabled={deletingId === plan.id}
                    className="text-text-secondary hover:text-red-400 transition-colors text-sm disabled:opacity-50 px-1"
                    title="Eliminar plan"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
