#!/usr/bin/env bash
# Regenera los banners de LinkedIn desde banner.html.
# Geist va embebida en fonts-embedded.css: el render no depende de red.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

render() { # formato ancho alto idioma tema
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$2,$3" --virtual-time-budget=8000 \
    --screenshot="clavametrics-linkedin-$1-$5-$4.png" \
    "file://$PWD/banner.html?format=$1&lang=$4&theme=$5" 2>/dev/null
}

for T in light dark; do
  for L in es en pt none; do
    render company 1128 191 "$L" "$T"   # portada de página de empresa
    render profile 1584 396 "$L" "$T"   # portada de perfil personal
  done
done
echo "Listo — 16 PNG a 2x en $PWD"
