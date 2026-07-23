import json
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\cdiff-colitis-2026-07-23"
with open(f"{dossier}\\ocr-full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Show first 15 screens (intro, vitals, HPI, exam, orders)
for r in data[:15]:
    text = r['text'].strip()
    if len(text) > 80:
        print(f"\n=== {r['file']} ===")
        print(text[:800])
