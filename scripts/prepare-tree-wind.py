"""Usage: python3 scripts/prepare-tree-wind.py decoded-preview.wav
Decode preserved MP3 with afconvert -f WAVE -d LEI16 first (macOS).
"""
import array
import math
import sys
import wave
from pathlib import Path

with wave.open(sys.argv[1]) as source:
    rate = source.getframerate()
    assert source.getsampwidth() == 2 and source.getnchannels() == 2
    pcm = array.array('h', source.readframes(source.getnframes()))
mono = [(pcm[i] + pcm[i + 1]) / 65536 for i in range(0, len(pcm), 2)]
# Remove rumble/harshness without synthesizing additional texture.
hp = math.exp(-2 * math.pi * 180 / rate)
lp = 1 - math.exp(-2 * math.pi * 6500 / rate)
previous = high = low = 0.0
filtered = []
for v in mono:
    high = hp * (high + v - previous)
    previous = v
    low += lp * (high - low)
    filtered.append(low)
x = filtered[int(2 * rate):int(26 * rate)]
f = rate  # one-second tail/head crossfade, without a silent seam
blend = [x[-f + i] * math.cos(i / (f - 1) * math.pi / 2) +
         x[i] * math.sin(i / (f - 1) * math.pi / 2) for i in range(f)]
y = x[f:-f] + blend
rms = math.sqrt(sum(v*v for v in y) / len(y))
gain = min(.055 / max(rms, 1e-9), .75 / max(map(abs, y)))
# Match loop endpoints with a tiny smooth DC correction over the final 5 ms.
seam = y[0] - y[-1]
k = int(rate * .005)
for i in range(k):
    t = i / (k - 1)
    y[-k + i] += seam * t * t * (3 - 2 * t)
result = array.array('h', (round(v * gain * 32767) for v in y))
path = Path('public/sounds/foliage/tree-wind-loop.wav')
with wave.open(str(path), 'wb') as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(rate)
    out.writeframes(result.tobytes())
print({'seconds': len(y)/rate, 'gain': gain, 'peak': max(map(abs, result))/32768,
       'seamDelta': abs(result[0]-result[-1])/32768})
