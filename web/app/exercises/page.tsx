'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Exercise } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  peso_corporal: 'Peso corporal',
};

const CATEGORY_COLORS: Record<string, string> = {
  fuerza: 'bg-orange-500/20 text-orange-400',
  cardio: 'bg-blue-500/20 text-blue-400',
  peso_corporal: 'bg-green-500/20 text-green-400',
};

async function handleDrivePicker(onUrl: (url: string) => void): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
  if (!apiKey || !clientId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (!win.gapi) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.onload = () => win.gapi.load('picker', () => resolve());
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  if (!win.google?.accounts) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const tokenClient = win.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: (response: { access_token?: string }) => {
      if (!response.access_token) return;
      const g = win.google.picker;
      const picker = new g.PickerBuilder()
        .setOAuthToken(response.access_token)
        .setDeveloperKey(apiKey)
        .addView(new g.DocsView(g.ViewId.DOCS_VIDEOS))
        .addView(new g.DocsView())
        .setCallback((data: { action: string; docs?: Array<{ id: string }> }) => {
          if (data.action === 'picked' && data.docs?.[0]) {
            onUrl(`https://drive.google.com/file/d/${data.docs[0].id}/view?usp=sharing`);
          }
        })
        .build();
      picker.setVisible(true);
    },
  });
  tokenClient.requestAccessToken({ prompt: '' });
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (exercise: Exercise) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    category: 'fuerza' as Exercise['category'],
    muscleGroups: '',
    met: '4',
    videoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        category: form.category,
        muscleGroups: form.muscleGroups.split(',').map((s) => s.trim()).filter(Boolean),
        met: parseFloat(form.met) || 4,
        ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : {}),
      }),
    });

    if (res.ok) {
      const exercise = await res.json();
      onCreate(exercise);
    } else {
      setError('Error al crear el ejercicio');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Nuevo ejercicio</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Nombre <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              placeholder="Press de banca"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Exercise['category'] }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors"
            >
              <option value="fuerza">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="peso_corporal">Peso corporal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Grupos musculares (separados por coma)
            </label>
            <input
              type="text"
              value={form.muscleGroups}
              onChange={(e) => setForm((f) => ({ ...f, muscleGroups: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              placeholder="pecho, tríceps, hombros"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              MET (valor metabólico equivalente)
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="20"
              value={form.met}
              onChange={(e) => setForm((f) => ({ ...f, met: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Video (URL)</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                className="flex-1 bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors text-sm"
                placeholder="https://drive.google.com/..."
              />
              {process.env.NEXT_PUBLIC_GOOGLE_API_KEY && (
                <button
                  type="button"
                  onClick={() => handleDrivePicker((url) => setForm((f) => ({ ...f, videoUrl: url })))}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-border text-text-secondary hover:text-white hover:border-white/30 transition-colors shrink-0"
                  title="Buscar en Google Drive"
                >
                  Drive
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-text-secondary hover:text-white hover:border-white/30 py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear ejercicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({
  exercise,
  onClose,
  onUpdate,
}: {
  exercise: Exercise;
  onClose: () => void;
  onUpdate: (updated: Exercise) => void;
}) {
  const [form, setForm] = useState({
    name: exercise.name,
    category: exercise.category,
    muscleGroups: exercise.muscleGroups.join(', '),
    met: String(exercise.met),
    videoUrl: exercise.videoUrl ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload: Partial<Omit<Exercise, 'id'>> = {
      name: form.name.trim(),
      category: form.category,
      muscleGroups: form.muscleGroups.split(',').map((s) => s.trim()).filter(Boolean),
      met: parseFloat(form.met) || 4,
      ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : { videoUrl: undefined }),
    };

    const res = await fetch(`/api/exercises/${exercise.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      onUpdate({ ...exercise, ...payload });
    } else {
      setError('Error al guardar el ejercicio');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Editar ejercicio</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Nombre <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              placeholder="Press de banca"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Exercise['category'] }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors"
            >
              <option value="fuerza">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="peso_corporal">Peso corporal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Grupos musculares (separados por coma)
            </label>
            <input
              type="text"
              value={form.muscleGroups}
              onChange={(e) => setForm((f) => ({ ...f, muscleGroups: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              placeholder="pecho, tríceps, hombros"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              MET (valor metabólico equivalente)
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="20"
              value={form.met}
              onChange={(e) => setForm((f) => ({ ...f, met: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Video (URL)</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                className="flex-1 bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors text-sm"
                placeholder="https://drive.google.com/..."
              />
              {process.env.NEXT_PUBLIC_GOOGLE_API_KEY && (
                <button
                  type="button"
                  onClick={() => handleDrivePicker((url) => setForm((f) => ({ ...f, videoUrl: url })))}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-border text-text-secondary hover:text-white hover:border-white/30 transition-colors shrink-0"
                  title="Buscar en Google Drive"
                >
                  Drive
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-text-secondary hover:text-white hover:border-white/30 py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const fetchExercises = useCallback(async () => {
    const res = await fetch('/api/exercises');
    const data = await res.json();
    setExercises(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
    setExercises((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  const filtered = exercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.muscleGroups.some((m) => m.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ejercicios</h1>
          <p className="text-text-secondary text-sm mt-1">Biblioteca global de ejercicios</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          + Nuevo ejercicio
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o grupo muscular..."
          className="w-full max-w-md bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          {search ? (
            <>
              <p className="font-medium">Sin resultados para &quot;{search}&quot;</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-accent hover:text-accent-hover text-sm transition-colors"
              >
                + Crear &quot;{search}&quot;
              </button>
            </>
          ) : (
            <>
              <p className="text-3xl mb-4">🏋️</p>
              <p className="font-medium">Sin ejercicios todavía</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              className="bg-surface border border-border rounded-xl px-5 py-4 flex items-center gap-4 group hover:border-border/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white">{ex.name}</span>
                  {ex.videoUrl && (
                    <a
                      href={ex.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver video"
                      className="text-accent hover:text-accent-hover transition-colors text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🎬
                    </a>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ex.category]}`}>
                    {CATEGORY_LABELS[ex.category]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {ex.muscleGroups.length > 0 && (
                    <p className="text-text-secondary text-xs">{ex.muscleGroups.join(', ')}</p>
                  )}
                  <p className="text-text-secondary text-xs">MET: {ex.met}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Edit button */}
                <button
                  onClick={() => setEditingExercise(ex)}
                  className="text-text-secondary hover:text-white transition-colors opacity-0 group-hover:opacity-100 text-sm"
                  title="Editar"
                >
                  ✎
                </button>

                {confirmDeleteId === ex.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(ex.id)}
                      disabled={deletingId === ex.id}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      {deletingId === ex.id ? '...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-text-secondary hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDelete(ex.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && exercises.length > 0 && (
        <p className="text-text-secondary text-xs mt-4">
          {filtered.length} de {exercises.length} ejercicios
        </p>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(exercise) => {
            setExercises((prev) => [...prev, exercise].sort((a, b) => a.name.localeCompare(b.name)));
            setShowCreate(false);
          }}
        />
      )}

      {editingExercise && (
        <EditModal
          exercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onUpdate={(updated) => {
            setExercises((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e)).sort((a, b) => a.name.localeCompare(b.name))
            );
            setEditingExercise(null);
          }}
        />
      )}
    </div>
  );
}
