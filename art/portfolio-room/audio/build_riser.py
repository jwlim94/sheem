"""The rewind's whoosh for /portfolio/7: sucked into the clock's dial.
Run: python3 art/portfolio-room/audio/build_riser.py   (numpy, scipy; afconvert or ffmpeg)

Source (CC0, no attribution required): "UPLIFTER WHITE NOISE REVERB" by
skyernaklea, https://freesound.org/people/skyernaklea/sounds/620818/ (a reversed
cymbal with reverb). Download it to art/portfolio-room/audio/source/ (git-ignored).

It builds from silence to a peak at 3.95 s, cuts, then rings out in reverb.
Only its last 1.4 s before the cut is kept (2.55-3.95 s), swelling from
near silence (a power-curve fade-in: the source only rises 6 dB there, so a
plain cut came in loud and read as two whooshes): one quick inhale the
camera is sucked in on, rather than a long build (all 7.5 s, tried first,
read as a generic riser pulling away from the clock). After the cut its
reverb rings out (the "shhaaa", to 6.6 s, faded over its last 0.5 s) under
the cream and the chapter card. Writes public/audio/portfolio-room/riser.m4a;
audio.ts plays it once, timed so the cut lands on the cream wash.
"""
from pathlib import Path
import subprocess
import numpy as np
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent
SRC = HERE / 'source/620818__skyernaklea__uplifter-white-noise-reverb.wav'
OUT = HERE.parents[2] / 'public/audio/portfolio-room/riser.m4a'

sr, x = wavfile.read(SRC)
x = x.astype(np.float32)
if x.dtype.kind == 'i':
    x /= 32768
clip = x[int(2.55 * sr):int(6.6 * sr)].copy()
rise = int(1.4 * sr)
clip[:rise] *= (np.linspace(0, 1, rise) ** 2.2)[:, None]  # one swell from silence
f = int(0.5 * sr)
clip[-f:] *= (np.linspace(1, 0, f) ** 2)[:, None]
clip *= 10 ** (-1 / 20) / np.abs(clip).max()  # peak -1 dBFS
tmp = HERE / 'source/riser-trim.wav'
wavfile.write(tmp, sr, (clip * 32767).astype(np.int16))
try:
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '128000', str(tmp), str(OUT)], check=True)
except (FileNotFoundError, subprocess.CalledProcessError):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-c:a', 'aac', '-b:a', '128k', str(OUT)],
                   check=True)
print('RISER', OUT.name, OUT.stat().st_size, 'bytes', round(len(clip) / sr, 2), 's')
