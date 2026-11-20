"""Cuts a seamless typing loop for /portfolio/7 from a real keyboard recording.
Run: python3 art/portfolio-room/audio/build_typing.py   (needs numpy, scipy; afconvert or ffmpeg)

Source (CC0, no attribution required): "Mechanical Keyboard Typing (Treble
Version)" by stu556, https://freesound.org/people/stu556/sounds/450282/
(Leopold FC660M, MX Browns). Download it to
art/portfolio-room/audio/source/450282__stu556__mechanical-keyboard-typing-treble-version.wav
(git-ignored: 32 MB).

Picks the steadiest ~60 s of typing (no long pauses), cuts both ends in the
quiet between keystrokes so the loop point is inaudible, normalises loudness
and writes public/audio/portfolio-room/typing.m4a (AAC, stereo).
"""
from pathlib import Path
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

HERE = Path(__file__).resolve().parent
SRC = HERE / 'source/450282__stu556__mechanical-keyboard-typing-treble-version.wav'
OUT = HERE.parents[2] / 'public/audio/portfolio-room/typing.m4a'
LOOP_S = 60.0

sr, raw = wavfile.read(SRC)
x = raw.astype(np.float32) / 32768
mono = x.mean(1)
hp = sosfilt(butter(2, 120, 'hp', fs=sr, output='sos'), mono)
hop = int(sr * 0.002)  # 2 ms envelope frames
env = np.sqrt(np.convolve(hp ** 2, np.ones(hop) / hop, 'same'))[::hop]
floor = np.percentile(env, 30)
on = np.where((env > floor * 6) & (np.roll(env, 1) <= floor * 6))[0]
on = on[np.diff(on, prepend=-999) > 25] * 0.002  # onset times (s), 50 ms apart

# The steadiest window: no gap over 0.7 s, most even keystroke rate.
best = None
for t0 in np.arange(1.0, len(mono) / sr - LOOP_S - 1.0, 0.5):
    w = on[(on >= t0) & (on < t0 + LOOP_S)]
    if len(w) < 2:
        continue
    gaps = np.diff(w)
    if gaps.max() > 0.7:
        continue
    per_s = np.histogram(w, bins=int(LOOP_S), range=(t0, t0 + LOOP_S))[0]
    score = per_s.std()
    if best is None or score < best[0]:
        best = (score, t0)
if best is None:
    raise SystemExit('no steady window found')
t0 = best[1]


def quiet_point(t, search=0.4):
    """The quietest 20 ms around t (between keystrokes)."""
    a, b = int((t - search) / 0.002), int((t + search) / 0.002)
    k = 10
    seg = np.convolve(env[a:b], np.ones(k) / k, 'same')
    return (a + int(np.argmin(seg))) * 0.002


start, end = quiet_point(t0), quiet_point(t0 + LOOP_S)
clip = x[int(start * sr):int(end * sr)].copy()
# Tiny fades at the cut (it is already near silence there).
f = int(sr * 0.008)
ramp = np.linspace(0, 1, f)[:, None]
clip[:f] *= ramp
clip[-f:] *= ramp[::-1]
# Normalise: peak to -3 dBFS.
clip *= 10 ** (-3 / 20) / np.abs(clip).max()

tmp = HERE / 'source/typing-loop.wav'
wavfile.write(tmp, sr, (clip * 32767).astype(np.int16))
OUT.parent.mkdir(parents=True, exist_ok=True)
# AAC in .m4a plays in every browser. macOS's afconvert, else ffmpeg.
try:
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '112000', str(tmp), str(OUT)], check=True)
except (FileNotFoundError, subprocess.CalledProcessError):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-c:a', 'aac', '-b:a', '112k',
                    '-movflags', '+faststart', str(OUT)], check=True)
w = on[(on >= start) & (on < end)]
print(f'LOOP {start:.2f}-{end:.2f}s ({end - start:.1f}s), {len(w) / (end - start):.1f} keys/s, '
      f'max gap {np.diff(w).max():.2f}s -> {OUT.name} {OUT.stat().st_size} bytes')
