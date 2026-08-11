'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Student, Payment } from '@/lib/types';

function getCurrentMonthLabel() {
  const now = new Date();
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

function StudentCard({
  student,
  payments,
  currentMonth,
}: {
  student: Student;
  payments: Payment[];
  currentMonth: number;
}) {
  const paid = payments.find((p) => p.month === currentMonth)?.paid ?? false;

  return (
    <Link
      href={`/students/${student.id}`}
      className="block bg-surface border border-border rounded-xl p-5 hover:border-accent/50 hover:bg-surface-elevated transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-accent transition-colors truncate">
            {student.name} {student.surname}
            {student.apodo && (
              <span className="ml-2 text-text-secondary font-normal text-sm">
                &ldquo;{student.apodo}&rdquo;
              </span>
            )}
          </h3>
          {student.phone && (
            <p className="text-text-secondary text-sm mt-0.5">{student.phone}</p>
          )}
        </div>
        <div className="ml-4 flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              paid ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <span>{paid ? '✓' : '!'}</span>
            {paid ? getCurrentMonthLabel() : 'Pago pendiente'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-secondary font-mono bg-surface-elevated px-2 py-0.5 rounded border border-border">
          {student.linkCode}
        </span>
        {student.gender && (
          <span className="text-xs text-text-secondary">{student.gender}</span>
        )}
        {student.weight && (
          <span className="text-xs text-text-secondary">{student.weight} kg</span>
        )}
      </div>
    </Link>
  );
}

export default function StudentsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [students, setStudents] = useState<Student[]>([]);
  const [allPayments, setAllPayments] = useState<Record<string, Payment[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/students');
      if (!res.ok) { setLoading(false); return; }
      const data: Student[] = await res.json();
      setStudents(data);

      // Fetch payments for current month in parallel
      const paymentResults = await Promise.all(
        data.map((s) =>
          fetch(`/api/students/${s.id}/payments?year=${currentYear}`)
            .then((r) => r.json())
            .catch(() => [] as Payment[])
        )
      );

      const map: Record<string, Payment[]> = {};
      data.forEach((s, idx) => { map[s.id] = paymentResults[idx]; });
      setAllPayments(map);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.surname.toLowerCase().includes(q) ||
        (s.apodo && s.apodo.toLowerCase().includes(q))
      );
    });
  }, [students, search]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Alumnos</h1>
          <p className="text-text-secondary text-sm mt-1">
            {loading ? '...' : `${students.length} ${students.length === 1 ? 'alumno' : 'alumnos'}`}
          </p>
        </div>
        <Link
          href="/students/new"
          className="bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          + Nuevo alumno
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, apellido o apodo..."
          className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-white placeholder-text-secondary focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-20 text-text-secondary">
          <p className="text-4xl mb-4">👥</p>
          <p className="font-medium">Sin alumnos todavía</p>
          <p className="text-sm mt-1">Creá tu primer alumno para empezar.</p>
          <Link
            href="/students/new"
            className="inline-block mt-4 bg-accent hover:bg-accent-hover text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            + Nuevo alumno
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="font-medium">Sin resultados para &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              payments={allPayments[student.id] ?? []}
              currentMonth={currentMonth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
