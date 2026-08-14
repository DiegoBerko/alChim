'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { Student, StudentNote, StudentAspect, Payment, Plan, GymSession, StudentFeedback } from '@/lib/types';

type Tab = 'perfil' | 'pagos' | 'notas-lesiones' | 'planes' | 'historial' | 'consultas';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ student, onUpdate }: { student: Student; onUpdate: (s: Student) => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: student.name,
    surname: student.surname,
    apodo: student.apodo || '',
    phone: student.phone || '',
    weight: student.weight ? String(student.weight) : '',
    gender: student.gender || '',
  });
  const [extraFields, setExtraFields] = useState<{ key: string; value: string }[]>(
    Object.entries(student.extraData || {}).map(([key, value]) => ({ key, value }))
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentCode, setCurrentCode] = useState(student.linkCode);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const extraData: Record<string, string> = {};
    extraFields.forEach(({ key, value }) => {
      if (key.trim()) extraData[key.trim()] = value;
    });

    const payload = {
      name: form.name.trim(),
      surname: form.surname.trim(),
      apodo: form.apodo.trim() || null,
      phone: form.phone.trim() || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      gender: form.gender || null,
      extraData: Object.keys(extraData).length > 0 ? extraData : null,
    };

    const res = await fetch(`/api/students/${student.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSuccess('Cambios guardados');
      onUpdate({ ...student, ...payload } as Student);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError('Error al guardar');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/students/${student.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/students');
    } else {
      setError('Error al eliminar');
      setDeleting(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegen() {
    if (!regenConfirm) { setRegenConfirm(true); return; }
    setRegenLoading(true);
    const res = await fetch(`/api/students/${student.id}/regen-code`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setCurrentCode(data.linkCode);
      onUpdate({ ...student, linkCode: data.linkCode });
      setRegenConfirm(false);
    }
    setRegenLoading(false);
  }

  function handleWhatsApp() {
    const portalUrl = `${window.location.origin}/portal`;
    const text = `Accedé a tu portal de entrenamiento: ${portalUrl}\n\nTu clave de acceso es: *${currentCode}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Link code */}
      <div className="bg-surface-elevated border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs text-text-secondary mb-1">Código de acceso del alumno</p>
            <p className="font-mono text-2xl font-bold text-accent tracking-widest">
              {currentCode}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <button
              type="button"
              onClick={copyCode}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                copied
                  ? 'border-green-500 text-green-400'
                  : 'border-border text-text-secondary hover:text-white hover:border-white/30'
              }`}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="px-3 py-1.5 rounded-lg text-xs border border-green-600/50 text-green-400 hover:bg-green-500/10 transition-colors"
            >
              📲 WhatsApp
            </button>
          </div>
        </div>

        {/* Regenerar */}
        {regenConfirm ? (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <p className="text-xs text-amber-400 flex-1">El código actual quedará inválido. ¿Confirmar?</p>
            <button
              type="button"
              onClick={handleRegen}
              disabled={regenLoading}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 font-medium"
            >
              {regenLoading ? '...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setRegenConfirm(false)}
              className="text-xs text-text-secondary hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRegen}
            className="text-xs text-text-secondary hover:text-amber-400 transition-colors pt-2 border-t border-border/50 w-full text-left"
          >
            🔄 Regenerar código
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Apellido *</label>
          <input
            type="text"
            value={form.surname}
            onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
            required
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Apodo</label>
        <input
          type="text"
          value={form.apodo}
          onChange={(e) => setForm((f) => ({ ...f, apodo: e.target.value }))}
          placeholder="Opcional"
          className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm text-text-secondary mb-1.5">Teléfono</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Peso (kg)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={form.weight}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Género</label>
          <select
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors"
          >
            <option value="">No especifica</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>
        </div>
      </div>

      {/* Extra fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-text-secondary">Datos adicionales</label>
          <button
            type="button"
            onClick={() => setExtraFields((prev) => [...prev, { key: '', value: '' }])}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            + Agregar campo
          </button>
        </div>
        {extraFields.length > 0 && (
          <div className="space-y-2">
            {extraFields.map((field, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) =>
                    setExtraFields((prev) =>
                      prev.map((f, i) => (i === idx ? { ...f, key: e.target.value } : f))
                    )
                  }
                  placeholder="Campo"
                  className="w-1/3 bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) =>
                    setExtraFields((prev) =>
                      prev.map((f, i) => (i === idx ? { ...f, value: e.target.value } : f))
                    )
                  }
                  placeholder="Valor"
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setExtraFields((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-text-secondary hover:text-red-400 transition-colors px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
          ✓ {success}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Delete */}
      <div className="pt-6 border-t border-border">
        <p className="text-sm text-text-secondary mb-3">Zona peligrosa</p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            confirmDelete
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'border border-red-500/50 text-red-400 hover:bg-red-500/10'
          }`}
        >
          {deleting
            ? 'Eliminando...'
            : confirmDelete
            ? '⚠ Confirmar eliminación'
            : 'Eliminar alumno'}
        </button>
        {confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="ml-2 text-sm text-text-secondary hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Note Cell (payment) ──────────────────────────────────────────────────────

function NoteCell({
  note,
  saving,
  onSave,
}: {
  note: string;
  saving: boolean;
  onSave: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);

  useEffect(() => { setDraft(note); }, [note]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (editing) {
    return (
      <div className="px-3 pb-3 flex gap-1">
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(note); setEditing(false); }
          }}
          placeholder="Nota..."
          className="flex-1 bg-black/20 border border-border/50 rounded px-2 py-1 text-white text-xs placeholder-text-secondary focus:border-accent/50 focus:outline-none transition-colors min-w-0"
        />
        <button
          onClick={commit}
          disabled={saving}
          className="text-accent text-xs px-1.5 py-1 hover:text-accent-hover transition-colors shrink-0"
          title="Guardar nota"
        >
          {saving ? '...' : '✓'}
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-left w-full group/note"
        title="Editar nota"
      >
        {note ? (
          <span className="text-xs text-text-secondary truncate flex-1">{note}</span>
        ) : (
          <span className="text-xs text-text-secondary/50 italic flex-1">Agregar nota...</span>
        )}
        <span className="text-text-secondary/50 group-hover/note:text-text-secondary transition-colors text-xs shrink-0">✏️</span>
      </button>
    </div>
  );
}

