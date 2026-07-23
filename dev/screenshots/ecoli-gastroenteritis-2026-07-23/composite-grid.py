from PIL import Image
import os

dossier = r"C:\Users\steve\MeWorld\dev\screenshots\ecoli-gastroenteritis-2026-07-23"
img_dir = os.path.join(dossier, "images")

panels = []
for i in range(1, 10):
    path = os.path.join(img_dir, f"panel-{i}.png")
    panels.append(Image.open(path))

# Use the smallest panel size as cell size (should all be square ~2048x2048)
cell_w = min(p.width for p in panels)
cell_h = min(p.height for p in panels)

grid_w = cell_w * 3
grid_h = cell_h * 3
grid = Image.new("RGB", (grid_w, grid_h), (17, 17, 17))

for idx, img in enumerate(panels):
    img = img.resize((cell_w, cell_h), Image.LANCZOS)
    col = idx % 3
    row = idx // 3
    grid.paste(img, (col * cell_w, row * cell_h))

out_path = os.path.join(img_dir, "ecoli-descent-3x3.png")
grid.save(out_path, "PNG", optimize=True)
size_mb = os.path.getsize(out_path) / (1024 * 1024)
print(f"Grid saved: {out_path}")
print(f"Size: {size_mb:.1f} MB")
print(f"Dimensions: {grid_w}x{grid_h}")
