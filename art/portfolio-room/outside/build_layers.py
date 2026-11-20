"""Splits the Utah sunset photo into parallax layers for /portfolio/7's window.
Run: python3 art/portfolio-room/outside/build_layers.py
Source: source.jpg, "james-thompson-8FxINkpwHss" on Unsplash (Unsplash License).
Writes public/models/portfolio-room/outside/{sky.jpg, mountains.webp, trees.webp}.

Layers (by luminance, column by column):
  sky        everything above the ridge; the hidden part below is filled with the
             sky colour just above the ridge so parallax never reveals a hole.
  mountains  ridge down to the tree line (mountains + hazy valley), with the
             valley colour extended behind the trees.
  trees      the dark foreground tree line.
"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / 'public/models/portfolio-room/outside'
OUT.mkdir(parents=True, exist_ok=True)

img = np.asarray(Image.open(HERE / 'source.jpg').convert('RGB')).astype(np.float32) / 255
H, W, _ = img.shape
L = img.mean(2)


def blur_rows(a, k):
    """Box blur along axis 0."""
    c = np.cumsum(np.pad(a, ((k + 1, k),) + ((0, 0),) * (a.ndim - 1), mode='edge'), axis=0)
    return (c[2 * k + 1:] - c[:-2 * k - 1]) / (2 * k + 1)


def blur_cols(a, k):
    return blur_rows(a.swapaxes(0, 1), k).swapaxes(0, 1)


# Remove the airliner in the sky (small dark speck right of the peak).
py, px, r = 1150, 3900, 70
patch = img[py - r:py + r, px - 3 * r:px + 3 * r]
left, right = patch[:, :8].mean(1, keepdims=True), patch[:, -8:].mean(1, keepdims=True)
t = np.linspace(0, 1, patch.shape[1])[None, :, None]
img[py - r:py + r, px - 3 * r:px + 3 * r] = left * (1 - t) + right * t
L = img.mean(2)

Ls = blur_rows(L, 6)
rows = np.arange(H)[:, None]

# Ridge: first row (from the top) where the column turns dark and stays dark.
dark = (Ls < 0.235).astype(np.float32)
stays = blur_rows(dark, 30) > 0.95
ridge = np.argmax(stays & (rows > 1200), axis=0)
ridge = np.round(blur_cols(ridge[None, :].astype(np.float32), 3)[0]).astype(int)

# Tree line: last row (from the bottom) where the hazy valley is still visible.
valley = (Ls > 0.045).astype(np.float32)
stays_v = blur_rows(valley, 20) > 0.9
masked = stays_v & (rows < H - 50) & (rows > ridge[None, :] + 200)
treeline = H - 1 - np.argmax(masked[::-1], axis=0)
treeline = np.round(blur_cols(treeline[None, :].astype(np.float32), 25)[0]).astype(int)

# Soft alpha edges from luminance near each boundary.
a_mtn = np.clip((0.30 - L) / 0.1, 0, 1)
a_mtn = np.where(rows < ridge[None, :] - 25, 0, np.where(rows > ridge[None, :] + 25, 1, a_mtn))
a_tree = np.clip((0.07 - L) / 0.04, 0, 1)
a_tree = np.where(rows < treeline[None, :] - 30, 0, np.where(rows > treeline[None, :] + 30, 1, a_tree))

# Sky: fill below the ridge with the colour just above it, softened sideways.
sky = img.copy()
above = np.stack([img[max(0, r - 90):max(1, r - 60), x].mean(0) for x, r in enumerate(ridge)])
above = blur_cols(above[None], 250)[0]
fill = rows > (ridge[None, :] - 60)
sky = np.where(fill[..., None], above[None, :, :], sky)

# Mountains: extend the valley colour downward behind the trees.
mtn = img.copy()
vcol = np.stack([img[max(0, t - 80):max(1, t - 35), x].mean(0) for x, t in enumerate(treeline)])
vcol = blur_cols(vcol[None], 40)[0]
mtn = np.where((rows > treeline[None, :] - 35)[..., None], vcol[None, :, :], mtn)


def save(rgb, alpha, name, width):
    a = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    if alpha is None:
        im = Image.fromarray(a, 'RGB')
    else:
        im = Image.fromarray(np.dstack([a, (alpha * 255).astype(np.uint8)]), 'RGBA')
    im = im.resize((width, round(width * H / W)), Image.LANCZOS)
    path = OUT / name
    im.save(path, quality=88) if name.endswith('.jpg') else im.save(path, quality=90, method=6)
    print('LAYER', name, im.size, path.stat().st_size)


save(sky, None, 'sky.jpg', 2048)
save(mtn, a_mtn, 'mountains.webp', 4096)
save(img, a_tree, 'trees.webp', 3072)
print('RIDGE rows', ridge.min(), ridge.max(), 'TREELINE rows', treeline.min(), treeline.max())
print('SKY top', img[:200].reshape(-1, 3).mean(0).round(3), 'horizon', above.mean(0).round(3))
