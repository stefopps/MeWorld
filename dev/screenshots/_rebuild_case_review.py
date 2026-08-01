"""
One-shot: scan CCS dossiers vs case-review-all.html, rebuild, re-verify.
Safe for local_agent run_shell (no deletes).

  python _rebuild_case_review.py
"""
from __future__ import annotations

import os
import re
import subprocess
import sys

BASE = r"C:\Users\steve\MeWorld\dev\screenshots"
HTML = os.path.join(BASE, "case-review-all.html")
BUILDER = os.path.join(BASE, "_build_review_html.py")

# Same skip set as _build_review_html.py (creative / VO shorts)
SKIP_FOLDERS = {
    "gym-bag-clotting-2026-07-30",
    "pku-pah-2026-07-29",
}


def dated_dossiers() -> list[str]:
    out = []
    for d in sorted(os.listdir(BASE)):
        p = os.path.join(BASE, d)
        if not os.path.isdir(p):
            continue
        if not re.search(r"-\d{4}-\d{2}-\d{2}$", d):
            continue
        if d in SKIP_FOLDERS:
            continue
        if os.path.exists(os.path.join(p, "README.md")):
            out.append(d)
    return out


def missing_from_html(dossiers: list[str], html: str) -> list[str]:
    return [d for d in dossiers if d not in html]


def main() -> int:
    dossiers = dated_dossiers()
    html_before = ""
    if os.path.exists(HTML):
        html_before = open(HTML, encoding="utf-8", errors="replace").read()
    miss_before = missing_from_html(dossiers, html_before)

    print("=== SCAN (before) ===")
    print(f"CCS dossiers with README: {len(dossiers)}")
    print(f"Missing from HTML: {len(miss_before)}")
    for m in miss_before:
        print(f"  MISSING: {m}")
    if SKIP_FOLDERS:
        print("Skipped (creative/VO, not CCS review):")
        for s in sorted(SKIP_FOLDERS):
            print(f"  SKIP: {s}")

    print("\n=== BUILD ===")
    proc = subprocess.run(
        [sys.executable, BUILDER],
        cwd=BASE,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    print(proc.stdout.strip())
    if proc.stderr.strip():
        print(proc.stderr.strip())
    if proc.returncode != 0:
        print(f"BUILD FAILED exit={proc.returncode}")
        return proc.returncode

    html_after = open(HTML, encoding="utf-8", errors="replace").read()
    miss_after = missing_from_html(dossiers, html_after)
    today = [d for d in dossiers if "2026-08-01" in d]

    print("\n=== VERIFY (after) ===")
    print(f"HTML size: {len(html_after)} bytes")
    print(f"Still missing: {len(miss_after)}")
    for m in miss_after:
        print(f"  STILL_MISSING: {m}")
    print("Today:")
    for d in today:
        print(f"  {'OK' if d in html_after else 'FAIL'}: {d}")

    # Spot-check JS globals present in built file
    for token in ("function switchCase", "function searchCases", "function askAttending", "CASE_CONTEXTS"):
        ok = token in html_after
        print(f"  smoke {token}: {'OK' if ok else 'FAIL'}")

    if miss_after:
        print("\nRESULT: incomplete")
        return 2
    print("\nRESULT: ok - case-review-all.html rebuilt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
