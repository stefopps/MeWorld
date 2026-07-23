import json
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\ecoli-gastroenteritis-2026-07-23"
with open(f"{dossier}\\ocr-full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Show full text of key result screens (13-38)
for r in data[12:38]:
    text = r['text'].strip()
    if len(text) > 50:
        print(f"\n=== {r['file']} ===")
        print(text[:600])
