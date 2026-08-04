const VERSION_URL =
  'https://raw.githubusercontent.com/DiegoBerko/nutria-privacy/main/alchim-version.json';

import { APP_VERSION as CONFIG_VERSION } from '../config/version';
export const APP_VERSION = CONFIG_VERSION;

export interface VersionInfo {
  version: string;
  url: string;
  changelog?: string;
}

export async function checkForUpdate(): Promise<VersionInfo | null> {
  const res = await fetch(VERSION_URL + '?t=' + Date.now(), {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });
  if (!res.ok) throw new Error('No se pudo verificar actualizaciones');
  const info: VersionInfo = await res.json();
  return info.version > APP_VERSION ? info : null;
}
