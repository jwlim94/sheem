"""Trims the wall clock's tick for /portfolio/7 from a real clock recording.
Run: python3 art/portfolio-room/audio/build_tick.py   (needs numpy, scipy)

Source (CC BY 3.0, credited on the page): "mab-clock-tick-1-20080713" by mab,
https://freesound.org/people/mab/sounds/57211/ (one tick of a wind-up travel
alarm clock, contact mic, 48 kHz). Download it to
art/portfolio-room/audio/source/57211__mab__mab-clock-tick-1-20080713.wav
(git-ignored). Its woody mid-range "tock" (centred near 2.3 kHz) suits a
wall clock; a wristwatch tick tried first (DrMinky #174721) was thin and
high (near 6.7 kHz) even pitched down.

Keeps 3 ms before the onset to 100 ms after (the click and its short ring),
mono, with soft edges, peak-normalised to -1 dBFS, and writes
public/audio/portfolio-room/tick.wav. A WAV (10 kB), not AAC, so there is no
encoder delay before the click: the page schedules it to the clock's second
hand to the sample, and adds a little room.
"""
from pathlib import Path
import numpy as np
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent
SRC = HERE / 'source/57211__mab__mab-clock-tick-1-20080713.wav'
OUT = HERE.parents[2] / 'public/audio/portfolio-room/tick.wav'

sr, raw = wavfile.read(SRC)
x = raw.astype(np.float32) / np.iinfo(raw.dtype).max
mono = x.mean(1) if x.ndim > 1 else x
hop = int(sr * 0.001)
env = np.sqrt(np.convolve(mono ** 2, np.ones(hop) / hop, 'same'))
onset = int(np.argmax(env > env.max() * 0.2))
a, b = max(0, onset - int(sr * 0.003)), min(len(mono), onset + int(sr * 0.1))
y = mono[a:b].copy()
fi, fo = int(sr * 0.001), int(sr * 0.03)
y[:fi] *= np.linspace(0, 1, fi)
y[-fo:] *= np.linspace(1, 0, fo) ** 2
y *= 10 ** (-1 / 20) / np.abs(y).max()
wavfile.write(OUT, sr, (y * 32767).astype(np.int16))
print(f'{OUT.name}: {len(y) / sr * 1000:.0f} ms at {sr} Hz, onset kept at 3 ms')
