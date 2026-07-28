import re
html = open(r"C:\Users\steve\MeWorld\dev\screenshots\case-review-all.html", "r", encoding="utf-8", errors="replace").read()

# Check CHF Got Right section
chf_idx = html.find('id="case-chf-hfref-2026-07-25"')
if chf_idx > 0:
    chf_panel = html[chf_idx:]
    end_idx = chf_panel.find('class="case-plates"')
    chf_panel = chf_panel[:end_idx] if end_idx > 0 else chf_panel[:5000]
    missed = chf_panel.count('class="missed-item"')
    got = chf_panel.count('class="got-right-order"')
    print(f"CHF: {missed} missed items, {got} got-right items")
    # Show first missed
    first = re.search(r'class="missed-order">(.+?)</div>', chf_panel, re.DOTALL)
    if first: print(f"  Missed: {first.group(1)[:120]}")
    first_why = re.search(r'class="missed-why">(.+?)</div>', chf_panel, re.DOTALL)
    if first_why: print(f"  Why: {first_why.group(1)[:200]}")

# Check Post-MI and CF
for label, search in [("Post-MI", 'post-mi-pericarditis'), ("CF", 'cystic-fibrosis-2026')]:
    idx = html.find(f'id="case-{search}')
    if idx > 0:
        panel = html[idx:]
        end = panel.find('class="case-plates"')
        panel = panel[:end] if end > 0 else panel[:5000]
        missed = panel.count('class="missed-item"')
        got = panel.count('class="got-right-order"')
        print(f"{label}: {missed} missed, {got} got-right")
        gr = re.search(r'class="got-right-order">(.+?)</div>', panel, re.DOTALL)
        if gr: print(f"  Got-right: {gr.group(1)[:200]}")

print("DONE")
