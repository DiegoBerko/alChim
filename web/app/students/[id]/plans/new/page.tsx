'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewPlanPage() {
  const params = useParams();
  const studentId = params.id as string;
  const router = useRouter();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch(`/api/students/${studentId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (res.ok) {
      const plan = await res.json();
      router.push(`/students/${studentId}/plans/${plan.id}`);
    } else {
      setError('Error al crear el plan');
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-md">
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
        <Link
          href={`/students/${studentId}/plans`}
          className="text-text-secondary hover:text-white transition-colors"
        >
          Planes
        </Link>
        <span className="text-border">/</span>
        <span className="text-white">Nuevo</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Nuevo plan</h1>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Nombre del plan <span className="text-accent">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Plan fuerza semana 1..."
            autoFocus
            required
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href={`/students/${studentId}/plans`}
            className="flex-1 text-center border border-border text-text-secondary hover:text-white hover:border-white/30 py-2.5 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Creando...' : 'Crear plan'}
          </button>
        </div>
      </form>
    </div>
  );
}
