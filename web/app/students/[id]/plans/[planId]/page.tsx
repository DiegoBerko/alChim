'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Plan, PlanBlock, PlanDay, PlanExercise, PlanSet, Exercise, SetMode } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a compact summary like "20x7kg / 30x7kg / 30x8kg" or "20'' / 30''" */
function buildSetSummary(sets: PlanSet[], mode: SetMode): string {
  if (sets.length === 0) return 'Sin series';
  return sets
    .map((s) => {
      const reps = s.targetReps;
      if (s.targetWeight != null) {
        return mode === 'seconds'
          ? `${reps}''x${s.targetWeight}kg`
          : `${reps}x${s.targetWeight}kg`;
      }
      return mode === 'seconds' ? `${reps}''` : `${reps}`;
    })
    .join(' / ');
}

// ─── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePickerModal({
  exercises,
  onSelect,
  onClose,
}: {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    category: 'fuerza' as Exercise['category'],
    muscleGroups: '',
    met: '4',
  });
  const [saving, setSaving] = useState(false);

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    setSaving(true);
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newForm.name.trim(),
        category: newForm.category,
        muscleGroups: newForm.muscleGroups.split(',').map((s) => s.trim()).filter(Boolean),
        met: parseFloat(newForm.met) || 4,
      }),
    });
    if (res.ok) {
      const exercise = await res.json();
      onSelect(exercise);
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Agregar ejercicio</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {!creating ? (
          <>
            <div className="p-4 border-b border-border">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ejercicio..."
                autoFocus
                className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-text-secondary text-sm mb-3">
                    No se encontró &quot;{search}&quot;
                  </p>
                  <button
                    onClick={() => {
                      setCreating(true);
                      setNewForm((f) => ({ ...f, name: search }));
                    }}
                    className="text-accent hover:text-accent-hover text-sm transition-colors"
                  >
                    + Crear &quot;{search}&quot;
                  </button>
                </div>
              ) : (
                <>
                  {filtered.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => onSelect(ex)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-elevated transition-colors border-b border-border/50 last:border-0"
                    >
                      <p className="text-white text-sm font-medium">{ex.name}</p>
                      <p className="text-text-secondary text-xs mt-0.5">
                        {ex.category} · {ex.muscleGroups.join(', ')}
                      </p>
                    </button>
                  ))}
                  {search && (
                    <button
                      onClick={() => {
                        setCreating(true);
                        setNewForm((f) => ({ ...f, name: search }));
                      }}
                      className="w-full text-left px-4 py-3 text-accent hover:bg-surface-elevated transition-colors text-sm"
                    >
                      + Crear &quot;{search}&quot;
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Nombre *</label>
              <input
                type="text"
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-text-secondary focus:border-accent focus:outline-none text-sm transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Categoría</label>
              <select
                value={newForm.category}
                onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value as Exercise['category'] }))}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-white focus:border-accent focus:outline-none text-sm transition-colors"
              >
                <option value="fuerza">Fuerza</option>
                <option value="cardio">Cardio</option>
                <option value="peso_corporal">Peso corporal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Grupos musculares (separados por coma)
              </label>
              <input
                type="text"
                value={newForm.muscleGroups}
                onChange={(e) => setNewForm((f) => ({ ...f, muscleGroups: e.target.value }))}
                placeholder="pecho, tríceps, hombros"
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-text-secondary focus:border-accent focus:outline-none text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">MET</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={newForm.met}
                onChange={(e) => setNewForm((f) => ({ ...f, met: e.target.value }))}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-white focus:border-accent focus:outline-none text-sm transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCreating(false)}
                className="flex-1 border border-border text-text-secondary hover:text-white py-2 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newForm.name.trim()}
                className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear y agregar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Set Row ─────────────────────────────────────────────────────────────────

