"""Scan CCS dossiers vs case-review-all.html; print missing folders."""
import os
import re

BASE = r"C:\Users\steve\MeWorld\dev\screenshots"
HTML_PATH = os.path.join(BASE, "case-review-all.html")
SKIP_FOLDERS = {
    "gym-bag-clotting-2026-07-30",
    "pku-pah-2026-07-29",
}
html = open(HTML_PATH, encoding="utf-8", errors="replace").read()

dossiers = []
for d in sorted(os.listdir(BASE)):
    p = os.path.join(BASE, d)
    if not os.path.isdir(p):
        continue
    if not re.search(r"-\d{4}-\d{2}-\d{2}$", d):
        continue
    if d in SKIP_FOLDERS:
        continue
    if not os.path.exists(os.path.join(p, "README.md")):
        continue
    dossiers.append(d)

missing = [d for d in dossiers if d not in html]
print(f"DOSSIERS={len(dossiers)}")
print(f"IN_HTML_APPROX={len(dossiers) - len(missing)}")
print(f"MISSING={len(missing)}")
for m in missing:
    print(f"MISSING: {m}")
print("--- TODAY ---")
for d in dossiers:
    if "2026-08-01" in d:
        flag = "MISSING" if d in missing else "IN_HTML"
        print(f"{flag}: {d}")
print("--- SKIPPED ---")
for s in sorted(SKIP_FOLDERS):
    print(f"SKIP: {s}")
