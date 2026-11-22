#!/bin/sh
# Chapter 4's music for /portfolio/7 (Bridge's office; streamed, looped).
# Run: sh art/portfolio-room/audio/build_bridge_music.sh   (macOS afconvert)
#
# Source: "Lofi Study Session" by Alex Morgan, Pixabay Music (Pixabay
# Content License: free to use, no attribution required; credited anyway),
# track 568160 (the user's pick, 2026-11-22). Download the MP3 to
# art/portfolio-room/audio/source/ (git-ignored). Warm, steady lofi with no
# quiet intro, mastered loud: RMS -12.8 dB, 4.4 dB over chapter 2's "Lofi
# Focus" (-17.2), so the page plays it lower (audio.ts BRIDGE_MUSIC).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../../public/audio/portfolio-room/bridge-music.m4a"
afconvert -f m4af -d aac -b 112000 "$HERE/source/alex-morgan-lofi-study-session-568160.mp3" "$OUT"
ls -l "$OUT"
