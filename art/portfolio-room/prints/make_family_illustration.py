"""Turns the family mirror selfie into a flat, illustrated print for the room.
Run: python3 art/portfolio-room/prints/make_family_illustration.py
Input:  family-source.jpg (private, git-ignored)
Output: family-illustration.png (5:7, used by build_room.py)

Illustration look: edge-preserving smoothing, colour flattened into soft
bands, ink outlines from strong edges, warm paper tone. The Korean-flag
patches on the shirts are kept crisp (their regions skip the flattening).
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from skimage import color, filters, morphology, segmentation, transform

HERE = Path(__file__).resolve().parent
src = ImageOps.exif_transpose(Image.open(HERE / 'family-source.jpg')).convert('RGB')
W0, H0 = src.size
# Crop to the family in the mirror (5:7), background barely included.
x0, y0, x1 = int(0.23 * W0), int(0.19 * H0), int(0.82 * W0)
y1 = y0 + int((x1 - x0) * 7 / 5)
img = np.asarray(src.crop((x0, y0, x1, y1)).resize((800, 1120), Image.LANCZOS)).astype(np.float32) / 255

# Smooth, painterly flats: total-variation denoising removes texture and skin
# detail while keeping shapes; then a gentle tonal banding.
from skimage.restoration import denoise_tv_chambolle
flat = denoise_tv_chambolle(img, weight=0.09, channel_axis=-1)
lab = color.rgb2lab(flat)
lab[..., 0] = lab[..., 0] * 0.6 + (np.round(lab[..., 0] / 9) * 9) * 0.4
lab[..., 1:] *= 1.08
flat = np.clip(color.lab2rgb(lab), 0, 1)

# Background: the family is red shirts, skin and dark hair; the bathroom is
# low-saturation grey/white. Fade the background into a soft cream wash.
hsv = color.rgb2hsv(img)
fg = (hsv[..., 1] > 0.22) | (hsv[..., 2] < 0.3)
fg = morphology.closing(fg, morphology.disk(9))
fg = morphology.remove_small_objects(fg, max_size=4000)
fg = morphology.dilation(fg, morphology.disk(6))
fgm = filters.gaussian(fg.astype(np.float32), sigma=10)[..., None]
cream = np.array([0.94, 0.90, 0.84])
bg = filters.gaussian(flat, sigma=6, channel_axis=-1) * 0.35 + cream * 0.65
flat = flat * fgm + bg * (1 - fgm)

# Ink outlines from the original's strong edges.
gray = color.rgb2gray(filters.gaussian(img, sigma=1.5, channel_axis=-1))
edges = filters.sobel(gray)
ink = np.clip((edges - 0.045) / 0.05, 0, 1) * fgm[..., 0]
ink = filters.gaussian(morphology.dilation(ink, morphology.disk(1)), sigma=0.6)
out = flat * (1 - 0.6 * ink[..., None]) + np.array([0.22, 0.14, 0.12]) * 0.6 * ink[..., None]

# Keep the taegukgi patches crisp: near-white patches with red/blue on red shirts.
r, g, b = img[..., 0], img[..., 1], img[..., 2]
whiteish = (r > 0.75) & (g > 0.62) & (b > 0.62)
blue = (b > r + 0.08) & (b > 0.35)
shirt = (r > 0.55) & (g < 0.35) & (b < 0.35)
near_shirt = morphology.dilation(shirt, morphology.disk(18))
patch = morphology.closing((whiteish | blue) & near_shirt, morphology.disk(4))
patch = morphology.remove_small_objects(patch, max_size=120)
patch = morphology.dilation(patch, morphology.disk(3))
pm = filters.gaussian(patch.astype(np.float32), sigma=1.5)[..., None]
sharp = np.clip(img + (img - filters.gaussian(img, sigma=1.5, channel_axis=-1)) * 0.8, 0, 1)
out = out * (1 - pm) + sharp * pm

# Warm paper tone.
out = np.clip(out * np.array([1.02, 0.99, 0.95]) + 0.02, 0, 1)
Image.fromarray((out * 255).astype(np.uint8)).save(HERE / 'family-illustration.png')
print('FAMILY_ILLUSTRATION', out.shape, 'flag px', int(patch.sum()))
