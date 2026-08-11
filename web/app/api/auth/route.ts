import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, signToken, createSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!checkPassword(password)) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const token = await signToken({ role: 'admin' });
    const cookie = createSessionCookie(token);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2]);
    return res;
  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
