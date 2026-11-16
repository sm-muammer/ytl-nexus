#!/usr/bin/env bash
# build-nexus-skin.sh: compiles the Roundcube child skin 'nexus' styles into styles.min.css.
# Usage: scripts/mail/build-nexus-skin.sh [roundcube-source-dir]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

RC_DIR="${1:-/Users/muammer/.gemini/antigravity/brain/40c9f48a-331d-44d2-add9-03b7d9547d36/scratch/rc/roundcubemail-1.7.6}"

if [ ! -d "$RC_DIR/skins/elastic/styles" ]; then
  echo "build-nexus-skin: Elastic skin styles not found at $RC_DIR/skins/elastic/styles" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cp -r "$RC_DIR/skins/elastic/styles" "$TMP_DIR/"
cp "$ROOT/roundcube/skins/nexus/styles/_variables.less" "$TMP_DIR/styles/_variables.less"
cp "$ROOT/roundcube/skins/nexus/styles/_styles.less" "$TMP_DIR/styles/_styles.less"

mkdir -p "$ROOT/roundcube/skins/nexus/styles"
npx lessc --include-path="$TMP_DIR/styles:$RC_DIR/skins/elastic/styles" \
  "$TMP_DIR/styles/styles.less" "$ROOT/roundcube/skins/nexus/styles/styles.min.css"

echo "Compiled styles.min.css:"
ls -lh "$ROOT/roundcube/skins/nexus/styles/styles.min.css"
shasum -a 256 "$ROOT/roundcube/skins/nexus/styles/styles.min.css"
