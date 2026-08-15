#!/usr/bin/env bash
# Regenerates static/og.png (1200x630 Open Graph card).
#
# Rendered through CoreText because Thai needs complex-script shaping — tone marks
# and upper vowels stack above the base glyph, and renderers without shaping (PIL
# without raqm, for one) place them beside it instead. Fonts are fetched as TTF
# because Fontsource ships woff2, which CoreText cannot load.
set -euo pipefail
cd "$(dirname "$0")/.."

FONTS="$(mktemp -d)"
trap 'rm -rf "$FONTS"' EXIT

for f in ofl/prompt/Prompt-Bold.ttf ofl/prompt/Prompt-SemiBold.ttf \
         ofl/ibmplexsansthai/IBMPlexSansThai-Regular.ttf; do
  curl -sfL -o "$FONTS/$(basename "$f")" "https://raw.githubusercontent.com/google/fonts/main/$f"
done

swift tools/og-image.swift "$FONTS" "$FONTS/og.png"

# JPEG at q88 is visually identical here and ~11% of the PNG size — the card is a
# smooth gradient, which PNG encodes badly.
sips -s format jpeg -s formatOptions 88 "$FONTS/og.png" --out static/og.jpg >/dev/null
echo "wrote static/og.jpg"
