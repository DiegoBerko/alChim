#!/bin/bash
# Uso: ./scripts/build-and-publish.sh ["descripción de cambios"]
set -e

CHANGELOG="${1:-}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# 1. Timestamp como versión
VERSION=$(date +%Y%m%d-%H%M)
echo "export const APP_VERSION = '$VERSION';" > src/config/version.ts
echo "📌 Versión: $VERSION"

# 2. JS Bundle
echo ""
echo "🔨 Bundleando JS..."
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# 3. APK
echo ""
echo "🔨 Compilando APK..."
(cd android && ./gradlew assembleRelease --quiet)

APK="android/app/build/outputs/apk/release/app-release.apk"
echo "✅ APK listo: $APK"

# 4. Subir a Drive (elimina el anterior para evitar duplicados)
echo ""
echo "⬆️  Subiendo APK a Drive..."
rclone delete "gdrive:alChim_APK/app-release.apk" --drive-use-trash=false 2>/dev/null || true
rclone copy "$APK" gdrive:alChim_APK/ --progress

# 5. Obtener URL directa de descarga
SHARE_URL=$(rclone link "gdrive:alChim_APK/app-release.apk")
if echo "$SHARE_URL" | grep -q "id="; then
  FILE_ID=$(echo "$SHARE_URL" | grep -oE 'id=[^&]+' | cut -d= -f2)
else
  FILE_ID=$(echo "$SHARE_URL" | grep -oE '/d/[^/]+' | cut -d/ -f3)
fi
DIRECT_URL="https://drive.usercontent.google.com/download?id=$FILE_ID&export=download&authuser=0&confirm=t"
echo "🔗 URL APK: $DIRECT_URL"

# 6. Actualizar alchim-version.json en nutria-privacy via SSH
echo ""
echo "📝 Actualizando version.json en nutria-privacy..."
PRIVACY_TMP=$(mktemp -d)
git clone git@github.com:DiegoBerko/nutria-privacy.git "$PRIVACY_TMP" --quiet
printf '{"version":"%s","url":"%s","changelog":"%s"}' "$VERSION" "$DIRECT_URL" "$CHANGELOG" > "$PRIVACY_TMP/alchim-version.json"
cd "$PRIVACY_TMP" && git add alchim-version.json && git commit -m "alchim release: $VERSION" --quiet && git push --quiet
cd "$PROJECT_DIR"
rm -rf "$PRIVACY_TMP"
echo "✅ version.json actualizado"

echo ""
echo "✅ ¡Publicado!"
echo "   Versión:  $VERSION"
echo "   APK:      $DIRECT_URL"
