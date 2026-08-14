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
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

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
                  <div className="relative">
                    <button
                      onClick={() => setShareMenuId(shareMenuId === plan.id ? null : plan.id)}
                      disabled={pdfLoadingId === plan.id || sharingId === plan.id}
                      className="text-text-secondary hover:text-white transition-colors disabled:opacity-50 px-1 text-sm"
                      title="Compartir"
                    >
                      {pdfLoadingId === plan.id || sharingId === plan.id ? '...' : '↑'}
                    </button>
                    {shareMenuId === plan.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShareMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden min-w-[180px]">
                          <button
                            onClick={() => { handleShare(plan.id); setShareMenuId(null); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                          >
                            📲 WhatsApp (mensaje)
                          </button>
                          <button
                            onClick={async () => {
                              setShareMenuId(null); setPdfLoadingId(plan.id);
                              try {
                                const res = await fetch(`/api/students/${studentId}/plans/${plan.id}`);
                                const fullPlan: Plan = await res.json();
                                const { sharePlanPDF } = await import('@/lib/plan-pdf');
                                await sharePlanPDF(fullPlan);
                              } finally { setPdfLoadingId(null); }
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                          >
                            📤 Compartir PDF
                          </button>
                          <button
                            onClick={async () => {
                              setShareMenuId(null); setPdfLoadingId(plan.id);
                              try {
                                const res = await fetch(`/api/students/${studentId}/plans/${plan.id}`);
                                const fullPlan: Plan = await res.json();
                                const { downloadPlanPDF } = await import('@/lib/plan-pdf');
                                await downloadPlanPDF(fullPlan);
                              } finally { setPdfLoadingId(null); }
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                          >
                            📄 Descargar PDF
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
