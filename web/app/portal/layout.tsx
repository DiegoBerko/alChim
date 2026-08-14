'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPortalInfo, clearPortalSession } from '@/lib/student-session';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [studentName, setStudentName] = useState<string | null>(null);

  useEffect(() => {
    const info = getPortalInfo();
    if (info) {
      setStudentName(`${info.name} ${info.surname}`);
    }
  }, []);

  function handleLogout() {
    clearPortalSession();
    router.push('/portal');
  }

  const isLoginPage = pathname === '/portal';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0D0D0D', color: '#f5f5f5' }}>
      {!isLoginPage && (
        <header
          style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
          className="sticky top-0 z-50"
        >
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-xl font-bold" style={{ color: '#F5A623' }}>
              alChim ⚡
            </span>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1 rounded-md transition-colors"
              style={{ color: '#888', border: '1px solid #2a2a2a' }}
            >
              Cerrar sesión
            </button>
          </div>
          <nav
            className="max-w-lg mx-auto px-4 pb-2 flex gap-4"
            style={{ borderTop: '1px solid #2a2a2a' }}
          >
            <NavLink href="/portal/plans" current={pathname}>
              Mis planes
            </NavLink>
            <NavLink href="/portal/history" current={pathname}>
              Historial
            </NavLink>
            <NavLink href="/portal/feedback" current={pathname}>
              Consultas
            </NavLink>
          </nav>
        </header>
      )}

      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>

      {!isLoginPage && studentName && (
        <footer
          className="max-w-lg mx-auto px-4 py-4 text-center text-sm"
          style={{ color: '#888', borderTop: '1px solid #2a2a2a', marginTop: '2rem' }}
        >
          {studentName}
        </footer>
      )}
    </div>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: string;
  children: React.ReactNode;
}) {
  const isActive = current.startsWith(href);
  return (
    <Link
      href={href}
      className="text-sm py-1 font-medium transition-colors"
      style={{
        color: isActive ? '#F5A623' : '#888',
        borderBottom: isActive ? '2px solid #F5A623' : '2px solid transparent',
      }}
    >
      {children}
    </Link>
  );
}
