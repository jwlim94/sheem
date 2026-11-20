"""Trims the year counter's page turn for /portfolio/7 from a real recording.
Run: python3 art/portfolio-room/audio/build_page.py   (needs numpy, scipy)

Source (CC0, no attribution required): "Singular Page Turn" by Flem0527,
https://freesound.org/people/Flem0527/sounds/630019/ (one thin Bible page,
lifted and laid over). Download it to
art/portfolio-room/audio/source/630019__flem0527__singular-page-turn.wav
(git-ignored).

The recording is 1.04 s: the page lifts (a rising swish) and flaps over at
0.33 s, then 0.6 s of room tail. Keeps 0.2 s before the flap to 0.1 s after,
high-passed at 150 Hz (handling rumble), soft edges, peak-normalised to
-1 dBFS, and writes public/audio/portfolio-room/page.wav. Prints where the
flap sits in it (PAGE_PEAK in audio.ts), so the page can land it on the
digit's flip.
"""
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

HERE = Path(__file__).resolve().parent
SRC = HERE / 'source/630019__flem0527__singular-page-turn.wav'
OUT = HERE.parents[2] / 'public/audio/portfolio-room/page.wav'

sr, raw = wavfile.read(SRC)
x = raw.astype(np.float64) / np.iinfo(raw.dtype).max
mono = x.mean(1) if x.ndim > 1 else x
mono = sosfiltfilt(butter(2, 150, 'hp', fs=sr, output='sos'), mono)
hop = int(sr * 0.005)
env = np.sqrt(np.convolve(mono ** 2, np.ones(hop) / hop, 'same'))
peak = int(np.argmax(env))
a, b = max(0, peak - int(sr * 0.2)), min(len(mono), peak + int(sr * 0.1))
y = mono[a:b].copy()
fi, fo = int(sr * 0.03), int(sr * 0.06)
y[:fi] *= np.linspace(0, 1, fi) ** 2
y[-fo:] *= np.linspace(1, 0, fo) ** 2
y *= 10 ** (-1 / 20) / np.abs(y).max()
wavfile.write(OUT, sr, (y * 32767).astype(np.int16))
print(f'{OUT.name}: {len(y) / sr * 1000:.0f} ms at {sr} Hz, flap at {(peak - a) / sr:.3f} s')