// ─── Payments Tab ────────────────────────────────────────────────────────────

function PaymentsTab({ studentId }: { studentId: string }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const minYear = 2026;
  const maxYear = Math.max(currentYear, minYear);
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const [year, setYear] = useState(currentYear >= minYear ? currentYear : minYear);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [savingNote, setSavingNote] = useState<number | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/students/${studentId}/payments?year=${year}`);
    const data = await res.json();
    setPayments(data);
    setLoading(false);
  }, [studentId, year]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  async function toggle(month: number) {
    setToggling(month);
    const res = await fetch(`/api/students/${studentId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPayments((prev) => {
        const filtered = prev.filter((p) => p.month !== month);
        return [...filtered, updated];
      });
    }
    setToggling(null);
  }

  async function saveNote(month: number, note: string) {
    setSavingNote(month);
    await fetch(`/api/students/${studentId}/payments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, note }),
    });
    setPayments((prev) =>
      prev.map((p) => (p.month === month ? { ...p, note } : p))
    );
    setSavingNote(null);
  }

  const getPayment = (month: number) => payments.find((p) => p.month === month);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-text-secondary text-sm">Año:</span>
        <div className="flex gap-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                y === year
                  ? 'bg-accent text-black'
                  : 'border border-border text-text-secondary hover:text-white hover:border-white/30'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Cargando pagos...</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {MONTHS.map((monthName, idx) => {
            const month = idx + 1;
            const payment = getPayment(month);
            const paid = payment?.paid ?? false;
            const isCurrentPeriod = year === currentYear && month === currentMonth;
            const isBusy = toggling === month;

            return (
              <div
                key={month}
                className={`relative rounded-xl border transition-all text-left ${
                  paid
                    ? 'bg-green-500/15 border-green-500/40'
                    : 'bg-surface border-border'
                } ${
                  isCurrentPeriod
                    ? 'border-2 border-dashed border-amber-400'
                    : ''
                }`}
              >
                <button
                  onClick={() => toggle(month)}
                  disabled={isBusy}
                  className="w-full p-3 text-left"
                >
                  <p
                    className={`text-xs font-medium mb-1 ${
                      isCurrentPeriod ? 'text-amber-400' : 'text-text-secondary'
                    }`}
                  >
                    {SHORT_MONTHS[idx]}
                    {isCurrentPeriod && (
                      <span className="ml-1 text-amber-400 text-xs">← hoy</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    {isBusy ? (
                      <span className="text-text-secondary text-sm">...</span>
                    ) : paid ? (
                      <>
                        <span className="text-green-400 text-sm">✓</span>
                        <span className="text-green-400 text-xs font-medium">Pago</span>
                      </>
                    ) : (
                      <>
                        <span className="text-text-secondary text-sm">○</span>
                        <span className="text-text-secondary text-xs">Pendiente</span>
                      </>
                    )}
                  </div>
                  {paid && payment?.paidAt && (
                    <p className="text-xs text-text-secondary mt-1">
                      {new Date(payment.paidAt).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  )}
                </button>

                {paid && (
                  <NoteCell
                    note={payment?.note ?? ''}
                    saving={savingNote === month}
                    onSave={(note) => saveNote(month, note)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Notas y Lesiones Tab ─────────────────────────────────────────────────────

function NotasLesionesTab({ studentId }: { studentId: string }) {
  // Notes
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  // Aspects
  const [aspects, setAspects] = useState<StudentAspect[]>([]);
  const [aspectContent, setAspectContent] = useState('');
  const [loadingAspects, setLoadingAspects] = useState(true);
  const [addingAspect, setAddingAspect] = useState(false);

  const fetchNotes = useCallback(async () => {
    const res = await fetch(`/api/students/${studentId}/notes`);
    const data = await res.json();
    setNotes(data);
    setLoadingNotes(false);
  }, [studentId]);

  const fetchAspects = useCallback(async () => {
    const res = await fetch(`/api/students/${studentId}/aspects`);
    const data = await res.json();
    setAspects(data);
    setLoadingAspects(false);
  }, [studentId]);

  useEffect(() => { fetchNotes(); fetchAspects(); }, [fetchNotes, fetchAspects]);

  async function addNote() {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    const res = await fetch(`/api/students/${studentId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteContent.trim() }),
    });
    if (res.ok) {
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      setNoteContent('');
    }
    setAddingNote(false);
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/students/${studentId}/notes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId }),
    });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  async function addAspect() {
    if (!aspectContent.trim()) return;
    setAddingAspect(true);
    const res = await fetch(`/api/students/${studentId}/aspects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: aspectContent.trim() }),
    });
    if (res.ok) {
      const aspect = await res.json();
      setAspects((prev) => [...prev, aspect]);
      setAspectContent('');
    }
    setAddingAspect(false);
  }

  async function deleteAspect(aspectId: string) {
    const res = await fetch(`/api/students/${studentId}/aspects`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aspectId }),
    });
    if (res.ok) setAspects((prev) => prev.filter((a) => a.id !== aspectId));
  }

  return (
    <div className="space-y-8">
      {/* Lesiones / Aspectos */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Lesiones y limitaciones</h3>
        <p className="text-text-secondary text-xs mb-4">
          Aspectos a tener en cuenta (lesiones, preferencias, limitaciones físicas…)
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={aspectContent}
            onChange={(e) => setAspectContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAspect(); } }}
            placeholder="Ej: rodilla derecha frágil..."
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
          />
          <button
            onClick={addAspect}
            disabled={addingAspect || !aspectContent.trim()}
            className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
          >
            {addingAspect ? '...' : 'Agregar'}
          </button>
        </div>

        {loadingAspects ? (
          <p className="text-text-secondary text-sm">Cargando...</p>
        ) : aspects.length === 0 ? (
          <p className="text-text-secondary text-sm">Sin aspectos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {aspects.map((aspect) => (
              <li
                key={aspect.id}
                className="bg-surface border border-border rounded-lg px-4 py-3 flex items-start justify-between gap-3 group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">▸</span>
                  <p className="text-white text-sm">{aspect.content}</p>
                </div>
                <button
                  onClick={() => deleteAspect(aspect.id)}
                  className="text-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 text-sm"
                  title="Eliminar"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notas */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Notas del entrenador</h3>

        <div className="space-y-2 mb-4">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Agregar una nota sobre este alumno..."
            rows={3}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors resize-none"
          />
          <button
            onClick={addNote}
            disabled={addingNote || !noteContent.trim()}
            className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {addingNote ? 'Agregando...' : 'Agregar nota'}
          </button>
        </div>

        {loadingNotes ? (
          <p className="text-text-secondary text-sm">Cargando notas...</p>
        ) : notes.length === 0 ? (
          <p className="text-text-secondary text-sm py-4">Sin notas todavía.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-surface border border-border rounded-lg px-4 py-3 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary mb-1.5">
                      {new Date(note.createdAt).toLocaleString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-white text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Eliminar nota"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plans Tab ───────────────────────────────────────────────────────────────

function PlansTab({ studentId }: { studentId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [basedOnPlanId, setBasedOnPlanId] = useState('');

  const fetchPlans = useCallback(async () => {
    const res = await fetch(`/api/students/${studentId}/plans`);
    const data = await res.json();
    setPlans(data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  function resetForm() {
    setShowNewForm(false);
    setNewName('');
    setCopyMode(false);
    setBasedOnPlanId('');
  }

  async function createPlan() {
    if (!newName.trim()) return;
    setCreating(true);
    const body: Record<string, string> = { name: newName.trim() };
    if (copyMode && basedOnPlanId) body.basedOnPlanId = basedOnPlanId;
    const res = await fetch(`/api/students/${studentId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const plan = await res.json();
      setPlans((prev) => [plan, ...prev]);
      resetForm();
    }
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      {showNewForm ? (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createPlan(); } if (e.key === 'Escape') resetForm(); }}
              placeholder="Nombre del plan..."
              autoFocus
              className="flex-1 bg-bg border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setCopyMode((c) => !c); setBasedOnPlanId(''); }}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                copyMode
                  ? 'bg-accent/20 border-accent/50 text-accent'
                  : 'border-border text-text-secondary hover:text-white hover:border-white/30'
              }`}
            >
              Copiar desde plan existente
            </button>
            {copyMode && plans.length > 0 && (
              <select
                value={basedOnPlanId}
                onChange={(e) => setBasedOnPlanId(e.target.value)}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
              >
                <option value="">Seleccioná un plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={createPlan}
              disabled={creating || !newName.trim() || (copyMode && !basedOnPlanId)}
              className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
            >
              {creating ? '...' : 'Crear'}
            </button>
            <button
              onClick={resetForm}
              className="text-text-secondary hover:text-white px-2 transition-colors text-sm shrink-0"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          + Nuevo plan
        </button>
      )}

      {loading ? (
        <p className="text-text-secondary text-sm">Cargando planes...</p>
      ) : plans.length === 0 ? (
        <p className="text-text-secondary text-sm py-4">Sin planes todavía. Creá el primero.</p>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/students/${studentId}/plans/${plan.id}`}
              className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3 hover:border-accent/50 hover:bg-surface-elevated transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white group-hover:text-accent transition-colors truncate">
                  {plan.name}
                </p>
                <p className="text-text-secondary text-xs mt-0.5">
                  {new Date(plan.createdAt).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    plan.status === 'published'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {plan.status === 'published' ? 'Publicado' : 'Borrador'}
                </span>
                <span className="text-text-secondary group-hover:text-accent transition-colors text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ studentId }: { studentId: string }) {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/students/${studentId}/sessions`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentId]);

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }

  if (loading) {
    return <p className="text-text-secondary text-sm">Cargando historial...</p>;
  }

  if (sessions.length === 0) {
    return (
      <p className="text-text-secondary text-sm py-4">
        Sin sesiones registradas todavía. El alumno irá acumulando su historial de entrenamiento acá.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-text-secondary text-xs">{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} registrada{sessions.length !== 1 ? 's' : ''}</p>
      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const totalEx = session.blocks.reduce((acc, b) => acc + b.exercises.length, 0);
        const doneEx = session.blocks.reduce((acc, b) => acc + b.exercises.filter((e) => e.done).length, 0);

        return (
          <div
            key={session.id}
            className="bg-surface border border-border rounded-xl overflow-hidden"
          >
            <button
              className="w-full text-left px-4 py-3 hover:bg-surface-elevated transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white text-sm truncate">
                    {session.planName} · {session.dayName}
                  </p>
                  <p className="text-text-secondary text-xs mt-0.5">
                    {new Date(session.startedAt).toLocaleString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {formatDuration(session.durationSeconds)}
                    {' · '}
                    {doneEx}/{totalEx} ejercicios
                  </p>
                </div>
                <span className="text-text-secondary text-sm shrink-0">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-4">
                {session.generalNote && (
                  <p className="text-xs text-text-secondary italic bg-surface-elevated px-3 py-2 rounded-lg">
                    &ldquo;{session.generalNote}&rdquo;
                  </p>
                )}
                {session.blocks.map((block) => (
                  <div key={block.planBlockId}>
                    <p className="text-xs font-bold uppercase tracking-wider text-accent mb-2">
                      {block.name}
                    </p>
                    <div className="space-y-1.5">
                      {block.exercises.map((ex) => (
                        <div
                          key={ex.planExerciseId}
                          className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-elevated/50"
                        >
                          <span
                            className="text-xs mt-0.5 font-bold shrink-0"
                            style={{ color: ex.done ? '#a3e635' : '#555' }}
                          >
                            {ex.done ? '✓' : '○'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{ex.exerciseName}</p>
                            {ex.sets.filter((s) => !s.done).length > 0 && (
                              <p className="text-xs text-text-secondary mt-0.5">
                                {ex.sets
                                  .filter((s) => !s.done)
                                  .map((s) => {
                                    const reps = s.actualReps || s.targetReps;
                                    const w = s.actualWeight ?? s.targetWeight;
                                    return w ? `${reps}×${w}kg` : reps;
                                  })
                                  .join(' / ')}
                              </p>
                            )}
                            {ex.studentNote && (
                              <p className="text-xs text-text-secondary italic mt-0.5">
                                {ex.studentNote}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Consultas Tab ───────────────────────────────────────────────────────────

function ConsultasTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<StudentFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/students/${studentId}/feedback`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.feedback ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentId]);

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    const res = await fetch(`/api/students/${studentId}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedbackId: id }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m));
    }
    setMarkingId(null);
  }

  if (loading) {
    return <p className="text-text-secondary text-sm">Cargando consultas...</p>;
  }

  const unread = items.filter((m) => !m.read);
  const read = items.filter((m) => m.read);

  if (items.length === 0) {
    return (
      <p className="text-text-secondary text-sm py-4">
        El alumno todavía no envió ninguna consulta.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {unread.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent mb-3">
            Sin leer ({unread.length})
          </p>
          <div className="space-y-2">
            {unread.map((msg) => (
              <div
                key={msg.id}
                className="bg-surface border border-accent/40 rounded-xl px-4 py-3"
              >
                <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                <div className="flex items-center justify-between mt-2 gap-3">
                  <p className="text-xs text-text-secondary">
                    {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <button
                    onClick={() => handleMarkRead(msg.id)}
                    disabled={markingId === msg.id}
                    className="text-xs text-accent hover:underline disabled:opacity-50"
                  >
                    {markingId === msg.id ? '...' : 'Marcar como leído'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {read.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
            Leídas ({read.length})
          </p>
          <div className="space-y-2">
            {read.map((msg) => (
              <div
                key={msg.id}
                className="bg-surface border border-border rounded-xl px-4 py-3"
              >
                <p className="text-sm text-text-secondary leading-relaxed">{msg.content}</p>
                <p className="text-xs text-text-secondary/50 mt-2">
                  {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('perfil');

  useEffect(() => {
    fetch(`/api/students/${studentId}`)
      .then((r) => r.json())
      .then((data) => {
        setStudent(data);
        setLoading(false);
      });
  }, [studentId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse mb-4" />
        <div className="h-4 w-32 bg-surface-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8">
        <p className="text-red-400">Alumno no encontrado</p>
        <Link href="/students" className="text-accent hover:underline text-sm mt-2 block">
          Volver a alumnos
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'pagos', label: 'Pagos' },
    { id: 'notas-lesiones', label: 'Notas y Lesiones' },
    { id: 'planes', label: 'Planes' },
    { id: 'historial', label: 'Historial' },
    { id: 'consultas', label: 'Consultas' },
  ];

  return (
    <div className="p-8 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/students" className="text-text-secondary hover:text-white transition-colors">
          Alumnos
        </Link>
        <span className="text-border">/</span>
        <span className="text-white font-medium">
          {student.name} {student.surname}
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {student.name} {student.surname}
          {student.apodo && (
            <span className="ml-2 text-text-secondary font-normal text-lg">
              &ldquo;{student.apodo}&rdquo;
            </span>
          )}
        </h1>
        {student.phone && (
          <p className="text-text-secondary text-sm mt-1">{student.phone}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'perfil' && (
        <ProfileTab student={student} onUpdate={setStudent} />
      )}
      {activeTab === 'pagos' && <PaymentsTab studentId={studentId} />}
      {activeTab === 'notas-lesiones' && <NotasLesionesTab studentId={studentId} />}
      {activeTab === 'planes' && <PlansTab studentId={studentId} />}
      {activeTab === 'historial' && <HistoryTab studentId={studentId} />}
      {activeTab === 'consultas' && <ConsultasTab studentId={studentId} />}
    </div>
  );
}
