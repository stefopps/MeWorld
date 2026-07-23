import os
import pytesseract
from PIL import Image
import json

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\ecoli-gastroenteritis-2026-07-23"
files = sorted([f for f in os.listdir(dossier) if f.endswith('.png')])

results = []
for f in files:
    path = os.path.join(dossier, f)
    print(f"OCR: {f}")
    img = Image.open(path)
    text = pytesseract.image_to_string(img, lang='eng')
    results.append({"file": f, "text": text})
    print(f"  -> {len(text)} chars")

# Write full OCR dump
out_path = os.path.join(dossier, "ocr-full.txt")
with open(out_path, "w", encoding="utf-8") as fh:
    for r in results:
        fh.write(f"\n{'='*80}\n")
        fh.write(f"FILE: {r['file']}\n")
        fh.write(f"{'='*80}\n")
        fh.write(r['text'])
        fh.write("\n")

# Also write JSON
json_path = os.path.join(dossier, "ocr-full.json")
with open(json_path, "w", encoding="utf-8") as fh:
    json.dump(results, fh, indent=2, ensure_ascii=False)

print(f"\nDone: {len(results)} files -> {out_path}")
print(f"JSON: {json_path}")
