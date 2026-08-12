import type { SessionBlock } from '@/lib/types';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const PORTAL_CODE_KEY = 'alchim_portal_code';
export const PORTAL_INFO_KEY = 'alchim_portal_info';
export const ACTIVE_SESSION_KEY = 'alchim_active_session';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PortalInfo {
  name: string;
  surname: string;
}

export interface ActiveSession {
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
  startedAt: number;
  pausedAt?: number;       // Date.now() when paused, undefined when running
  totalPausedMs?: number;  // accumulated paused milliseconds
  blocks: SessionBlock[];
  generalNote: string;
}

// ─── Portal code / info ──────────────────────────────────────────────────────

export function getPortalCode(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_CODE_KEY);
}

export function setPortalCode(code: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PORTAL_CODE_KEY, code);
}

export function getPortalInfo(): PortalInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PORTAL_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalInfo;
  } catch {
    return null;
  }
}

export function setPortalInfo(info: PortalInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PORTAL_INFO_KEY, JSON.stringify(info));
}

export function clearPortalSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PORTAL_CODE_KEY);
  localStorage.removeItem(PORTAL_INFO_KEY);
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

// ─── Active session ──────────────────────────────────────────────────────────

export function getActiveSession(): ActiveSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ActiveSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export function clearActiveSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}
