#!/usr/bin/env bash
# Install GPU Monitor extension locally into Cursor / VS Code.
# macOS / Linux only. Windows users: see README.
set -e
cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

echo "🔨 Compiling TypeScript..."
npm run compile

PUBLISHER="local"
NAME="gpu-monitor"
VERSION=$(node -p "require('./package.json').version")
EXT_ID="${PUBLISHER}.${NAME}-${VERSION}"

INSTALLED=0
for BASE_DIR in \
  "$HOME/.cursor/extensions" \
  "$HOME/.vscode/extensions"; do

  [ -d "$BASE_DIR" ] || continue

  DEST="${BASE_DIR}/${EXT_ID}"
  echo "📂 Installing to: $DEST"
  rm -rf "$DEST"
  mkdir -p "$DEST"

  cp -r out media package.json "$DEST/"

  # Copy runtime dependencies only
  mkdir -p "$DEST/node_modules"
  for DEP in ssh2 asn1 bcrypt-pbkdf safer-buffer tweetnacl cpu-features; do
    [ -d "node_modules/$DEP" ] && cp -r "node_modules/$DEP" "$DEST/node_modules/"
  done

  echo "✅ Installed to $DEST"
  INSTALLED=1
done

if [ "$INSTALLED" -eq 0 ]; then
  echo "❌ Neither ~/.cursor/extensions nor ~/.vscode/extensions found."
  echo "   Make sure Cursor or VS Code is installed first."
  exit 1
fi

echo ""
echo "🎉 Done! Restart Cursor / VS Code and look for the chip icon in the Activity Bar."
