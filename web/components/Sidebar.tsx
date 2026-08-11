'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/students', label: 'Alumnos', icon: '👥' },
  { href: '/exercises', label: 'Ejercicios', icon: '🏋️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface border-r border-border min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-accent text-xl font-bold">alChim</span>
          <span className="text-accent text-xl">⚡</span>
        </div>
        <p className="text-text-secondary text-xs mt-1">Backoffice</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent text-black'
                  : 'text-text-secondary hover:text-white hover:bg-surface-elevated'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-surface-elevated transition-colors disabled:opacity-50"
        >
          <span>🚪</span>
          {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  );
}
