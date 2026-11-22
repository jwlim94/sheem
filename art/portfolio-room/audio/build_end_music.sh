#!/bin/sh
# The ending's music for /portfolio/7 (his room at Christmas; streamed,
# looped). Run: sh art/portfolio-room/audio/build_end_music.sh   (macOS
# afconvert, python3 with numpy)
#
# Source: "Christmas Jazz" by AtlasAudio, Pixabay Music (Pixabay Content
# License: free to use, no attribution required; credited anyway), track
# 621548 (the user's pick, 2026-11-22). Download the MP3 to
# art/portfolio-room/audio/source/ (git-ignored). 92 s; it fades out and
# then runs on silent for about 3 s, which is cut (so the loop comes back
# round sooner). RMS -14.4 dB: the page plays it at 0.124 to sit as loud as
# the chapters' songs (audio.ts END_MUSIC).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
SRC="$HERE/source/atlasaudio-christmas-jazz-621548.mp3"
TMP=$(mktemp -d)
OUT="$HERE/../../../public/audio/portfolio-room/end-music.m4a"
afconvert -f WAVE -d LEI16@44100 "$SRC" "$TMP/full.wav"
python3 - "$TMP/full.wav" "$TMP/cut.wav" <<'PY'
import sys, wave
import numpy as np
src, dst = sys.argv[1:]
w = wave.open(src)
ch, sr, n = w.getnchannels(), w.getframerate(), w.getnframes()
a = np.frombuffer(w.readframes(n), dtype='<i2').reshape(-1, ch)
# The last 100 ms window louder than -55 dB, and a quarter second after it.
win = sr // 10
level = [np.sqrt(np.mean((a[i:i + win].astype(np.float32) / 32768) ** 2)) for i in range(0, len(a) - win, win)]
last = max(i for i, l in enumerate(level) if 20 * np.log10(l + 1e-12) > -55)
end = min(len(a), (last + 1) * win + sr // 4)
o = wave.open(dst, 'wb')
o.setnchannels(ch)
o.setsampwidth(2)
o.setframerate(sr)
o.writeframes(a[:end].tobytes())
print(f'cut {len(a) / sr:.1f} s to {end / sr:.1f} s')
PY
afconvert -f m4af -d aac -b 112000 "$TMP/cut.wav" "$OUT"
rm -rf "$TMP"
ls -l "$OUT"
