#!/bin/sh
# Chapter 1's music for /portfolio/7 (the lecture hall; streamed, looped).
# Run: sh art/portfolio-room/audio/build_school_music.sh   (macOS afconvert)
#
# Source: "Lofi Pop" by ZephiraMusic, Pixabay Music,
# https://pixabay.com/music/lofi-lofi-pop-611108/ (Pixabay Content License:
# free to use, no attribution required; credited anyway). Download the MP3 to
# art/portfolio-room/audio/source/ (git-ignored). Bright and light, it opens on
# a quiet intro as the chapter's card comes up: a fresh start.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../../public/audio/portfolio-room/school-music.m4a"
afconvert -f m4af -d aac -b 112000 "$HERE/source/zephiramusic-lofi-pop-611108.mp3" "$OUT"
ls -l "$OUT"
