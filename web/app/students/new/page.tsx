'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ExtraField {
  key: string;
  value: string;
}

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ linkCode: string; name: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    surname: '',
    phone: '',
    weight: '',
    gender: '',
  });
  const [extraFields, setExtraFields] = useState<ExtraField[]>([]);

  function addExtraField() {
    setExtraFields((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeExtraField(idx: number) {
    setExtraFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateExtraField(idx: number, field: 'key' | 'value', val: string) {
    setExtraFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const extraData: Record<string, string> = {};
    extraFields.forEach(({ key, value }) => {
      if (key.trim()) extraData[key.trim()] = value;
    });

    const payload = {
      name: form.name.trim(),
      surname: form.surname.trim(),
      ...(form.phone && { phone: form.phone.trim() }),
      ...(form.weight && { weight: parseFloat(form.weight) }),
      ...(form.gender && { gender: form.gender }),
      ...(Object.keys(extraData).length > 0 && { extraData }),
    };

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al crear el alumno');
        setLoading(false);
        return;
      }

      const student = await res.json();
      setSuccess({ linkCode: student.linkCode, name: student.name });
    } catch {
      setError('Error de conexión');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-8 max-w-xl">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
          <p className="text-green-400 font-semibold text-lg mb-1">
            ✓ Alumno creado exitosamente
          </p>
          <p className="text-text-secondary text-sm mb-4">
            {success.name} ha sido agregado al sistema.
          </p>
          <div className="bg-surface rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary mb-0.5">Código de acceso</p>
              <p className="font-mono text-xl font-bold text-accent tracking-widest">
                {success.linkCode}
              </p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(success.linkCode)}
              className="text-text-secondary hover:text-white transition-colors text-lg"
              title="Copiar código"
            >
              📋
            </button>
          </div>
          <div className="flex gap-3 mt-4">
            <Link
              href="/students"
              className="flex-1 text-center border border-border text-text-secondary hover:text-white hover:border-white/30 py-2 rounded-lg text-sm transition-colors"
            >
              Ver todos los alumnos
            </Link>
            <button
              onClick={() => {
                setSuccess(null);
                setForm({ name: '', surname: '', phone: '', weight: '', gender: '' });
                setExtraFields([]);
              }}
              className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              Crear otro alumno
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/students"
          className="text-text-secondary hover:text-white transition-colors text-sm"
        >
          ← Alumnos
        </Link>
        <span className="text-border">/</span>
        <span className="text-sm text-white">Nuevo alumno</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Nuevo alumno</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Nombre <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              placeholder="Juan"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Apellido <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={form.surname}
              onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
              required
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
              placeholder="Pérez"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Teléfono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
            placeholder="+54 11 1234-5678"
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
              placeholder="75"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Género</label>
            <select
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white focus:border-accent focus:outline-none transition-colors"
            >
              <option value="">Sin especificar</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
              <option value="No especifica">No especifica</option>
            </select>
          </div>
        </div>

        {/* Extra fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-text-secondary">Datos adicionales</label>
            <button
              type="button"
              onClick={addExtraField}
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
                    onChange={(e) => updateExtraField(idx, 'key', e.target.value)}
                    placeholder="Campo"
                    className="w-1/3 bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => updateExtraField(idx, 'value', e.target.value)}
                    placeholder="Valor"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraField(idx)}
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

        <div className="flex gap-3 pt-2">
          <Link
            href="/students"
            className="flex-1 text-center border border-border text-text-secondary hover:text-white hover:border-white/30 py-2.5 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-accent hover:bg-accent-hover text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Creando...' : 'Crear alumno'}
          </button>
        </div>
      </form>
    </div>
  );
}
