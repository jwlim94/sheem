"""The open office's monitor screens for /portfolio/7 (chapter 2): one atlas of
eight everyday work screens, drawn in our own style (no real product's UI or
marks): a code editor, a team chat, a spreadsheet, a map app, a dashboard, a
terminal, a design tool, a mail inbox. build_office.py maps each lit monitor
to one of them. Run: python3 art/portfolio-office/build_screens.py (Pillow).
Writes art/portfolio-office/screens.png (4 x 2 tiles of 512 x 300).
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / 'screens.png'
TW, TH = 512, 300
rnd = random.Random(7)


def bar(d, x, y, w, h, c):
    d.rectangle([x, y, x + w, y + h], fill=c)


def window(d, x0, y0, bg, top='#e6e8ec'):
    bar(d, x0, y0, TW, TH, bg)
    bar(d, x0, y0, TW, 16, top)
    for i, c in enumerate(('#ee6a5f', '#f5bd4f', '#61c454')):
        d.ellipse([x0 + 7 + i * 11, y0 + 4, x0 + 15 + i * 11, y0 + 12], fill=c)


def editor(d, x0, y0):
    window(d, x0, y0, '#1f232a', '#2a2f37')
    bar(d, x0, y0 + 16, 90, TH - 16, '#252a32')  # file tree
    for i in range(14):
        bar(d, x0 + 10 + (i % 3) * 6, y0 + 28 + i * 17, 40 + rnd.randint(0, 30), 5, '#5c6673')
    cols = ['#c678dd', '#61afef', '#98c379', '#e5c07b', '#abb2bf', '#e06c75', '#56b6c2']
    for i in range(22):
        x = x0 + 104 + rnd.choice([0, 0, 14, 28, 42])
        y = y0 + 26 + i * 12
        bar(d, x0 + 96, y, 4, 4, '#4b5260')
        while x < x0 + 104 + rnd.randint(140, 380):
            w = rnd.randint(10, 46)
            bar(d, x, y, w, 5, rnd.choice(cols))
            x += w + 6


def chat(d, x0, y0):
    window(d, x0, y0, '#ffffff')
    bar(d, x0, y0 + 16, 34, TH - 16, '#3b1f4a')
    bar(d, x0 + 34, y0 + 16, 110, TH - 16, '#4a2a5c')
    for i in range(12):
        bar(d, x0 + 44, y0 + 30 + i * 18, 50 + rnd.randint(0, 40), 6, '#b7a3c2' if i != 3 else '#ffffff')
    for i in range(6):
        y = y0 + 30 + i * 42
        d.rounded_rectangle([x0 + 156, y, x0 + 180, y + 24], 5, fill=rnd.choice(['#e3a35f', '#6aa8d8', '#8cc084', '#d87a8a']))
        bar(d, x0 + 188, y + 2, 60, 6, '#30343c')
        for k in range(rnd.randint(1, 2)):
            bar(d, x0 + 188, y + 14 + k * 10, rnd.randint(120, 290), 5, '#8a909a')
    d.rounded_rectangle([x0 + 152, y0 + TH - 30, x0 + TW - 10, y0 + TH - 8], 6, outline='#c9ccd2', width=2)


def sheet(d, x0, y0):
    window(d, x0, y0, '#ffffff')
    bar(d, x0, y0 + 16, TW, 22, '#f1f3f4')
    bar(d, x0, y0 + 38, TW, 12, '#e8eaed')
    for c in range(0, TW, 64):
        d.line([x0 + c, y0 + 38, x0 + c, y0 + TH], fill='#dadce0')
    for r in range(y0 + 50, y0 + TH, 13):
        d.line([x0, r, x0 + TW, r], fill='#e3e5e8')
        for c in range(0, TW - 64, 64):
            if rnd.random() < 0.7:
                bar(d, x0 + c + 6, r + 4, rnd.randint(16, 48), 4, '#5f6368')
    bar(d, x0 + 130, y0 + 50, 62, 13, '#cfe1fb')
    bar(d, x0, y0 + TH - 14, TW, 14, '#f1f3f4')
    bar(d, x0 + 6, y0 + TH - 12, 60, 10, '#ffffff')


def mapapp(d, x0, y0):
    window(d, x0, y0, '#f5f6f8')
    for i in range(4):
        y = y0 + 26 + i * 66
        d.rounded_rectangle([x0 + 8, y, x0 + 190, y + 58], 6, fill='#ffffff')
        bar(d, x0 + 14, y + 6, 54, 46, rnd.choice(['#c9d6e2', '#d8cdb8', '#c4d1bd']))
        bar(d, x0 + 76, y + 10, 90, 7, '#18202e')
        bar(d, x0 + 76, y + 24, 70, 5, '#7a8290')
        bar(d, x0 + 76, y + 40, 34, 7, '#18202e')
    mx, my = x0 + 200, y0 + 22
    bar(d, mx, my, TW - 206, TH - 28, '#e6ebee')
    for gx in range(mx + 6, x0 + TW - 10, 46):
        for gy in range(my + 6, y0 + TH - 10, 40):
            bar(d, gx, gy, 38, 32, '#f4f6f7')
    d.line([mx, my + 120, x0 + TW - 6, my + 100], fill='#ffffff', width=7)
    d.line([mx + 140, my, mx + 160, y0 + TH], fill='#f6d58a', width=5)
    for i in range(8):
        px, py = mx + rnd.randint(20, 280), my + rnd.randint(20, 240)
        d.rounded_rectangle([px - 16, py - 9, px + 16, py + 9], 9, fill='#1d2433' if i == 2 else '#ffffff')


def dashboard(d, x0, y0):
    window(d, x0, y0, '#f4f6fa')
    bar(d, x0, y0 + 16, 70, TH - 16, '#1e2b44')
    for i in range(3):
        d.rounded_rectangle([x0 + 80 + i * 142, y0 + 26, x0 + 212 + i * 142, y0 + 76], 6, fill='#ffffff')
        bar(d, x0 + 90 + i * 142, y0 + 36, 50, 6, '#8a909a')
        bar(d, x0 + 90 + i * 142, y0 + 52, 70, 14, ['#2f6fc0', '#1f8a4c', '#d9822b'][i])
    d.rounded_rectangle([x0 + 80, y0 + 86, x0 + 360, y0 + TH - 10], 6, fill='#ffffff')
    pts = [(x0 + 92 + i * 22, y0 + 250 - int(60 * (i / 12) + rnd.randint(0, 40))) for i in range(13)]
    d.line(pts, fill='#2f6fc0', width=3)
    d.rounded_rectangle([x0 + 370, y0 + 86, x0 + TW - 8, y0 + TH - 10], 6, fill='#ffffff')
    for i in range(6):
        h = rnd.randint(30, 150)
        bar(d, x0 + 384 + i * 20, y0 + TH - 20 - h, 12, h, '#8cb4e8')


def terminal(d, x0, y0):
    window(d, x0, y0, '#111418', '#2a2d33')
    for i in range(22):
        y = y0 + 24 + i * 12
        bar(d, x0 + 8, y, 10, 5, '#61c454')
        x = x0 + 24
        for _ in range(rnd.randint(1, 6)):
            w = rnd.randint(14, 70)
            bar(d, x, y, w, 5, rnd.choice(['#c8ccd2', '#c8ccd2', '#7a8290', '#e5c07b']))
            x += w + 6
    bar(d, x0 + 24, y0 + 24 + 22 * 12, 8, 9, '#c8ccd2')


def design(d, x0, y0):
    window(d, x0, y0, '#e5e5e5', '#2c2c2c')
    bar(d, x0, y0 + 16, 80, TH - 16, '#2c2c2c')
    bar(d, x0 + TW - 90, y0 + 16, 90, TH - 16, '#2c2c2c')
    for i in range(10):
        bar(d, x0 + 8, y0 + 28 + i * 16, 50, 5, '#8a8a8a')
        bar(d, x0 + TW - 82, y0 + 28 + i * 20, 60, 6, '#6e6e6e')
    for i, (fx, fy) in enumerate([(100, 40), (230, 40), (100, 170), (230, 170)]):
        bar(d, x0 + fx, y0 + fy, 110, 110, '#ffffff')
        bar(d, x0 + fx + 10, y0 + fy + 10, 90, 40, ['#8fb6ef', '#f2c38b', '#a7d7b5', '#d8b4e8'][i])
        bar(d, x0 + fx + 10, y0 + fy + 58, 70, 6, '#3a3a3a')
        bar(d, x0 + fx + 10, y0 + fy + 70, 50, 5, '#9a9a9a')
    d.rectangle([x0 + 228, y0 + 38, x0 + 342, y0 + 152], outline='#2f8cff', width=2)


def mail(d, x0, y0):
    window(d, x0, y0, '#ffffff')
    bar(d, x0, y0 + 16, 96, TH - 16, '#f3f5f8')
    for i in range(8):
        bar(d, x0 + 10, y0 + 30 + i * 18, 60, 6, '#6b7280' if i else '#2f6fc0')
    for i in range(11):
        y = y0 + 24 + i * 25
        bar(d, x0 + 104, y + 4, 80, 6, '#18202e' if i < 3 else '#4b5563')
        bar(d, x0 + 196, y + 4, rnd.randint(150, 280), 5, '#9aa0a8')
        d.line([x0 + 100, y + 20, x0 + TW, y + 20], fill='#eceef1')


atlas = Image.new('RGB', (TW * 4, TH * 2), '#000000')
d = ImageDraw.Draw(atlas)
for i, f in enumerate((editor, chat, sheet, mapapp, dashboard, terminal, design, mail)):
    f(d, (i % 4) * TW, (i // 4) * TH)
atlas.save(OUT)
print('SCREENS', OUT, atlas.size)
