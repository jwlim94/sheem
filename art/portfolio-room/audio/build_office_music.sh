#!/bin/sh
# Chapter 2's music for /portfolio/7 (the interview at Neighbor; streamed,
# looped). Run: sh art/portfolio-room/audio/build_office_music.sh   (macOS afconvert)
#
# Source: "Lofi Focus" by ZephiraMusic, Pixabay Music (Pixabay Content
# License: free to use, no attribution required; credited anyway), track
# 606303. Download the MP3 to art/portfolio-room/audio/source/ (git-ignored).
# Steady lofi, about as loud as chapter 1's "Lofi Pop" (RMS -16.8 dB).
# (2026-10-13: replaced leberch's "Interstellar", track 589820.)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../../public/audio/portfolio-room/office-music.m4a"
afconvert -f m4af -d aac -b 112000 "$HERE/source/zephiramusic-lofi-focus-606303.mp3" "$OUT"
ls -l "$OUT"
