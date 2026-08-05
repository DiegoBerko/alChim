import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
import { APP_VERSION as CONFIG_VERSION } from '../config/version';

const VERSION_URL =
  'https://raw.githubusercontent.com/DiegoBerko/nutria-privacy/main/alchim-version.json';

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

export async function downloadAndInstall(
  url: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const destPath = `${RNFS.CachesDirectoryPath}/alchim-update.apk`;

  if (await RNFS.exists(destPath)) {
    await RNFS.unlink(destPath);
  }

  await RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    progress: ({ bytesWritten, contentLength }) => {
      if (contentLength > 0) {
        onProgress(Math.round((bytesWritten / contentLength) * 100));
      }
    },
    progressDivider: 5,
  }).promise;

  // Validar que es un APK real (mínimo 5MB) y no una página HTML de error
  const stat = await RNFS.stat(destPath);
  if (stat.size < 5 * 1024 * 1024) {
    await RNFS.unlink(destPath);
    throw new Error('La descarga falló — el archivo recibido no es un APK válido.');
  }

  NativeModules.ApkInstaller.install(destPath);
}