function SetRow({
  set,
  mode,
  onChange,
  onDelete,
  changed,
}: {
  set: PlanSet;
  mode: SetMode;
  onChange: (updated: PlanSet) => void;
  onDelete: () => void;
  changed?: { reps?: boolean; weight?: boolean };
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-5 text-center text-text-secondary text-xs font-medium shrink-0">
        {set.setNumber}
      </span>
      <input
        type="text"
        value={set.targetReps}
        onChange={(e) => onChange({ ...set, targetReps: e.target.value })}
        placeholder={mode === 'reps' ? '8-10' : '30'}
        className={`w-20 border rounded px-2 py-1 text-white text-xs focus:border-accent focus:outline-none transition-colors ${
          changed?.reps
            ? 'bg-amber-400/20 border-amber-400/60'
            : 'bg-bg border-border'
        }`}
      />
      <span className="text-text-secondary text-xs">{mode === 'reps' ? 'reps' : 'seg'}</span>
      <span className="text-text-secondary text-xs">×</span>
      <input
        type="number"
        step="2.5"
        min="0"
        value={set.targetWeight ?? ''}
        onChange={(e) =>
          onChange({
            ...set,
            targetWeight: e.target.value ? parseFloat(e.target.value) : undefined,
          })
        }
        placeholder="kg"
        className={`w-16 border rounded px-2 py-1 text-white text-xs focus:border-accent focus:outline-none transition-colors ${
          changed?.weight
            ? 'bg-amber-400/20 border-amber-400/60'
            : 'bg-bg border-border'
        }`}
      />
      <span className="text-text-secondary text-xs">kg</span>
      <button
        onClick={onDelete}
        className="ml-auto text-text-secondary hover:text-red-400 transition-colors text-xs px-1"
        title="Eliminar serie"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Exercise Card ───────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  onUpdate,
  onDelete,
  originalExercise,
  isNew,
}: {
  exercise: PlanExercise;
  onUpdate: (updated: PlanExercise) => void;
  onDelete: () => void;
  originalExercise?: PlanExercise;
  isNew?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function updateSet(setNumber: number, updated: PlanSet) {
    onUpdate({
      ...exercise,
      sets: exercise.sets.map((s) => (s.setNumber === setNumber ? updated : s)),
    });
  }

  function deleteSet(setNumber: number) {
    const remaining = exercise.sets
      .filter((s) => s.setNumber !== setNumber)
      .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    onUpdate({ ...exercise, sets: remaining });
  }

  function addSet() {
    const nextNum = exercise.sets.length + 1;
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: PlanSet = {
      setNumber: nextNum,
      targetReps: lastSet?.targetReps ?? (exercise.mode === 'reps' ? '10' : '30'),
      targetWeight: lastSet?.targetWeight,
      mode: exercise.mode,
    };
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] });
  }

  function toggleMode() {
    const newMode: SetMode = exercise.mode === 'reps' ? 'seconds' : 'reps';
    onUpdate({
      ...exercise,
      mode: newMode,
      sets: exercise.sets.map((s) => ({ ...s, mode: newMode })),
    });
  }

  // Determine per-set changes compared to original
  function getSetChanges(set: PlanSet): { reps?: boolean; weight?: boolean } {
    if (!originalExercise) return {};
    const orig = originalExercise.sets.find((s) => s.setNumber === set.setNumber);
    if (!orig) return {}; // new set — no individual highlight needed (card header shows count diff)
    return {
      reps: orig.targetReps !== set.targetReps,
      weight: orig.targetWeight !== set.targetWeight,
    };
  }

  // Exercise-level change indicators
  const setCountChanged = originalExercise
    ? exercise.sets.length !== originalExercise.sets.length
    : false;

  return (
    <div className="bg-bg border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Explicit chevron toggle button */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-text-secondary hover:text-white transition-colors text-sm w-5 text-center shrink-0"
          title={expanded ? 'Colapsar' : 'Expandir'}
          aria-label={expanded ? 'Colapsar ejercicio' : 'Expandir ejercicio'}
        >
          {expanded ? '▲' : '▼'}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{exercise.exerciseName}</span>
            {isNew && (
              <span className="text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded shrink-0">
                ✦ Nuevo
              </span>
            )}
          </div>
          {!expanded && exercise.sets.length > 0 && (
            <p className="text-xs text-text-secondary mt-0.5 truncate">
              {buildSetSummary(exercise.sets, exercise.mode)}
            </p>
          )}
        </div>

        <span className={`text-xs shrink-0 ${setCountChanged ? 'text-amber-400 font-medium' : 'text-text-secondary'}`}>
          {exercise.sets.length} series{setCountChanged && ' *'}
        </span>

        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          className={`px-2 py-0.5 rounded text-xs border transition-colors ${
            exercise.mode === 'reps'
              ? 'border-accent/50 text-accent'
              : 'border-blue-400/50 text-blue-400'
          }`}
        >
          {exercise.mode === 'reps' ? 'Reps' : 'Seg'}
        </button>

        {/* Delete */}
        {confirmDelete ? (
          <>
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-text-secondary hover:text-white transition-colors"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-text-secondary hover:text-red-400 transition-colors text-xs"
            title="Eliminar ejercicio"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-border/50">
          {/* Notes */}
          <div className="my-2">
            <input
              type="text"
              value={exercise.notes || ''}
              onChange={(e) => onUpdate({ ...exercise, notes: e.target.value })}
              placeholder="Notas del ejercicio (opcional)..."
              className="w-full bg-surface border border-border/50 rounded px-3 py-1.5 text-white text-xs placeholder-text-secondary focus:border-accent/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Sets */}
          <div className="space-y-0.5">
            {exercise.sets.length === 0 ? (
              <p className="text-text-secondary text-xs py-1">Sin series. Agregá una.</p>
            ) : (
              exercise.sets.map((set) => (
                <SetRow
                  key={set.setNumber}
                  set={set}
                  mode={exercise.mode}
                  onChange={(updated) => updateSet(set.setNumber, updated)}
                  onDelete={() => deleteSet(set.setNumber)}
                  changed={getSetChanges(set)}
                />
              ))
            )}
          </div>

          <button
            onClick={addSet}
            className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            + Agregar serie
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Read-Only Day View ──────────────────────────────────────────────────────

function ReadOnlyDayView({ day }: { day: PlanDay }) {
  const sortedBlocks = [...day.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  return (
    <div className="space-y-3">
      <div className="px-3 py-2 bg-slate-500/10 border border-slate-500/20 rounded-lg text-xs text-slate-400">
        Vista de solo lectura — plan original &quot;{day.name}&quot;
      </div>
      {sortedBlocks.map((block) => (
        <div key={block.id} className="bg-surface border border-slate-600/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-600/30 flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-300">{block.name}</span>
            <span className="text-slate-500 text-xs">{block.exercises.length} ejercicios</span>
          </div>
          {block.exercises.length === 0 ? (
            <p className="px-4 py-3 text-slate-500 text-xs">Sin ejercicios</p>
          ) : (
            <div className="p-4 space-y-2">
              {block.exercises.map((ex) => (
                <div key={ex.id} className="bg-bg border border-slate-700/50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-slate-300">{ex.exerciseName}</span>
                    <span className="text-slate-500 text-xs shrink-0">{ex.sets.length} series</span>
                  </div>
                  {ex.sets.length > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {buildSetSummary(ex.sets, ex.mode)}
                    </p>
                  )}
                  {ex.notes && (
                    <p className="text-xs text-slate-600 mt-1 italic">{ex.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Block Card ──────────────────────────────────────────────────────────────

function BlockCard({
  block,
  exercises,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  originalBlock,
}: {
  block: PlanBlock;
  exercises: Exercise[];
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updated: PlanBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  originalBlock?: PlanBlock;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(block.name);

  function handleAddExercise(exercise: Exercise) {
    const newExercise: PlanExercise = {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      orderIndex: block.exercises.length,
      mode: 'reps',
      sets: [
        { setNumber: 1, targetReps: '10', mode: 'reps' },
        { setNumber: 2, targetReps: '10', mode: 'reps' },
        { setNumber: 3, targetReps: '10', mode: 'reps' },
      ],
    };
    onUpdate({ ...block, exercises: [...block.exercises, newExercise] });
    setShowPicker(false);
  }

  function updateExercise(exId: string, updated: PlanExercise) {
    onUpdate({
      ...block,
      exercises: block.exercises.map((e) => (e.id === exId ? updated : e)),
    });
  }

  function deleteExercise(exId: string) {
    onUpdate({
      ...block,
      exercises: block.exercises
        .filter((e) => e.id !== exId)
        .map((e, idx) => ({ ...e, orderIndex: idx })),
    });
  }

  function saveName() {
    if (tempName.trim()) onUpdate({ ...block, name: tempName.trim() });
    else setTempName(block.name);
    setEditingName(false);
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Block header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-text-secondary hover:text-white transition-colors text-sm"
          >
            {collapsed ? '▸' : '▾'}
          </button>

          {editingName ? (
            <input
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setTempName(block.name); setEditingName(false); } }}
              className="flex-1 bg-surface-elevated border border-accent rounded px-2 py-0.5 text-white text-sm font-semibold focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex-1 text-left font-semibold text-sm hover:text-accent transition-colors"
              title="Editar nombre del bloque"
            >
              {block.name}
            </button>
          )}

          <span className="text-text-secondary text-xs">
            {block.exercises.length} ejercicios
          </span>

          {/* Reorder */}
          <div className="flex gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="text-text-secondary hover:text-white transition-colors disabled:opacity-30 text-xs px-1"
              title="Mover arriba"
            >
              ↑
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="text-text-secondary hover:text-white transition-colors disabled:opacity-30 text-xs px-1"
              title="Mover abajo"
            >
              ↓
            </button>
          </div>

          <button
            onClick={onDelete}
            className="text-text-secondary hover:text-red-400 transition-colors text-xs"
            title="Eliminar bloque"
          >
            🗑️
          </button>
        </div>

        {/* Exercises */}
        {!collapsed && (
          <div className="p-4 space-y-3">
            {block.exercises.length === 0 ? (
              <p className="text-text-secondary text-xs text-center py-3">
                Sin ejercicios. Agregá uno.
              </p>
            ) : (
              block.exercises.map((ex) => {
                const origEx = originalBlock?.exercises.find(
                  (o) => o.exerciseId === ex.exerciseId
                );
                return (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    onUpdate={(updated) => updateExercise(ex.id, updated)}
                    onDelete={() => deleteExercise(ex.id)}
                    originalExercise={origEx}
                    isNew={!origEx && !!originalBlock}
                  />
                );
              })
            )}
            <button
              onClick={() => setShowPicker(true)}
              className="w-full border border-dashed border-border hover:border-accent/50 text-text-secondary hover:text-accent py-2 rounded-lg text-xs transition-colors"
            >
              + Agregar ejercicio
            </button>
          </div>
        )}
      </div>

      {showPicker && (
        <ExercisePickerModal
          exercises={exercises}
          onSelect={handleAddExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ─── Day Editor ───────────────────────────────────────────────────────────────

function DayEditor({
  day,
  exercises,
  onUpdate,
  onDelete,
  canDelete,
  originalDay,
}: {
  day: PlanDay;
  exercises: Exercise[];
  onUpdate: (updated: PlanDay) => void;
  onDelete: () => void;
  canDelete: boolean;
  originalDay?: PlanDay;
}) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(day.name);

  const sortedBlocks = [...day.blocks].sort((a, b) => a.orderIndex - b.orderIndex);

  function saveName() {
    if (tempName.trim()) onUpdate({ ...day, name: tempName.trim() });
    else setTempName(day.name);
    setEditingName(false);
  }

  function updateBlock(blockId: string, updated: PlanBlock) {
    onUpdate({
      ...day,
      blocks: day.blocks.map((b) => (b.id === blockId ? updated : b)),
    });
  }

  function deleteBlock(blockId: string) {
    onUpdate({
      ...day,
      blocks: day.blocks
        .filter((b) => b.id !== blockId)
        .map((b, idx) => ({ ...b, orderIndex: idx })),
    });
  }

  function moveBlock(blockId: string, dir: 'up' | 'down') {
    const idx = day.blocks.findIndex((b) => b.id === blockId);
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= day.blocks.length) return;
    const blocks = [...day.blocks];
    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    onUpdate({ ...day, blocks: blocks.map((b, i) => ({ ...b, orderIndex: i })) });
  }

  function addBlock() {
    const newBlock: PlanBlock = {
      id: crypto.randomUUID(),
      name: 'Nueva sección',
      orderIndex: day.blocks.length,
      exercises: [],
    };
    onUpdate({ ...day, blocks: [...day.blocks, newBlock] });
  }

  return (
    <div className="space-y-3">
      {/* Day header */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <input
            autoFocus
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setTempName(day.name); setEditingName(false); }
            }}
            className="flex-1 bg-surface-elevated border border-accent rounded-lg px-3 py-1.5 text-white font-semibold focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="font-semibold text-white hover:text-accent transition-colors group flex items-center gap-1"
            title="Editar nombre del día"
          >
            {day.name}
            <span className="text-text-secondary text-xs opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-text-secondary hover:text-red-400 transition-colors text-xs ml-auto"
            title="Eliminar día"
          >
            Eliminar día
          </button>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {sortedBlocks.map((block, idx) => {
          const origBlock = originalDay?.blocks.find((ob) => ob.name === block.name);
          return (
            <BlockCard
              key={block.id}
              block={block}
              exercises={exercises}
              isFirst={idx === 0}
              isLast={idx === sortedBlocks.length - 1}
              onUpdate={(updated) => updateBlock(block.id, updated)}
              onDelete={() => deleteBlock(block.id)}
              onMoveUp={() => moveBlock(block.id, 'up')}
              onMoveDown={() => moveBlock(block.id, 'down')}
              originalBlock={origBlock}
            />
          );
        })}

        <button
          onClick={addBlock}
          className="w-full border-2 border-dashed border-border hover:border-accent/40 text-text-secondary hover:text-accent py-2.5 rounded-xl text-sm transition-colors"
        >
          + Nueva sección
        </button>
      </div>
    </div>
  );
}

// ─── Plan Editor ─────────────────────────────────────────────────────────────

export default function PlanEditorPage() {
  const params = useParams();
  const studentId = params.id as string;
  const planId = params.planId as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [originalPlan, setOriginalPlan] = useState<Plan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [viewingOriginalDayIdx, setViewingOriginalDayIdx] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/students/${studentId}/plans/${planId}`).then((r) => r.json()),
      fetch('/api/exercises').then((r) => r.json()),
    ]).then(async ([planData, exData]: [Plan, Exercise[]]) => {
      // Normalise to days structure
      const normalised = normalisePlan(planData);
      setPlan(normalised);
      setTempName(normalised.name);
      setExercises(exData);

      // Load original plan if basedOnPlanId exists
      if (planData.basedOnPlanId) {
        try {
          const origRes = await fetch(
            `/api/students/${studentId}/plans/${planData.basedOnPlanId}`
          );
          if (origRes.ok) {
            const origData: Plan = await origRes.json();
            setOriginalPlan(normalisePlan(origData));
          }
        } catch {
          // ignore — change tracking just won't show
        }
      }

      setLoading(false);
    });
  }, [studentId, planId]);

  /** Convert a plan that may only have `blocks` into one with `days` */
  function normalisePlan(p: Plan): Plan {
    if (p.days && p.days.length > 0) return p;
    // Migrate flat blocks into Día 1
    return {
      ...p,
      days: [
        {
          id: crypto.randomUUID(),
          name: 'Día 1',
          blocks: p.blocks ?? [],
        },
      ],
    };
  }

  /** Serialise for save — keep blocks at top level for backward compat */
  function serialisePlan(p: Plan): Plan {
    const allBlocks = (p.days ?? []).flatMap((d) => d.blocks);
    return { ...p, blocks: allBlocks };
  }

  const saveDraft = useCallback(async (planData: Plan) => {
    setSaving(true);
    setSaveStatus('idle');
    const res = await fetch(`/api/students/${studentId}/plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serialisePlan(planData)),
    });
    if (res.ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
    }
    setSaving(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, planId]);

  async function handlePublish() {
    if (!plan) return;
    setPublishing(true);
    await saveDraft(plan);
    const res = await fetch(`/api/students/${studentId}/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    });
    if (res.ok) {
      setPlan((p) => p ? { ...p, status: 'published', publishedAt: new Date().toISOString() } : p);
    }
    setPublishing(false);
    setShowPublishConfirm(false);
  }

  function updateDay(dayId: string, updated: PlanDay) {
    setPlan((prev) =>
      prev
        ? { ...prev, days: (prev.days ?? []).map((d) => (d.id === dayId ? updated : d)) }
        : prev
    );
  }

  function deleteDay(dayId: string) {
    setPlan((prev) => {
      if (!prev || !prev.days) return prev;
      const remaining = prev.days
        .filter((d) => d.id !== dayId);
      return { ...prev, days: remaining };
    });
  }

  function addDay() {
    setPlan((prev) => {
      if (!prev) return prev;
      const days = prev.days ?? [];
      const newDay: PlanDay = {
        id: crypto.randomUUID(),
        name: `Día ${days.length + 1}`,
        blocks: [
          { id: crypto.randomUUID(), name: 'Entrada en calor', orderIndex: 0, exercises: [] },
          { id: crypto.randomUUID(), name: 'Bloque Principal', orderIndex: 1, exercises: [] },
        ],
      };
      return { ...prev, days: [...days, newDay] };
    });
    // Switch to new day after state update
    setTimeout(() => {
      setPlan((prev) => {
        if (prev?.days) setActiveDay(prev.days.length - 1);
        return prev;
      });
    }, 0);
  }

  function saveName() {
    if (tempName.trim() && plan) {
      setPlan((p) => p ? { ...p, name: tempName.trim() } : p);
    } else {
      setTempName(plan?.name || '');
    }
    setEditingName(false);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-64 bg-surface-elevated rounded animate-pulse mb-4" />
        <div className="h-4 w-32 bg-surface-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-8">
        <p className="text-red-400">Plan no encontrado</p>
        <Link
          href={`/students/${studentId}/plans`}
          className="text-accent hover:underline text-sm mt-2 block"
        >
          Volver a planes
        </Link>
      </div>
    );
  }

  const days = plan.days ?? [];
  const currentDay = days[activeDay] ?? days[0];

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm flex-wrap">
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
        <span className="text-white truncate max-w-32">{plan.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setTempName(plan.name); setEditingName(false); } }}
              className="text-2xl font-bold bg-transparent border-b-2 border-accent text-white focus:outline-none w-full"
            />
          ) : (
            <button
              onClick={() => { setEditingName(true); setTempName(plan.name); }}
              className="text-2xl font-bold text-left hover:text-accent transition-colors group flex items-center gap-2"
              title="Editar nombre"
            >
              {plan.name}
              <span className="text-text-secondary text-base opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
            </button>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                plan.status === 'published'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {plan.status === 'published' ? 'Publicado' : 'Borrador'}
            </span>
            {plan.publishedAt && (
              <span className="text-text-secondary text-xs">
                el {new Date(plan.publishedAt).toLocaleDateString('es-AR')}
              </span>
            )}
            {originalPlan && (
              <span className="text-xs text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 rounded-full">
                🟡 Basado en &quot;{originalPlan.name}&quot;
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveStatus === 'saved' && (
            <span className="text-green-400 text-sm">✓ Guardado</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-400 text-sm">Error al guardar</span>
          )}

          <button
            onClick={() => saveDraft(plan)}
            disabled={saving}
            className="border border-border text-text-secondary hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>

          {plan.status === 'draft' ? (
            <button
              onClick={() => setShowPublishConfirm(true)}
              disabled={publishing}
              className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {publishing ? 'Publicando...' : 'Publicar'}
            </button>
          ) : (
            <button
              onClick={() => saveDraft(plan)}
              disabled={saving}
              className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
      </div>

      {/* Change tracking legend */}
      {originalPlan && (
        <div className="mb-4 px-3 py-2 bg-amber-400/10 border border-amber-400/20 rounded-lg text-xs text-amber-400">
          🟡 = cambió respecto del plan original &quot;{originalPlan.name}&quot;
        </div>
      )}

      {/* Day tabs */}
      {days.length > 0 && (
        <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto pb-0">
          {days.map((day, idx) => (
            <button
              key={day.id}
              onClick={() => { setActiveDay(idx); setViewingOriginalDayIdx(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                idx === activeDay && viewingOriginalDayIdx === null
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-white'
              }`}
            >
              {day.name}
            </button>
          ))}
          <button
            onClick={addDay}
            className="px-3 py-2.5 text-sm text-text-secondary hover:text-accent transition-colors -mb-px border-b-2 border-transparent whitespace-nowrap"
            title="Agregar día"
          >
            + Día
          </button>

          {/* Original plan day tabs */}
          {originalPlan?.days && originalPlan.days.length > 0 && (
            <>
              <div className="w-px h-5 bg-border mx-1 shrink-0" />
              {originalPlan.days.map((origDay, idx) => (
                <button
                  key={origDay.id}
                  onClick={() => setViewingOriginalDayIdx(idx)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                    viewingOriginalDayIdx === idx
                      ? 'border-slate-400 text-slate-300'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                  title={`Ver plan original — ${origDay.name}`}
                >
                  Original: {origDay.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Active day editor or read-only original */}
      {viewingOriginalDayIdx !== null && originalPlan?.days ? (
        <ReadOnlyDayView day={originalPlan.days[viewingOriginalDayIdx]} />
      ) : currentDay ? (
        <DayEditor
          key={currentDay.id}
          day={currentDay}
          exercises={exercises}
          onUpdate={(updated) => updateDay(currentDay.id, updated)}
          onDelete={() => {
            deleteDay(currentDay.id);
            setActiveDay(Math.max(0, activeDay - 1));
          }}
          canDelete={days.length > 1}
          originalDay={
            originalPlan?.days
              ? originalPlan.days[activeDay]
              : undefined
          }
        />
      ) : null}

      {/* Publish confirm modal */}
      {showPublishConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">Publicar plan</h3>
            <p className="text-text-secondary text-sm mb-4">
              El alumno podrá ver este plan desde la app con su código de acceso. ¿Confirmar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishConfirm(false)}
                className="flex-1 border border-border text-text-secondary hover:text-white py-2 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {publishing ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
