import os, re, json, math
from pathlib import Path

BASE = r"C:\Users\steve\MeWorld\dev\screenshots"
OUT = os.path.join(BASE, "case-review-all.html")

def read_README(folder_name):
    path = os.path.join(BASE, folder_name, "README.md")
    if not os.path.exists(path): return None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def md_to_html(text):
    """Convert markdown body text to HTML. Handles: **bold**, *italic*, - lists, 1. lists, | tables |, paragraph breaks, inline code."""
    if not text: return ""
    lines = text.split("\n")
    out = []
    in_ul = in_ol = in_table = False
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Table: detect header + separator pattern
        if '|' in line and i+1 < len(lines) and re.match(r'^\|[\s\-:]+\|[\s\-:]+\|', lines[i+1].strip()):
            # Start table
            if in_ul: out.append('</ul>'); in_ul = False
            if in_ol: out.append('</ol>'); in_ol = False
            out.append('<table class="md-table">')
            # Header row
            if line.startswith('|') and line.endswith('|'):
                cells = [c.strip() for c in line.split('|')[1:-1]]
                out.append('<thead><tr>' + ''.join(f'<th>{_inline_md(c)}</th>' for c in cells) + '</tr></thead>')
            i += 2  # skip separator row
            out.append('<tbody>')
            in_table = True
            continue
        
        if in_table:
            if '|' in line and line.startswith('|') and line.endswith('|'):
                cells = [c.strip() for c in line.split('|')[1:-1]]
                out.append('<tr>' + ''.join(f'<td>{_inline_md(c)}</td>' for c in cells) + '</tr>')
                i += 1
                continue
            else:
                out.append('</tbody></table>')
                in_table = False
                # fall through to process this line
        
        # Code block
        if line.startswith('```'):
            if in_ul: out.append('</ul>'); in_ul = False
            if in_ol: out.append('</ol>'); in_ol = False
            out.append('<pre><code>')
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                out.append(lines[i])
                i += 1
            out.append('</code></pre>')
            i += 1
            continue
        
        # Heading (### or ##)
        if re.match(r'^#{2,4}\s', line):
            if in_ul: out.append('</ul>'); in_ul = False
            if in_ol: out.append('</ol>'); in_ol = False
            level = len(re.match(r'^(#+)', line).group(1))
            text = _inline_md(line.lstrip('#').strip())
            out.append(f'<h{level} class="md-h{level}">{text}</h{level}>')
            i += 1
            continue
        
        # Unordered list
        if re.match(r'^[-*•]\s', line):
            if not in_ul:
                if in_ol: out.append('</ol>'); in_ol = False
                out.append('<ul>')
                in_ul = True
            out.append(f'<li>{_inline_md(re.sub(r"^[-*•]\s+", "", line))}</li>')
            i += 1
            continue
        
        # Ordered list
        if re.match(r'^\d+\.\s', line):
            if not in_ol:
                if in_ul: out.append('</ul>'); in_ul = False
                out.append('<ol>')
                in_ol = True
            out.append(f'<li>{_inline_md(re.sub(r"^\d+\.\s+", "", line))}</li>')
            i += 1
            continue
        
        # Blank line: close lists, start para break
        if not line:
            if in_ul: out.append('</ul>'); in_ul = False
            if in_ol: out.append('</ol>'); in_ol = False
            i += 1
            continue
        
        # Horizontal rule
        if re.match(r'^---+$', line):
            if in_ul: out.append('</ul>'); in_ul = False
            if in_ol: out.append('</ol>'); in_ol = False
            out.append('<hr>')
            i += 1
            continue
        
        # Regular paragraph text
        if in_ul: out.append('</ul>'); in_ul = False
        if in_ol: out.append('</ol>'); in_ol = False
        
        # Collect consecutive paragraph lines
        para_lines = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^[#\-*•\d]', lines[i].strip()) and '|' not in lines[i].strip():
            if not lines[i].strip().startswith('```'):
                para_lines.append(lines[i].strip())
            i += 1
        out.append(f'<p>{" ".join(_inline_md(l) for l in para_lines)}</p>')
    
    # Close any open tags
    if in_ul: out.append('</ul>')
    if in_ol: out.append('</ol>')
    if in_table: out.append('</tbody></table>')
    
    return '\n'.join(out)

def _inline_md(text):
    """Convert inline markdown: **bold**, *italic*, `code`"""
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<span class="mech-highlight">\1</span>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    return text

def extract_score(text):
    # Match **Score:** 60.33% — case-insensitive, word-boundary, handles bold markers
    m = re.search(r'\b[Ss]core\b.*?([\d.]+)\s*%', text)
    if m: return float(m.group(1))
    return 0

def extract_diagnosis(text):
    # Prefer "Diagnosis:" line over "Case:" line
    for line in text.split("\n"):
        ls = line.strip()
        if ls.startswith("Diagnosis:") or ls.startswith("**Diagnosis:**"):
            d = re.sub(r'\*{1,3}', '', ls.replace("Diagnosis:", "").strip())
            if d and len(d) < 80: return d
    for line in text.split("\n"):
        ls = line.strip()
        if ls.startswith("Case:") or ls.startswith("**Case:**"):
            d = re.sub(r'\*{1,3}', '', ls.replace("Case:", "").strip())
            if d and len(d) < 80: return d
    # Try first H1
    m = re.search(r'^# (.+?)$', text, re.MULTILINE)
    if m:
        d = m.group(1).strip()
        return d if len(d) < 80 else d[:77] + "..."
    return "Unknown"

def extract_mechanism(text):
    """Extract first principles / mechanism section. Handles Mechanism, Pathophysiology, First Principles headers."""
    patterns = [
        # Match ## Mechanism: ... or ## Mechanism — ... (all content until next ## heading)
        r'^#{2,3}\s*(?:Mechanism|Pathophysiology|First\s+Principles).*?\n(.*?)(?=\n#{2}\s|\n---+|\Z)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if m:
            content = m.group(1).strip()
            if len(content) > 2000:
                cutoff = content[:2000].rfind('\n\n')
                if cutoff > 300:
                    content = content[:cutoff] + "..."
                else:
                    content = content[:2000].rsplit('.', 1)[0] + "..."
            return content
    return ""

def _strip_md(s):
    """Strip markdown bold/italic wrappers and standardize spacing"""
    s = re.sub(r'\*{1,3}', '', s).strip()
    s = re.sub(r'\s+', ' ', s)
    return s

def _extract_section_items(text, section_patterns):
    """Extract (title, why_text) pairs from a markdown section.
    Handles three formats:
    1. H3 subsections: ### N. **Title** followed by body paragraphs
    2. Numbered/bullet lists: N. **Title** or - **Title** followed by body paragraphs
    3. Tables: | **Item** | Why explanation | (very common in older READMEs)"""
    items = []
    in_section = False
    current_title = None
    current_body = []
    in_table = False
    
    for line in text.split("\n"):
        ls = line.strip()
        
        if not in_section:
            for pat in section_patterns:
                if re.match(pat, ls, re.IGNORECASE):
                    in_section = True
                    break
            continue
        
        # End of section: next H2 heading or horizontal rule
        if re.match(r'^#{2}\s+(?!#)', ls) or re.match(r'^---+', ls):
            break
        
        # ---------- TABLE FORMAT ----------
        # Start of a table: header row like | Item | Why |
        if re.match(r'^\|.*\|.*\|', ls):
            # Is this a header or separator row?
            if re.match(r'^\|[\s\-:]+\|', ls):
                # separator row like |---|---|, skip
                in_table = True
                continue
            if in_table or re.match(r'^\|.*\*\*.*\|\s*(.*)', ls):
                # Data row or header row with bold text
                cols = [c.strip() for c in ls.split('|')[1:-1]]
                # Skip header row (short column labels)
                if len(cols) >= 2 and len(cols[0]) > 5:
                    title = _strip_md(cols[0])
                    why = ' | '.join(cols[1:]) if len(cols) > 1 else ''
                    items.append({'title': title, 'why': why.strip()})
                in_table = True
                continue
            else:
                # First row, signal table mode
                in_table = True
                continue
        
        # End of table (non-table line after table rows)
        if in_table and not re.match(r'^\|', ls):
            in_table = False
        
        # ---------- H3 SUBSECTION FORMAT ----------
        m = re.match(r'^#{3}\s*\d+\.\s*(.+)', ls)
        if m:
            if current_title:
                body = '\n'.join(current_body).strip()
                items.append({'title': _strip_md(current_title), 'why': body})
            current_title = m.group(1).strip()
            current_body = []
            continue
        
        # ---------- NUMBERED LIST FORMAT ----------
        m = re.match(r'^\d+\.\s*(.+)', ls)
        if m and not in_table:
            if current_title:
                body = '\n'.join(current_body).strip()
                items.append({'title': _strip_md(current_title), 'why': body})
            current_title = m.group(1).strip()
            current_body = []
            continue
        
        # ---------- BULLET LIST FORMAT ----------
        m = re.match(r'^[-•]\s+\*?\*?(.+?)\*?\*?$', ls)
        if m and not current_title and not in_table:
            current_title = m.group(1).strip()
            current_body = []
            continue
        
        # ---------- BODY TEXT ----------
        if ls and not ls.startswith('#') and not ls.startswith('|') and not ls.startswith('---'):
            if current_title:
                current_body.append(ls)
    
    # Save last item
    if current_title:
        body = '\n'.join(current_body).strip()
        items.append({'title': _strip_md(current_title), 'why': body})
    
    # Fallback: if no structured items found but we're in a section with prose text,
    # capture the paragraph as a single item
    if not items and in_section:
        # Re-scan for prose content (skip headers, table markers, empty lines)
        prose_lines = []
        started = False
        for line in text.split("\n"):
            ls = line.strip()
            if not started:
                for pat in section_patterns:
                    if re.match(pat, ls, re.IGNORECASE):
                        started = True
                        break
                continue
            if re.match(r'^#{2}\s+(?!#)', ls) or re.match(r'^---+', ls):
                break
            # Skip table markers and empty lines at start
            if not prose_lines and (not ls or re.match(r'^\|', ls)):
                continue
            if ls and not ls.startswith('#'):
                prose_lines.append(ls)
        prose = '\n'.join(prose_lines).strip()
        if prose:
            items.append({'title': '', 'why': prose})
    
    return items[:15]

def extract_missed(text):
    # Match: "what" followed by "missed" OR "what" followed by "ordered but not" OR "other missed"
    patterns = [
        r'^#{2,3}\s+.*what\s+(was|you|i|were)\s+missed',
        r'^#{2,3}\s+.*what\s+(was|were)\s+ordered\s+but\s+not',
        r'^#{2,3}\s+.*the\s+other\s+missed',
        r'^#{2,3}\s+.*missed\s+orders',
    ]
    return _extract_section_items(text, patterns)

def extract_got_right(text):
    # Match: "what" followed by "got right" or "Was Got Right"
    patterns = [
        r'^#{2,3}\s+.*what\s+(you|i|was|were)\s+got\s+right',
    ]
    return _extract_section_items(text, patterns)

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

def extract_keywords(text):
    """Extract clinical keywords from README for search indexing.
    Pulls from: diagnosis, bold terms, FA coverage table, medication names, mechanism terms."""
    keywords = set()
    
    # All bold terms (clinical concepts are typically bolded in READMEs)
    for m in re.finditer(r'\*\*(.+?)\*\*', text):
        term = m.group(1).strip().lower()
        if len(term) > 2 and len(term) < 60 and not term.startswith('#'):
            keywords.add(term)
            # Add hyphen-less variant preserving spaces (turns "pre-eclampsia" into "preeclampsia")
            deh = term.replace('-', '')
            if deh != term:
                keywords.add(deh)
            # Add individual words (split on spaces, then remove hyphens from each)
            for word in re.findall(r'[a-z]{3,}', deh):
                keywords.add(word)
            for word in re.findall(r'[a-z]{3,}', term):
                keywords.add(word)
                keywords.add(word.replace('-', ''))
    
    # Extract medication names (capitalized drug names)
    for m in re.finditer(r'\b([A-Z][a-z]+(?:[ /]+[A-Z][a-z]+)*)\b', text):
        drug = m.group(1).lower()
        if drug not in ('the','This','That','These','Those','Each','What','Which','When','Where','Case','Score','Date','July','First','Average','High','Completed','Reason','Weight','Total','Diagnosis','Correctly','Should','Optional','Required','Treatment','Timing','Appropriate','Number','Action','Simulated','Physical','General','Neuro','Heart','Chest','Skin','Abdomen','HEENT','Extremities','Spine','Genitalia','Summary','Differential','Hook','Mechanism','Clinical','Attending','Session','Source','First','Coverage','Plate','Plates','Key','What','How','Why','Reactivation','Stage','Stages','Panel','Panels','Left','Right','Center','Bottom','Ask','Once','Classical','Secondary','Both','CCS','USMLE','ACOG','MAGPIE','VEGF','PlGF','CBC','BMP','CMP','LFTs','PT','PTT','INR','UA','US','OB','ED','IV','BP','CNS','PRES','SIADH','NMDA','SNRI','TCA','VZV','PHN','TN','CN','HELLP','AFLP','TTP','HUS','RUQ','AFI','RhoGAM','NNT','AIP','PBG','ALA','PBGD'): continue
        keywords.add(drug)
    
    # Grab topics from First Aid coverage table rows
    for m in re.finditer(r'^\|.*?\|\s*(.+?)\s*\|', text, re.MULTILINE):
        topic = _strip_md(m.group(1)).lower()
        if topic and len(topic) > 3 and not topic.startswith('fa') and not topic.startswith('-'):
            keywords.add(topic)
            for word in re.findall(r'[a-z]{4,}', topic):
                keywords.add(word)
    
    return list(keywords)


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
    keywords = extract_keywords(readme)

    mechanism_html = ""
    if mechanism:
        mechanism_html = f'<div class="mech-box"><div class="mech-title">First Principles</div><div class="mech-body">{md_to_html(mechanism)}</div></div>'

    cases.append({
        'folder': d, 'score': score, 'diagnosis': diagnosis, 'patient': patient,
        'mechanism_html': mechanism_html, 'missed': missed, 'got_right': got_right,
        'images': images, 'date': date_str, 'keywords': keywords
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

/* Markdown-rendered content */
.md-table { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; background:#fafafa; border-radius:8px; overflow:hidden; }
.md-table thead { background:#e8e8ed; }
.md-table th { padding:8px 12px; text-align:left; font-size:11px; font-weight:600; color:#6e6e73; text-transform:uppercase; letter-spacing:0.03em; }
.md-table td { padding:8px 12px; border-bottom:1px solid #f0f0f0; line-height:1.5; }
.md-table tr:last-child td { border-bottom:none; }
.mech-body .md-table th { background:#3a3a3d; color:#86868b; }
.mech-body .md-table td { border-bottom:1px solid #2a2a2d; }
.mech-body .md-table { background:#2a2a2d; }
.mech-body ul, .missed-why ul, .mech-body ol, .missed-why ol { padding-left:20px; margin:8px 0 0; display:flex; flex-direction:column; gap:2px; }
.mech-body li, .missed-why li { margin:0; font-size:inherit; line-height:1.6; }
.mech-body p, .missed-why p { margin:0 0 8px; }
.mech-body p:last-child, .missed-why p:last-child { margin-bottom:0; }
.mech-body hr { border:none; border-top:1px solid #3a3a3d; margin:16px 0; }
.missed-why hr { border:none; border-top:1px solid #e8e8ed; margin:12px 0; }
.mech-body code, .missed-why code { font-family:'JetBrains Mono',monospace; font-size:11px; background:rgba(255,255,255,0.05); padding:1px 5px; border-radius:4px; }
.mech-body pre, .missed-why pre { background:rgba(0,0,0,0.3); padding:10px 12px; border-radius:8px; overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:11px; margin:8px 0; }
.mech-body em, .missed-why em { font-style:italic; }
.md-h2, .md-h3, .md-h4 { margin-top:14px; margin-bottom:6px; }
.md-h2 { font-size:16px; font-weight:700; }
.md-h3 { font-size:14px; font-weight:600; }
.md-h4 { font-size:13px; font-weight:600; }

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

/* Attending chat section */
.attending-section { background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:var(--radius); margin-bottom:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
.attending-header { padding:16px 20px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; }
.attending-header:hover { background:rgba(255,255,255,0.03); }
.attending-header-left { display:flex; align-items:center; gap:10px; }
.attending-icon { width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#7c3aed,#a78bfa); display:flex; align-items:center; justify-content:center; font-size:15px; }
.attending-title { font-size:13px; font-weight:600; color:#e2e8f0; }
.attending-sub { font-size:10px; color:#94a3b8; margin-top:2px; }
.attending-ask-btn { padding:6px 14px; border-radius:8px; border:none; background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; font-family:'Inter',sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
.attending-ask-btn:hover { background:linear-gradient(135deg,#8b5cf6,#7c3aed); transform:translateY(-1px); }
.attending-ask-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
.attending-body { display:none; padding:0 20px 18px; }
.attending-section.open .attending-body { display:block; }
.attending-response { font-size:13px; line-height:1.75; color:#e2e8f0; }
.attending-response p { margin:0 0 10px; }
.attending-response p:last-child { margin-bottom:0; }
.attending-response strong { color:#fbbf24; font-weight:600; }
.attending-response em { color:#a78bfa; font-style:italic; }
.attending-spinner { display:flex; align-items:center; gap:8px; color:#94a3b8; font-size:12px; padding:12px 0; }
.attending-spinner .spinner-dot { width:5px; height:5px; border-radius:50%; background:#7c3aed; animation:spinner-pulse 1s infinite; }
.attending-spinner .spinner-dot:nth-child(2) { animation-delay:0.2s; }
.attending-spinner .spinner-dot:nth-child(3) { animation-delay:0.4s; }
@keyframes spinner-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
.attending-error { color:#f87171; font-size:12px; padding:12px 0; }
.attending-source { font-size:9px; color:#64748b; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); }
.api-key-prompt { font-size:12px; color:#94a3b8; padding:12px 0; }
.api-key-prompt input { width:100%; padding:8px 10px; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#e2e8f0; font-family:'JetBrains Mono',monospace; font-size:11px; margin:8px 0; }
.api-key-prompt button { padding:6px 14px; border-radius:6px; border:none; background:#7c3aed; color:#fff; font-family:'Inter',sans-serif; font-size:11px; font-weight:600; cursor:pointer; }
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
    search_terms = ' '.join(c['keywords'] + [c['diagnosis'].lower(), c['diagnosis'].lower().replace('-',''), c['patient'].lower()])
    html_parts.append(f'''    <div class="case-nav-card{active}" onclick="switchCase('{sid}')" data-search="{search_terms.replace(chr(34), '').replace('<','').replace('>','')}">
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
            title_html = _inline_md(item['title']) if item['title'] else ''
            why_html = md_to_html(item['why']) if item['why'] else ''
            if title_html:
                html_parts.append(f'''    <div class="missed-item"><div class="missed-order"><span class="missed-dot"></span>{title_html}</div><div class="missed-why">{why_html}</div></div>''')
            elif why_html:
                html_parts.append(f'''    <div class="missed-item"><div class="missed-why">{why_html}</div></div>''')
        html_parts.append('  </div>\n</div>')

    # Got Right
    if c['got_right']:
        html_parts.append(f'''<div class="section">
  <div class="section-header" onclick="this.parentElement.classList.toggle('open')"><div class="section-header-left"><div class="section-icon ordered">✓</div><span class="section-title">What I Got Right</span></div><div class="section-chevron">▾</div></div>
  <div class="section-body">''')
        for item in c['got_right']:
            title_html = _inline_md(item['title']) if item['title'] else ''
            why_html = md_to_html(item['why']) if item['why'] else ''
            if title_html:
                html_parts.append(f'''    <div class="missed-item"><div class="got-right-order"><span class="got-right-dot"></span>{title_html}</div><div class="missed-why">{why_html}</div></div>''')
            elif why_html:
                html_parts.append(f'''    <div class="missed-item"><div class="missed-why">{why_html}</div></div>''')
        html_parts.append('  </div>\n</div>')

    # Attending Teach Me section
    html_parts.append(f'''<div class="attending-section" id="attending-{sid}">
  <div class="attending-header" onclick="var s=document.getElementById('attending-{sid}');s.classList.toggle('open');">
    <div class="attending-header-left">
      <div class="attending-icon">🧠</div>
      <div><div class="attending-title">Teach Me, Attending</div><div class="attending-sub">First principles · Mechanism · Spatial logic</div></div>
    </div>
    <button class="attending-ask-btn" id="ask-btn-{sid}" onclick="event.stopPropagation();askAttending('{sid}')">Ask Attending</button>
  </div>
  <div class="attending-body" id="attending-body-{sid}"></div>
</div>''')

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

# Build CASE_CONTEXTS JS object
ctx_entries = []
for c in cases:
    sid = slugify(c['folder'])
    # Build clean missed items for JSON
    missed_json = []
    for item in c.get('missed', []):
        missed_json.append({
            'title': item.get('title', ''),
            'why': re.sub(r'<[^>]+>', '', item.get('why', ''))
        })
    # Extract plain text mechanism (first 500 chars)
    mech = re.sub(r'<[^>]+>', '', c.get('mechanism_html', ''))[:500]
    ctx_entry = {
        'diagnosis': c['diagnosis'].replace("'", "\\'"),
        'patient': c['patient'].replace("'", "\\'"),
        'score': c['score'],
        'missed': missed_json,
        'mechanism': mech.replace("'", "\\'").replace('\n', ' ')
    }
    ctx_entries.append(f"'{sid}': {{diagnosis:'{ctx_entry['diagnosis']}',patient:'{ctx_entry['patient']}',score:{ctx_entry['score']},missed:{json.dumps(ctx_entry['missed'])},mechanism:'{ctx_entry['mechanism']}'}}")

html_parts.append('''<script>CASE_CONTEXTS={' + ','.join(ctx_entries) + '};</script>''')

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

function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox').classList.add('active'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeLightbox(); });

// --- Attending Chat ---
var CASE_CONTEXTS = {};
var DEEPSEEK_KEY = localStorage.getItem('schoonmaker_deepseek_key') || '';

function askAttending(sid) {
  var section = document.getElementById('attending-' + sid);
  var body = document.getElementById('attending-body-' + sid);
  var btn = document.getElementById('ask-btn-' + sid);
  
  if (!section.classList.contains('open')) {
    section.classList.add('open');
  }
  
  if (!DEEPSEEK_KEY) {
    body.innerHTML = '<div class="api-key-prompt"><strong>DeepSeek API key needed</strong><p style="margin-top:4px">Paste your key below. It stays in your browser (localStorage) and is never sent anywhere except to DeepSeek.</p><input type="password" id="key-input-' + sid + '" placeholder="sk-..."><br><button onclick="saveKeyThenAsk(\'' + sid + '\')">Save &amp; Ask</button></div>';
    return;
  }
  
  var ctx = CASE_CONTEXTS[sid];
  if (!ctx) { body.innerHTML = '<div class="attending-error">No case context found.</div>'; return; }
  
  body.innerHTML = '<div class="attending-spinner"><div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div> The attending is thinking...</div>';
  btn.disabled = true;
  btn.textContent = 'Thinking...';
  
  var missedText = ctx.missed.map(function(m,i) { return (i+1) + '. ' + m.title + (m.why ? ' \u2014 ' + m.why.replace(/<[^>]+>/g,'').substring(0,200) : ''); }).join('\n');
  var userMsg = 'I just finished this CCS case. Here is the context:\n\n' +
    'Diagnosis: ' + ctx.diagnosis + '\n' +
    'My score: ' + ctx.score + '%\n' +
    'Patient: ' + ctx.patient + '\n\n' +
    'What I missed:\n' + (missedText || 'No specific items recorded.') + '\n\n' +
    'Teach me what I missed from first principles. Lead with mechanism. Answer the spatial/physical why. Connect findings to each other. Use contrast to sharpen. End with a clinical anchor. Keep it tight. The teaching style: a brilliant attending who loves mechanism, not a textbook. No bullet lists of features without explaining why they exist.';
  
  var systemPrompt = 'You are a brilliant attending physician teaching a medical student. You teach from first principles: physics, biology, chemistry. Not memorization. Your voice: confident, direct, excited by mechanism. Short sentences. No hedging. No passive voice. Every explanation should make the learner feel "Of course. How could it be any other way?"\n\nRules:\n1. Lead with mechanism, not the feature\n2. Answer the spatial/physical "why"\n3. Connect findings to each other\n4. Use contrast to sharpen understanding\n5. End with a clinical anchor\n6. Never bullet-point a list of features without explaining why they exist\n7. Keep each explanation tight\n8. Occasional questions back to the learner\n9. Use spatial language: "picture..." "think of..." "look at..."';
  
  fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ]
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    btn.disabled = false;
    btn.textContent = 'Ask Attending';
    var content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (!content) {
      body.innerHTML = '<div class="attending-error">The attending had no response. Check your API key or try again.</div>';
      return;
    }
    var html = content
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    body.innerHTML = '<div class="attending-response"><p>' + html + '</p></div><div class="attending-source">DeepSeek \u00b7 Immersa attending voice \u00b7 temp 0.7</div>';
  })
  .catch(function(e) {
    btn.disabled = false;
    btn.textContent = 'Ask Attending';
    body.innerHTML = '<div class="attending-error">Could not reach DeepSeek. ' + e.message + '</div>';
  });
}

function saveKeyThenAsk(sid) {
  var input = document.getElementById('key-input-' + sid);
  if (input && input.value.trim()) {
    DEEPSEEK_KEY = input.value.trim();
    localStorage.setItem('schoonmaker_deepseek_key', DEEPSEEK_KEY);
    askAttending(sid);
  }
}
</script>
</body>
</html>''')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(html_parts))

print(f"Written: {OUT}")
print(f"Cases: {len(cases)}")
kb = os.path.getsize(OUT) / 1024
print(f"Size: {kb:.0f} KB")
