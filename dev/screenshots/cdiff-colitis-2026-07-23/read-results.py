import json
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\cdiff-colitis-2026-07-23"
with open(f"{dossier}\\ocr-full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Show screens 14-37 (results, patient updates, orders)
for r in data[13:37]:
    text = r['text'].strip()
    if len(text) > 40:
        print(f"\n=== {r['file']} ===")
        print(text[:700])
