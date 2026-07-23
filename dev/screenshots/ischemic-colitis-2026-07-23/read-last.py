import json
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\ischemic-colitis-2026-07-23"
with open(f"{dossier}\\ocr-full.json", "r", encoding="utf-8") as f:
    data = json.load(f)
for r in data[-10:]:
    text = r['text'].strip()
    if len(text) > 30:
        print(f"\n=== {r['file']} ===")
        print(text[:800])
