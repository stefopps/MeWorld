import os, pytesseract, json
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\ischemic-colitis-2026-07-23"
files = sorted([f for f in os.listdir(dossier) if f.endswith('.png')])

results = []
for f in files:
    path = os.path.join(dossier, f)
    img = Image.open(path)
    text = pytesseract.image_to_string(img, lang='eng')
    results.append({"file": f, "text": text})

with open(os.path.join(dossier, "ocr-full.txt"), "w", encoding="utf-8") as fh:
    for r in results:
        fh.write(f"\n{'='*80}\nFILE: {r['file']}\n{'='*80}\n")
        fh.write(r['text'] + "\n")

with open(os.path.join(dossier, "ocr-full.json"), "w", encoding="utf-8") as fh:
    json.dump(results, fh, indent=2, ensure_ascii=False)

print(f"Done: {len(results)} files")
