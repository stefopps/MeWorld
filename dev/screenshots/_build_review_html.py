import os, re, json, math
from pathlib import Path

BASE = r"C:\Users\steve\MeWorld\dev\screenshots"
OUT = os.path.join(BASE, "case-review-all.html")

def read_README(folder_name):
    path = os.path.join(BASE, folder_name, "README.md")
    if not os.path.exists(path): return None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def extract_score(text):
    # Match **Score:** 60.33% — case-insensitive, word-boundary, handles bold markers
    m = re.search(r'\b[Ss]core\b.*?([\d.]+)\s*%', text)
    if m: return float(m.group(1))
    return 0

def extract_diagnosis(text):
    # Try "Case:" line
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("Case:") or line.startswith("**Case:**"):
            d = re.sub(r'\*\*', '', line.replace("Case:", "").strip())
            if d and len(d) < 80: return d
    # Try first H1
    m = re.search(r'^# (.+?)$', text, re.MULTILINE)
    if m:
        d = m.group(1).strip()
        return d if len(d) < 80 else d[:77] + "..."
    return "Unknown"

def extract_mechanism(text):
    """Extract first principles / mechanism section"""
    # Look for "Mechanism" or "First Principles" section
    patterns = [
        r'## Mechanism.*?\n(.*?)(?=\n##|\n---|\n# )',
        r'## First Principles.*?\n(.*?)(?=\n##|\n---|\n# )',
        r'### Mechanism.*?\n(.*?)(?=\n##|\n###)',
        r'### First Principles.*?\n(.*?)(?=\n##|\n###)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL | re.IGNORECASE)
        if m:
            content = m.group(1).strip()
            # Take first 300 chars
            if len(content) > 300:
                content = content[:300].rsplit('.', 1)[0] + "."
            return content
    return ""

def extract_missed(text):
    """Extract missed orders"""
    items = []
    in_missed = False
    for line in text.split("\n"):
        if re.match(r'## What You Missed|## What I Missed|### Missed', line):
            in_missed = True
            continue
        if in_missed:
            if re.match(r'^##|^---', line):
                break
            if line.strip().startswith("|") or re.match(r'\*\*.*?\*\*.*?\n', line):
                continue
            m = re.match(r'^\d+\.\s*\*?\*?\*?(.+?)\*?\*?\*?$', line.strip())
            if m:
                items.append(m.group(1).strip())
    return items[:8]  # max 8

def extract_got_right(text):
    items = []
    in_section = False
    for line in text.split("\n"):
        if re.match(r'## What You Got Right', line):
            in_section = True
            continue
        if in_section:
            if re.match(r'^##|^---', line):
                break
            m = re.match(r'^\d+\.\s*\*?\*?\*?(.+?)\*?\*?\*?$', line.strip())
            if m:
                items.append(m.group(1).strip())
    return items[:6]

def extract_patient_info(text):
    """Extract patient: age, complaints, vitals"""
    patient = ""
    m = re.search(r'\*\*Patient:\*\*\s*(.+?)\n', text)
    if m: patient = m.group(1).strip()
    m = re.search(r'\*\*Date:\*\*\s*(.+?)\n', text)
    if m: patient += " · " + m.group(1).strip()
    return patient

def get_images(folder_name):
    imgdir = os.path.join(BASE, folder_name, "images")
    if not os.path.exists(imgdir): return []
    imgs = []
    for f in sorted(os.listdir(imgdir)):
        if f.endswith('.png'):
            size = os.path.getsize(os.path.join(imgdir, f))
            imgs.append((f, size))
    # Put descent-3x3 first, gaps second, others after
    def sort_key(x):
        n = x[0]
        if 'descent-3x3' in n and 'gaps' not in n: return 0
        if 'descent-gaps' in n: return 1
        if 'descent-A' in n or 'descent-B' in n: return 2
        return 3
    imgs.sort(key=sort_key)
    return imgs

def score_color(score):
    if score >= 75: return "good-bg"
    if score >= 50: return "warn-bg"
    return "bad-bg"

def score_label(score):
    if score >= 75: return "good"
    if score >= 50: return "warn"
    return "bad"

def slugify(name):
    return re.sub(r'[^a-z0-9]', '-', name.lower())[:30]

# Collect all cases
cases = []
for d in sorted(os.listdir(BASE)):
    if not re.search(r'-\d{4}-\d{2}-\d{2}$', d): continue
    readme = read_README(d)
    if not readme: continue

    score = extract_score(readme)
    diagnosis = extract_diagnosis(readme)
    mechanism = extract_mechanism(readme)
    missed = extract_missed(readme)
    got_right = extract_got_right(readme)
    patient = extract_patient_info(readme)
    images = get_images(d)
    date_str = d[-10:]

    mechanism_html = ""
    if mechanism:
        mechanism_esc = mechanism.replace('<', '&lt;').replace('>', '&gt;')
        mechanism_esc = re.sub(r'\*\*(.+?)\*\*', r'<span class="mech-highlight">\1</span>', mechanism_esc)
        mechanism_html = f'<div class="mech-box"><div class="mech-title">First Principles</div><div class="mech-body">{mechanism_esc}</div></div>'

    cases.append({
        'folder': d, 'score': score, 'diagnosis': diagnosis, 'patient': patient,
        'mechanism_html': mechanism_html, 'missed': missed, 'got_right': got_right,
        'images': images, 'date': date_str
    })

# Sort by score descending
cases.sort(key=lambda c: c['score'], reverse=True)

# Build HTML
html_parts = []
html_parts.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MeWorld · All Case Reviews</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#f5f5f7; --card:#ffffff; --text:#1d1d1f; --text-secondary:#6e6e73;
  --accent:#0071e3; --accent-light:#e8f0fe; --border:#d2d2d7;
  --success:#34c759; --warning:#ff9f0a; --danger:#ff3b30;
  --radius:18px; --radius-sm:12px;
  --shadow:0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06);
  --transition:0.32s cubic-bezier(0.4,0,0.2,1);
  --sidebar-w:290px;
}
body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; overflow:hidden; height:100vh; -webkit-font-smoothing:antialiased; }
.app { display:flex; height:100vh; }
.sidebar { width:var(--sidebar-w); flex-shrink:0; background:#1d1d1f; color:#f5f5f7; overflow-y:auto; padding:20px 14px; display:flex; flex-direction:column; gap:4px; }
.sidebar-title { font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:#86868b; font-weight:700; margin-bottom:4px; padding:0 6px; }
.sidebar-count { font-size:10px; color:#86868b; margin-bottom:8px; padding:0 6px; }
.search-wrap { position:relative; margin:0 0 10px; }
.search-wrap input { width:100%; padding:9px 12px 9px 32px; border-radius:10px; border:none; background:#2a2a2d; color:#f5f5f7; font-family:'Inter',sans-serif; font-size:12px; outline:none; transition:background var(--transition); }
.search-wrap input:focus { background:#353538; box-shadow:0 0 0 1.5px var(--accent); }
.search-wrap input::placeholder { color:#86868b; }
.search-wrap .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:13px; color:#86868b; pointer-events:none; }
.search-wrap .search-shortcut { position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:10px; color:#6e6e73; font-family:'JetBrains Mono',monospace; pointer-events:none; }
.search-no-results { font-size:11px; color:#86868b; padding:8px 12px; display:none; }
.search-no-results.show { display:block; }
.case-nav-card.hidden { display:none; }
#search-count { font-size:10px; color:#6e6e73; padding:0 6px; transition:color 0.2s; }
.case-nav { display:flex; flex-direction:column; gap:3px; }
.case-nav-card { padding:10px 12px; border-radius:10px; cursor:pointer; transition:all var(--transition); border:1.5px solid transparent; background:#2a2a2d; }
.case-nav-card:hover { background:#353538; }
.case-nav-card.active { background:#3a3a3d; border-color:var(--accent); }
.case-nav-card .cn-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.case-nav-card .cn-title { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }
.case-nav-card .cn-score { font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:600; flex-shrink:0; }
.cn-score.good { color:var(--success); } .cn-score.warn { color:var(--warning); } .cn-score.bad { color:var(--danger); }
.cn-bar { height:2px; border-radius:1px; margin-top:4px; display:flex; overflow:hidden; background:#404045; }
.cn-bar-seg { height:100%; }
.cn-bar-seg.tx { background:var(--success); } .cn-bar-seg.dx { background:var(--warning); } .cn-bar-seg.miss { background:var(--danger); }

.main { flex:1; overflow-y:auto; padding:28px; }
.case-panel { display:none; animation:fadeIn 0.3s ease; }
.case-panel.active { display:block; }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }

.case-layout { display:flex; gap:28px; align-items:flex-start; }
.case-text { flex:1; min-width:0; max-width:680px; }
.case-plates { position:sticky; top:28px; flex:0 0 320px; display:flex; flex-direction:column; gap:12px; max-height:calc(100vh - 56px); overflow-y:auto; }

.plate-card { background:var(--card); border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden; }
.plate-card-header { padding:10px 14px; font-size:10px; font-weight:600; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; border-bottom:1px solid var(--border); }
.plate-card img { width:100%; height:auto; display:block; cursor:pointer; transition:opacity 0.2s; }
.plate-card img:hover { opacity:0.92; }
.plate-card-footer { padding:6px 14px; font-size:10px; color:var(--text-secondary); border-top:1px solid var(--border); }

.header { background:var(--card); border-radius:var(--radius); padding:24px; margin-bottom:16px; box-shadow:var(--shadow); }
.header-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.header-badge { font-size:11px; font-weight:600; letter-spacing:0.02em; background:var(--accent-light); color:var(--accent); padding:4px 12px; border-radius:20px; }
.header-score { font-family:'JetBrains Mono',monospace; font-size:40px; font-weight:600; letter-spacing:-0.03em; }
.header-score.good-bg { background:linear-gradient(135deg,#34c759,#30b350); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.header-score.warn-bg { background:linear-gradient(135deg,#ff9f0a,#e88a00); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.header-score.bad-bg { background:linear-gradient(135deg,#ff3b30,#e0352c); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.header-score span { font-size:15px; opacity:0.6; }
.header h1 { font-size:22px; font-weight:700; letter-spacing:-0.02em; margin-bottom:4px; }
.header-sub { font-size:13px; color:var(--text-secondary); }
.header-vitals { display:flex; gap:20px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap; }
.vital-item { display:flex; flex-direction:column; }
.vital-label { font-size:9px; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-secondary); }
.vital-value { font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:600; margin-top:1px; }
.score-bar { display:flex; height:3px; border-radius:2px; overflow:hidden; margin-top:10px; background:#e8e8ed; }
.score-bar-seg { height:100%; }
.score-bar-seg.tx { background:var(--success); } .score-bar-seg.dx { background:var(--warning); } .score-bar-seg.miss { background:var(--danger); }

.section { background:var(--card); border-radius:var(--radius); margin-bottom:12px; box-shadow:var(--shadow); overflow:hidden; }
.section-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; cursor:pointer; user-select:none; }
.section-header:hover { background:#fafafa; }
.section-header-left { display:flex; align-items:center; gap:10px; }
.section-icon { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:14px; }
.section-icon.missed { background:#ffece5; color:#ff3b30; }
.section-icon.ordered { background:#e5f7ed; color:#34c759; }
.section-title { font-size:14px; font-weight:600; }
.section-count { font-size:11px; color:var(--text-secondary); }
.section-chevron { font-size:11px; opacity:0.4; transition:transform var(--transition); }
.section.open .section-chevron { transform:rotate(180deg); }
.section-body { display:none; padding:0 18px 16px; }
.section.open .section-body { display:block; }

.missed-item { padding:12px 0; border-bottom:1px solid #f0f0f0; }
.missed-item:last-child { border-bottom:none; }
.missed-order { font-size:13px; font-weight:600; margin-bottom:2px; display:flex; align-items:center; gap:7px; }
.missed-dot { width:6px; height:6px; border-radius:50%; background:var(--danger); flex-shrink:0; }
.missed-why { font-size:12px; color:var(--text-secondary); line-height:1.5; }

.got-right-order { font-size:13px; font-weight:600; margin-bottom:2px; display:flex; align-items:center; gap:7px; }
.got-right-dot { width:6px; height:6px; border-radius:50%; background:var(--success); flex-shrink:0; }

.mech-box { background:#1d1d1f; color:#f5f5f7; border-radius:var(--radius); padding:20px; margin-bottom:14px; }
.mech-title { font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:#86868b; font-weight:700; margin-bottom:12px; }
.mech-body { font-size:13px; line-height:1.7; }
.mech-highlight { color:#ff9f0a; font-weight:600; }

.lightbox { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.92); z-index:9999; justify-content:center; align-items:center; cursor:pointer; }
.lightbox.active { display:flex; }
.lightbox img { max-width:92vw; max-height:92vh; object-fit:contain; border-radius:12px; }

@media(max-width:900px) {
  .app { flex-direction:column; }
  .sidebar { width:100%; flex-direction:row; overflow-x:auto; padding:10px; gap:6px; }
  .sidebar-title, .sidebar-count { display:none; }
  .case-nav { flex-direction:row; }
  .case-nav-card { flex-shrink:0; min-width:170px; }
  .case-layout { flex-direction:column; }
  .case-plates { position:static; flex-direction:row; flex-wrap:wrap; max-height:none; }
  .case-plates .plate-card { flex:1; min-width:220px; }
}
</style>
</head>
<body>
<div class="app">
<div class="sidebar">
  <div class="sidebar-title">Case Reviews</div>
  <div class="sidebar-count">''' + str(len(cases)) + ''' cases</div>
  <div class="search-wrap"><span class="search-icon">&#x1F50D;</span><input type="text" id="searchInput" placeholder="Search cases..." oninput="searchCases()" onkeydown="handleSearchKey(event)"><span class="search-shortcut">/</span></div>
  <span id="search-count" style="display:none"></span>
  <div class="search-no-results" id="searchNoResults">No cases found</div>
  <div class="case-nav">''')

# Sidebar entries
first = True
for i, c in enumerate(cases):
    sid = slugify(c['folder'])
    active = ' active' if first else ''
    sl = score_label(c['score'])
    name = c['diagnosis'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    if len(name) > 35: name = name[:32] + '...'
    tx_pct = min(100, max(0, c['score']))
    miss_pct = 100 - tx_pct
    html_parts.append(f'''    <div class="case-nav-card{active}" onclick="switchCase('{sid}')">
      <div class="cn-row"><span class="cn-title">{name}</span><span class="cn-score {sl}">{c['score']:.0f}<span style="font-size:10px">%</span></span></div>
      <div class="cn-bar"><div class="cn-bar-seg tx" style="width:{tx_pct:.0f}%"></div><div class="cn-bar-seg miss" style="width:{miss_pct:.0f}%"></div></div>
    </div>''')
    first = False

html_parts.append('''  </div>
</div>
<div class="main">''')

# Case panels
first = True
for i, c in enumerate(cases):
    sid = slugify(c['folder'])
    active = ' active' if first else ''
    sl = score_label(c['score'])
    sc = score_color(c['score'])
    name = c['diagnosis'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    patient = c['patient'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;') if c['patient'] else ""

    html_parts.append(f'''
<div class="case-panel{active}" id="case-{sid}">
<div class="case-layout">
<div class="case-text">

<div class="header">
  <div class="header-top"><div class="header-badge">{name}</div><div class="header-score {sc}">{c['score']:.1f}<span>%</span></div></div>
  <p class="header-sub">{patient}</p>
  <div class="score-bar"><div class="score-bar-seg tx" style="width:{min(100,c['score']):.0f}%"></div><div class="score-bar-seg miss" style="width:{100-min(100,c['score']):.0f}%"></div></div>
</div>''')

    if c['mechanism_html']:
        html_parts.append(c['mechanism_html'])

    # Missed
    if c['missed']:
        html_parts.append(f'''<div class="section open">
  <div class="section-header" onclick="this.parentElement.classList.toggle('open')"><div class="section-header-left"><div class="section-icon missed">✕</div><span class="section-title">What I Missed</span><span class="section-count">{len(c['missed'])} gaps</span></div><div class="section-chevron">▾</div></div>
  <div class="section-body">''')
        for item in c['missed']:
            item_esc = item.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
            html_parts.append(f'''    <div class="missed-item"><div class="missed-order"><span class="missed-dot"></span>{item_esc}</div></div>''')
        html_parts.append('  </div>\n</div>')

    # Got Right
    if c['got_right']:
        html_parts.append(f'''<div class="section">
  <div class="section-header" onclick="this.parentElement.classList.toggle('open')"><div class="section-header-left"><div class="section-icon ordered">✓</div><span class="section-title">What I Got Right</span></div><div class="section-chevron">▾</div></div>
  <div class="section-body">''')
        for item in c['got_right']:
            item_esc = item.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
            html_parts.append(f'''    <div class="missed-item"><div class="got-right-order"><span class="got-right-dot"></span>{item_esc}</div></div>''')
        html_parts.append('  </div>\n</div>')

    html_parts.append('\n</div><!-- /case-text -->')

    # Images
    if c['images']:
        img_path = c['folder']
        html_parts.append('<div class="case-plates">')
        for img_name, img_size in c['images']:
            size_mb = img_size / 1048576
            label = "Descent" if 'gaps' not in img_name and 'descent' in img_name else "Gaps" if 'gaps' in img_name else img_name.replace('.png','').replace('_',' ').title()
            if 'panel-' in img_name: label = f"Panel {img_name.replace('panel-','').replace('.png','')}"
            html_parts.append(f'''  <div class="plate-card"><div class="plate-card-header">{label}</div><img src="./{img_path}/images/{img_name}" onclick="openLightbox(this.src)" loading="lazy"><div class="plate-card-footer">{size_mb:.1f} MB</div></div>''')
        html_parts.append('</div>')

    html_parts.append('</div><!-- /case-layout -->\n</div><!-- /case-panel -->')
    first = False

html_parts.append('''</div><!-- /main -->
</div><!-- /app -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()"><img id="lightbox-img" src="" alt=""></div>
<script>
function switchCase(id) {
  document.querySelectorAll('.case-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.case-nav-card').forEach(c => c.classList.remove('active'));
  var panel = document.getElementById('case-' + id);
  if (panel) panel.classList.add('active');
  var nav = document.querySelector('.case-nav-card[onclick*="' + id + '"]');
  if (nav) nav.classList.add('active');
  document.querySelector('.main').scrollTop = 0;
}

function searchCases() {
  var q = document.getElementById('searchInput').value.toLowerCase().trim();
  var cards = document.querySelectorAll('.case-nav-card');
  var visible = 0;
  cards.forEach(function(c) {
    var text = (c.getAttribute('data-search') || c.textContent).toLowerCase();
    if (!q || text.indexOf(q) > -1) { c.classList.remove('hidden'); visible++; }
    else { c.classList.add('hidden'); }
  });
  var count = document.getElementById('search-count');
  var noResults = document.getElementById('searchNoResults');
  var sidebarCount = document.querySelector('.sidebar-count');
  if (q) {
    count.style.display = 'block';
    count.textContent = visible + ' of ' + cards.length + ' cases';
    sidebarCount.style.display = 'none';
    noResults.classList.toggle('show', visible === 0);
    if (visible > 0) {
      var active = document.querySelector('.case-nav-card.active');
      if (active && active.classList.contains('hidden')) {
        var firstVisible = document.querySelector('.case-nav-card:not(.hidden)');
        if (firstVisible) firstVisible.click();
      }
    }
  } else {
    count.style.display = 'none';
    sidebarCount.style.display = 'block';
    noResults.classList.remove('show');
  }
}

function handleSearchKey(e) {
  if (e.key === 'Escape') { document.getElementById('searchInput').value = ''; searchCases(); e.target.blur(); }
  if (e.key === 'Enter') {
    var firstVisible = document.querySelector('.case-nav-card:not(.hidden)');
    if (firstVisible) firstVisible.click();
  }
}

document.addEventListener('keydown', function(e) {
  if ((e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    document.getElementById('searchInput').focus();
    document.getElementById('searchInput').select();
  }
});

document.querySelectorAll('.case-nav-card').forEach(function(c) {
  c.setAttribute('data-search', c.textContent.replace(/\\s+/g,' ').trim());
});

function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox').classList.add('active'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeLightbox(); });
</script>
</body>
</html>''')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(html_parts))

print(f"Written: {OUT}")
print(f"Cases: {len(cases)}")
kb = os.path.getsize(OUT) / 1024
print(f"Size: {kb:.0f} KB")
