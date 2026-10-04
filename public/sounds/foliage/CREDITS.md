# Foliage contact recordings

- Creator: **kyles**
- Original title: **foliage leaves rustle brush movement.flac**
- Source: https://freesound.org/people/kyles/sounds/637547/
- License: **CC0 1.0**, https://creativecommons.org/publicdomain/zero/1.0/
- Retrieved: 2026-10-03
- Download used: public high-quality MP3 preview,
  https://cdn.freesound.org/previews/637/637547_612689-hq.mp3
- This is derived from the MP3 preview, **not the login-only original FLAC**.
- Preserved download: `art/audio/foliage/kyles-637547-hq-preview.mp3`
- Runtime: six mono 48 kHz, 16-bit PCM WAVs, each 0.65 seconds.
- Processing: average stereo channels, 90 Hz high-pass, gentle 5.5 kHz
  low-pass, gain ×16, 50 ms onset / 120 ms release fades. No synthetic layers.
- Excerpts begin at 7.5, 20.5, 24, 29.5, 36.5 and 39.5 seconds in decoded MP3.
  Selection used moderate RMS and bounded transient peaks, not a listening certification.
- Per-file offsets, gain and measured peaks: `art/audio/foliage/segments.json`.
- Playback: 0.97–1.03 rate, 0.26–0.36 s minimum event spacing, max three voices.
  Gain is deliberately conservative and scales with actual contact.

CC0 does not require attribution; credit is retained for provenance.

## Wind-driven grass loop

- Creator: **Coral_Island_Studios**
- Title: **Rustling Field of Dried Grass.wav**
- Source: https://freesound.org/people/Coral_Island_Studios/sounds/387338/
- License: **CC0 1.0**, https://creativecommons.org/publicdomain/zero/1.0/
- Retrieved: 2026-10-04
- Download: https://cdn.freesound.org/previews/387/387338_5324256-hq.mp3
- Public high-quality MP3 preview, not the login-only original WAV.
- Preserved in `art/audio/foliage/coral-island-387338-hq-preview.mp3`.
- Runtime: `grass-wind-loop.wav`, mono 16-bit PCM, 10.5 seconds.
- Source describes dried grasslands blowing gently. Dry-grass texture is a trial
  for our stylized green grass; suitability requires listening feedback.
- Processing: excerpt 0.5–12 s, stereo average, 160 Hz high-pass / 5 kHz low-pass,
  one-second equal-power tail/head crossfade, RMS target 0.06 with peak cap 0.75,
  final 5 ms endpoint correction. Measured PCM peak 0.482; endpoints match.
- Reproduce: decode MP3 with `afconvert -f WAVE -d LEI16 source.mp3 decoded.wav`,
  then `python3 scripts/prepare-grass-wind.py decoded.wav` from repository root.
