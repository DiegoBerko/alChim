const VERSION_URL =
  'https://raw.githubusercontent.com/DiegoBerko/nutria-privacy/main/alchim-version.json';

export const APP_VERSION = '1';

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
