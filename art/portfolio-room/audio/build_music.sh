#!/bin/sh
# Background music for /portfolio/7 (streamed, looped quietly under the typing).
# Run: sh art/portfolio-room/audio/build_music.sh   (macOS afconvert)
#
# Source: "Acid Jazz Rainy Night" by Alex Morgan, Pixabay Music,
# https://pixabay.com/music/modern-jazz-acid-jazz-rainy-night-552299/
# (Pixabay Content License: free to use, no attribution required). Download the
# MP3 to art/portfolio-room/audio/source/ (git-ignored).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../../public/audio/portfolio-room/music.m4a"
mkdir -p "$(dirname "$OUT")"
afconvert -f m4af -d aac -b 112000 "$HERE/source/alex-morgan-acid-jazz-rainy-night-552299.mp3" "$OUT"
ls -l "$OUT"
