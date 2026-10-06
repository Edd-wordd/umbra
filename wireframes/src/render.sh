#!/usr/bin/env bash
# Renders each frame HTML to PNG with headless Chrome at 1920x1080.
set -e
cd "$(dirname "$0")/.."
for f in idle dev-rail-awake voice-active astro-mode cmdk; do
  google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1920,1080 --virtual-time-budget=4000 --screenshot="$PWD/$f.png" "file://$PWD/$f.html#static" 2>/dev/null
done
ls -la *.png
