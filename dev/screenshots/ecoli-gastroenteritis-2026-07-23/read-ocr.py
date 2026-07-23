import json
dossier = r"C:\Users\steve\MeWorld\dev\screenshots\ecoli-gastroenteritis-2026-07-23"
with open(f"{dossier}\\ocr-full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Show first 12 and last 2
for r in data[0:12]:
    print(f"\n=== {r['file']} ===")
    print(r['text'][:800])
    
# Show score summary key parts
last = data[-1]
lines = last['text'].split('\n')
for i, line in enumerate(lines):
    if any(kw in line for kw in ['Score', 'Diagnosis', 'Missed', 'Should have', 'Timing', 'Preventive', 'Correctly Ordered', 'Treatment', 'Average', 'Your Z', 'Case Diagnosis', 'Case Summary', 'Differential']):
        print(f"  [{i}] {line.strip()}")
