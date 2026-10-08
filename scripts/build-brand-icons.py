"""Mechanical icon exports from the approved StudyGram bitmap master (Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
brand = root / 'public' / 'brand'
source = Image.open(root / 'assets' / 'brand' / 'studygram-master.png').convert('RGB')
for size in (32, 180, 192, 512):
    source.resize((size, size), Image.Resampling.LANCZOS).save(brand / f'studygram-{size}.png', optimize=True)
# Keep the mark within the circular maskable safe zone, with a full-bleed background.
mask = Image.new('RGB', (512, 512), source.getpixel((0, 0)))
mask.paste(source.resize((448, 448), Image.Resampling.LANCZOS), (32, 32))
mask.save(brand / 'studygram-maskable-512.png', optimize=True)
source.save(root / 'public' / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
# Compatibility for earlier bookmarks and existing notification payloads.
for size in (192, 512):
    source.resize((size, size), Image.Resampling.LANCZOS).save(root / 'public' / f'pwa-{size}x{size}.png', optimize=True)
