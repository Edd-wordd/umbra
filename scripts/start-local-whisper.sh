#!/bin/sh
set -eu
ROOT="$HOME/.local/share/umbra/voice"
exec "$ROOT/whisper.cpp/build/bin/whisper-server" --host 127.0.0.1 --port 8178 -m "$ROOT/ggml-base.en.bin" -t 4 -ng -nc
