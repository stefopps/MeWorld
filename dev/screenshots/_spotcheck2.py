import re
html = open(r"C:\Users\steve\MeWorld\dev\screenshots\case-review-all.html", "r", encoding="utf-8", errors="replace").read()

# Find AIP case panel by ID
aip_idx = html.find('id="case-acute-intermittent-porphyria')
if aip_idx > 0:
    panel = html[aip_idx:]
    end = panel.find('id="case-', 10)  # next panel
    panel = panel[:end] if end > 0 else panel[:8000]

    # Check mechanism body
    mech_m = re.search(r'<div class="mech-body">(.+?)</div>\s*</div', panel, re.DOTALL)
    if mech_m:
        body = mech_m.group(1)
        print(f"MECHANISM: ul={'<ul>' in body} li={'<li>' in body} table={'<table' in body} p={'<p>' in body}")
        print(body[:800])
    else:
        print("NO MECHANISM FOUND")
    
    # Check missed items
    missed = re.findall(r'class="missed-why">(.+?)</div>', panel, re.DOTALL)
    print(f"\nMISSED items: {len(missed)}")
    for i, m in enumerate(missed[:3]):
        has_li = '<li>' in m
        has_table = '<table' in m
        print(f"  #{i+1}: li={has_li} table={has_table} -> {m[:200]}")

    # Check got-right
    gr = re.findall(r'class="got-right-order">(.+?)</div>', panel, re.DOTALL)
    print(f"\nGOT-RIGHT items: {len(gr)}")

print("DONE")
