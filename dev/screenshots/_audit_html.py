import re, sys

html = open(r"C:\Users\steve\MeWorld\dev\screenshots\case-review-all.html", "r", encoding="utf-8").read()

# Count sections
missed_hdrs = re.findall(r'class="section-header".*?What I Missed.*?(\d+) gaps', html)
got_hdrs = re.findall(r'class="section-header".*?What I Got Right', html)

# Count missed-why divs with substantial content (>30 chars)
why_rich = 0
for m in re.finditer(r'class="missed-why">(.+?)</div>', html, re.DOTALL):
    if len(m.group(1).strip()) > 30:
        why_rich += 1

# Count mech-body divs with substantial content (>100 chars)
mech_rich = 0
for m in re.finditer(r'class="mech-body">(.+?)</div>', html, re.DOTALL):
    if len(m.group(1).strip()) > 100:
        mech_rich += 1

# Count empty or near-empty mechanisms
mech_empty = len(re.findall(r'class="mech-body"></div>', html))

# Case panels
case_panels = re.findall(r'id="case-(\w[\w-]*?)"', html)
case_panels = list(set(case_panels))

print(f"Total case panels: {len(case_panels)}")
print(f"Cases with WHAT I MISSED: {len(missed_hdrs)} (total gaps: {sum(int(x) for x in missed_hdrs)})")
print(f"Cases with WHAT I GOT RIGHT: {len(got_hdrs)}")
print(f"Rich why-text items (>30 chars): {why_rich}")
print(f"Rich mechanism sections (>100 chars): {mech_rich}")
print(f"Empty mechanism sections: {mech_empty}")

# Per-case breakdown
panels = re.split(r'<div class="case-panel[^>]*>', html)
print(f"\n{'='*80}")
print("PER-CASE BREAKDOWN")
print(f"{'CASE':<45} {'MECH':>6} {'MISSED':>8} {'GOT':>8}")
print("-" * 80)

for panel in panels[1:]:
    # Get id
    id_m = re.search(r'id="case-(\w[\w-]*)"', panel)
    cid = id_m.group(1)[:42] if id_m else "???"
    # Get badge/name
    badge_m = re.search(r'class="header-badge">(.+?)<', panel)
    name = badge_m.group(1)[:42] if badge_m else cid
    
    # Mechanism length
    mech_m = re.search(r'class="mech-body">(.+?)</div>', panel, re.DOTALL)
    mech_len = len(mech_m.group(1).strip()) if mech_m else 0
    
    # Missed count
    missed_m = re.findall(r'class="missed-item"', panel)
    
    # Got right count
    got_m = re.findall(r'class="got-right-order"', panel)
    
    flag = ""
    if mech_len < 50:
        flag += " [NO MECH]"
    if len(missed_m) == 0:
        flag += " [NO MISSED]"
    if len(got_m) == 0:
        flag += " [NO GOT-RIGHT]"
    
    print(f"{name:<45} {mech_len:>4}c {len(missed_m):>5} {len(got_m):>5}{flag}")

print("-" * 80)
print(f"Empty mechanism sections: {mech_empty}")
