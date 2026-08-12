'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPortalCode, setPortalCode, setPortalInfo } from '@/lib/student-session';

export default function PortalLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const existing = getPortalCode();
    if (existing) {
      router.replace('/portal/plans');
    } else {
      setChecking(false);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/student/plans?code=${code.toUpperCase()}`);
      if (res.status === 404) {
        setError('Código no encontrado');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Error de conexión');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPortalCode(code.toUpperCase());
      setPortalInfo({ name: data.student.name, surname: data.student.surname });
      router.push('/portal/plans');
    } catch {
      setError('Error de conexión');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0D0D0D' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#F5A623', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0D0D0D' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#F5A623' }}>
            alChim
          </h1>
          <p className="text-sm" style={{ color: '#888' }}>
            Portal del alumno
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium mb-2"
              style={{ color: '#888' }}
            >
              Código de acceso
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                setCode(val);
                setError(null);
              }}
              placeholder="XXXXXX"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full px-4 py-3 rounded-xl text-center text-2xl font-mono tracking-widest outline-none transition-colors"
              style={{
                backgroundColor: '#242424',
                border: error ? '1px solid #ef4444' : '1px solid #2a2a2a',
                color: '#f5f5f5',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#F5A623';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = error ? '#ef4444' : '#2a2a2a';
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="w-full py-3 rounded-xl font-semibold text-base transition-opacity"
            style={{
              backgroundColor: '#F5A623',
              color: '#0D0D0D',
              opacity: code.length !== 6 || loading ? 0.5 : 1,
              cursor: code.length !== 6 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
