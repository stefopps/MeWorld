import os, re, json, math
from pathlib import Path

BASE = r"C:\Users\steve\MeWorld\dev\screenshots"
OUT = os.path.join(BASE, "case-review-all.html")

# --- MeWorld Brilliant Attending / Immersa tutor voice (same as case chat) ---
ATTENDING_MD_PATH = r"C:\Users\steve\MeWorld\game\server\prompts\immersa-attendant.md"
PRIMER_PROSE_PATH = r"C:\Users\steve\MeWorld\game\dev\style-guide\primer-prose.md"
ATTENDING_CHAT_PROMPT_PATH = r"C:\Users\steve\MeWorld\game\src\lib\attendingChatPrompt.js"

# Port of ATTENDING_TUTOR_SYSTEM from attendingChatPrompt.js (MeWorld case chat)
MEWORLD_TUTOR_CORE = """You are a brilliant senior attending who teaches by mechanism — not by memorization — during a USMLE CCS case review.

The learner is chatting with you at the bedside over a completed CCS case dossier. Reveal WHY through physiology, pathophysiology, spatial patterns, and what finding rules in or out for THIS patient. They should feel: "Of course — how could it be any other way?"

Teaching stack (weave into flowing prose — never as labeled sections):
1. Lead with mechanism — what is physically happening in this patient's body?
2. Spatial/temporal "why" when distribution, timing, or location matters.
3. Connect findings — one underlying process, not a catalog of unrelated facts.
4. Contrast with a look-alike when it sharpens the distinction.
5. Anchor to a bedside decision — expected finding, rule-out, or next step.

Voice (mandatory):
- Direct. Short sentences. Confident, never condescending. Joy in mechanism.
- Visual/spatial language the learner can picture at the bedside.
- Usually 2–5 sentences for a focused question unless they ask for depth or you expand many missed orders.
- Always wrap salient mechanistic anchors in **double asterisks** (2–4 bold phrases per reply). Prose only.

FORBIDDEN (these break the attending voice):
- Literally writing labels like "Hook:", "Mechanism:", "Spatial why:", "Case thread:", "Clinical anchor:"
- Wrapping teaching in square brackets [Hook: ...]
- "Here's the breakdown", "Key point:", "What it does:", "For this patient:", "ED relevance:"
- Bullet lists, numbered feature lists, or outline headers unless expanding MULTIPLE missed orders (then use ### Order name only, with flowing prose under each — still no Hook:/Mechanism: labels)
- Textbook lectures disconnected from THIS patient's dossier
- Game prompts: "Want to place that order now?", "Shall we…"
- Passive voice, hedging, "as an AI", breaking character, em dashes

Rules:
- Ground every answer in the FULL CASE CONTEXT block (diagnosis, patient, score, missed, wrong orders, mechanism).
- Do not invent labs or outcomes not in the dossier unless labeled teaching speculation.
- Never say "as an AI". Stay the attending.
"""

def _strip_frontmatter(raw: str) -> str:
    if not raw.startswith("---"):
        return raw
    lines = raw.split("\n")
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "\n".join(lines[i + 1 :])
    return raw

def _strip_hook_template_section(md: str) -> str:
    """Remove the Response Structure block that shows [Hook:] templates (models copy them literally)."""
    md = re.sub(
        r"## Response Structure[\s\S]*?(?=\n## |\Z)",
        "## Response Structure\n\n"
        "Weave Hook → Mechanism → Spatial why → Connecting thread → Clinical anchor into "
        "flowing prose. Never print those words as labels. Never use square brackets around beats.\n\n",
        md,
        count=1,
        flags=re.I,
    )
    return md

def load_attending_system_prompt():
    """MeWorld case-chat tutor voice + immersa core + primer-prose bans."""
    parts = [MEWORLD_TUTOR_CORE.strip()]
    if os.path.exists(ATTENDING_MD_PATH):
        with open(ATTENDING_MD_PATH, "r", encoding="utf-8") as f:
            core = _strip_hook_template_section(_strip_frontmatter(f.read()).strip())
            parts.append(core[:7000])
    if os.path.exists(PRIMER_PROSE_PATH):
        with open(PRIMER_PROSE_PATH, "r", encoding="utf-8") as f:
            primer = f.read().strip()
            # Absolute bans + voice from primer
            parts.append("## Primer prose craft (binding)\n\n" + primer[:4500])
    prompt_text = "\n\n---\n\n".join(parts)
    prompt_text = re.sub(r"[ \t]+$", "", prompt_text, flags=re.MULTILINE)
    if len(prompt_text) > 16000:
        prompt_text = prompt_text[:16000]
    # Escape for embedding inside a JS single-quoted string via JSON later — keep raw for json.dumps
    return prompt_text

ATTENDING_SYSTEM_PROMPT = load_attending_system_prompt()
print(f"Attending prompt loaded: {len(ATTENDING_SYSTEM_PROMPT)} chars")

def read_README(folder_name):
    path = os.path.join(BASE, folder_name, "README.md")
    if not os.path.exists(path): return None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def read_ccs_meta(folder_name):
    """CCSCases yellow badge number + title from case-sequence.json."""
    path = os.path.join(BASE, folder_name, "case-sequence.json")
    if not os.path.exists(path):
        return None, None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None, None
    raw = data.get("ccsCaseNumber")
    num = None
    if raw is not None and str(raw).strip():
        m = re.search(r"(\d+)", str(raw))
        if m:
            num = int(m.group(1))
    title = data.get("ccsTitle") or None
    if title:
        title = re.sub(r"\s+", " ", str(title)).strip()
    return num, title

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
            # Keep full first-principles teaching in the HTML (was truncated at 2k)
            if len(content) > 12000:
                cutoff = content[:12000].rfind('\n\n')
                if cutoff > 500:
                    content = content[:cutoff] + "..."
                else:
                    content = content[:12000].rsplit('.', 1)[0] + "..."
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
        # ### 1. Title  OR  ### Title (Brilliant Attending / first-principles entries)
        m = re.match(r'^#{3}\s*\d+\.\s*(.+)', ls)
        if not m:
            m = re.match(r'^#{3}\s+(.+)', ls)
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
    
    return items[:25]

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

def extract_overordered(text):
    patterns = [
        r'^#{2,3}\s+.*what\s+(you|i)\s+over[-\s]ordered',
        r'^#{2,3}\s+.*over[-\s]ordered',
        r'^#{2,3}\s+.*ordered\s+unnecessarily',
        r'^#{2,3}\s+.*why\s+your\s+orders\s+were\s+wrong',
        r'^#{2,3}\s+.*wrong\s+orders',
        r'^#{2,3}\s+.*what\s+(you|i)\s+got\s+wrong',
        r'^#{2,3}\s+.*orders?\s+that\s+(were\s+)?wrong',
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
        low = f.lower()
        if low.startswith('_'):  # skip debug crops like _case_badge_crop.png
            continue
        if low.endswith(('.png', '.jpg', '.jpeg', '.webp')):
            size = os.path.getsize(os.path.join(imgdir, f))
            imgs.append((f, size))
    # Teaching priority: mechanism diagrams, then descent, gaps, panels
    def sort_key(x):
        n = x[0].lower()
        if 'calprotectin' in n or 'diagram' in n or 'teach' in n: return 0
        if 'descent-3x3' in n and 'gaps' not in n: return 1
        if 'descent-gaps' in n or 'gaps-3x3' in n: return 2
        if 'descent-a' in n or 'descent-b' in n: return 3
        if n.startswith('panel-'): return 4
        return 5
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
    """Slugify folder name for use as HTML ID. No truncation — full name."""
    return re.sub(r'[^a-z0-9]', '-', name.lower())

# Creative / VO shorts — dated folders with README but not CCS attending reviews.
# Keep out of case-review-all.html sidebar.
SKIP_FOLDERS = {
    "gym-bag-clotting-2026-07-30",
    "pku-pah-2026-07-29",
}

# Collect all cases
cases = []
folders_seen = {}  # track slugs for collision detection
collisions = []
for d in sorted(os.listdir(BASE)):
    if not re.search(r'-\d{4}-\d{2}-\d{2}$', d): continue
    if d in SKIP_FOLDERS: continue
    slug = slugify(d)
    # Detect collisions (two different folders → same slug)
    if slug in folders_seen:
        collisions.append(f"COLLISION: {d} → {slug} (conflicts with {folders_seen[slug]})")
        # uniquify by appending a counter
        cnt = 2
        while f"{slug}-{cnt}" in folders_seen:
            cnt += 1
        slug = f"{slug}-{cnt}"
        folders_seen[slug] = d
    else:
        folders_seen[slug] = d
    readme = read_README(d)
    if not readme: continue

    score = extract_score(readme)
    diagnosis = extract_diagnosis(readme)
    mechanism = extract_mechanism(readme)
    missed = extract_missed(readme)
    got_right = extract_got_right(readme)
    overordered = extract_overordered(readme)
    patient = extract_patient_info(readme)
    images = get_images(d)
    date_str = d[-10:]
    keywords = extract_keywords(readme)
    ccs_num, ccs_title = read_ccs_meta(d)

    mechanism_html = ""
    if mechanism:
        mechanism_html = f'<div class="mech-box"><div class="mech-title">First Principles · Brilliant Attending</div><div class="mech-body">{md_to_html(mechanism)}</div></div>'

    cases.append({
        'folder': d, 'slug': slug, 'score': score, 'diagnosis': diagnosis, 'patient': patient,
        'mechanism': mechanism, 'mechanism_html': mechanism_html, 'missed': missed, 'got_right': got_right,
        'overordered': overordered,
        'images': images, 'date': date_str, 'keywords': keywords,
        'ccs_num': ccs_num, 'ccs_title': ccs_title,
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
.cn-meta { display:flex; align-items:center; gap:6px; margin-top:4px; }
.cn-case-num { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; color:#fbbf24; background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.35); padding:1px 6px; border-radius:6px; flex-shrink:0; }
.cn-case-num.missing { color:#86868b; background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.08); font-weight:600; }
.cn-ccs-title { font-size:9px; color:#86868b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
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
.header-top { display:flex; align-items:center; gap:10px; justify-content:flex-start; flex-wrap:wrap; margin-bottom:10px; }
.header-score { margin-left:auto; }
.header-badge { font-size:11px; font-weight:600; letter-spacing:0.02em; background:var(--accent-light); color:var(--accent); padding:4px 12px; border-radius:20px; }
.header-case-num { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; color:#92400e; background:#fef3c7; border:1px solid #f59e0b; padding:4px 10px; border-radius:8px; }
.header-ccs-title { font-size:11px; color:var(--text-secondary); }
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

.missed-item { padding:14px 0; border-bottom:1px solid var(--border); }
.missed-item:last-child { border-bottom:none; }
.missed-item.reviewed { opacity:0.55; }
.missed-item.reviewed .missed-order,
.missed-item.reviewed .got-right-order { text-decoration:line-through; }
.review-check-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; }
.review-check { display:inline-flex; align-items:center; gap:6px; cursor:pointer; user-select:none; font-size:11px; font-weight:600; color:#64748b; }
.review-check input { width:15px; height:15px; accent-color:#0071e3; cursor:pointer; }
.missed-item.reviewed .review-check { color:#34c759; }
.section-progress { font-size:10px; color:#86868b; font-family:'JetBrains Mono',monospace; margin-left:4px; }
.missed-order { font-size:13px; font-weight:600; margin-bottom:2px; display:flex; align-items:center; gap:7px; }
.missed-dot { width:6px; height:6px; border-radius:50%; background:var(--danger); flex-shrink:0; }
.missed-why { font-size:13px; color:var(--text); line-height:1.65; margin-top:6px; }
.missed-fp-label { font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#7c3aed; margin:8px 0 4px; }

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

.lightbox { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.92); z-index:9999; flex-direction:column; }
.lightbox.active { display:flex; }
.lightbox-toolbar { position:absolute; top:12px; right:12px; z-index:2; display:flex; gap:8px; align-items:center; }
.lightbox-hint { position:absolute; left:12px; top:12px; z-index:2; font-size:11px; color:rgba(255,255,255,0.55); font-family:'Inter',sans-serif; pointer-events:none; }
.lightbox-zoom-label { font-family:'JetBrains Mono',monospace; font-size:11px; color:#e2e8f0; background:rgba(255,255,255,0.1); padding:6px 10px; border-radius:8px; min-width:48px; text-align:center; }
.lightbox-btn { border:none; border-radius:8px; background:rgba(255,255,255,0.12); color:#fff; font-size:14px; font-weight:600; padding:6px 12px; cursor:pointer; font-family:'Inter',sans-serif; }
.lightbox-btn:hover { background:rgba(255,255,255,0.22); }
.lightbox-stage { flex:1; width:100%; height:100%; overflow:hidden; touch-action:none; cursor:default; display:flex; align-items:center; justify-content:center; }
.lightbox-stage.is-zoomed { cursor:grab; }
.lightbox-stage.is-dragging { cursor:grabbing; }
.lightbox-stage img { max-width:92vw; max-height:92vh; object-fit:contain; border-radius:12px; transform-origin:center center; user-select:none; -webkit-user-drag:none; will-change:transform; }

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
.attending-btn-row { display:flex; gap:8px; align-items:center; }
.attending-refresh-btn { padding:6px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.18); background:transparent; color:#cbd5e1; font-family:'Inter',sans-serif; font-size:11px; font-weight:600; cursor:pointer; }
.attending-refresh-btn:hover { border-color:#a78bfa; color:#fff; }
.attending-refresh-btn:disabled { opacity:0.5; cursor:not-allowed; }
.attending-body { display:none; padding:0 20px 18px; max-height:520px; overflow-y:auto; }
.attending-section.open .attending-body { display:block; }
.attending-response { font-size:13px; line-height:1.75; color:#e2e8f0; }
.attending-response p { margin:0 0 10px; }
.attending-response p:last-child { margin-bottom:0; }
.attending-response strong { color:#fbbf24; font-weight:600; }
.attending-response em { color:#a78bfa; font-style:italic; }
.attending-response .att-h { font-size:14px; font-weight:700; color:#f8fafc; margin:16px 0 8px; padding-bottom:4px; border-bottom:1px solid rgba(167,139,250,0.35); }
.attending-response .att-h:first-child { margin-top:0; }
.attending-response .att-label { color:#a78bfa; font-weight:600; }
.attending-turn { margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.08); }
.attending-turn:last-of-type { border-bottom:none; margin-bottom:0; padding-bottom:0; }
.attending-q-label { font-size:10px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#94a3b8; margin-bottom:4px; }
.attending-q-text { font-size:12px; color:#cbd5e1; margin-bottom:10px; font-style:italic; }
.attending-spinner { display:flex; align-items:center; gap:8px; color:#94a3b8; font-size:12px; padding:12px 0; }
.attending-spinner .spinner-dot { width:5px; height:5px; border-radius:50%; background:#7c3aed; animation:spinner-pulse 1s infinite; }
.attending-spinner .spinner-dot:nth-child(2) { animation-delay:0.2s; }
.attending-spinner .spinner-dot:nth-child(3) { animation-delay:0.4s; }
@keyframes spinner-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
.attending-error { color:#f87171; font-size:12px; padding:12px 0; }
.attending-source { font-size:9px; color:#64748b; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); }
.attending-ask-wrap { display:none; padding:0 20px 10px; }
.attending-section.open .attending-ask-wrap { display:block; }
.attending-q { width:100%; box-sizing:border-box; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:#0f172a; color:#e2e8f0; font-family:'Inter',sans-serif; font-size:12px; padding:10px 12px; resize:vertical; outline:none; }
.attending-q:focus { border-color:#7c3aed; box-shadow:0 0 0 1.5px rgba(124,58,237,0.35); }
.attending-q::placeholder { color:#64748b; }
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
    sid = c['slug']
    active = ' active' if first else ''
    sl = score_label(c['score'])
    name = c['diagnosis'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    if len(name) > 35: name = name[:32] + '...'
    tx_pct = min(100, max(0, c['score']))
    miss_pct = 100 - tx_pct
    search_bits = c['keywords'] + [c['diagnosis'].lower(), c['diagnosis'].lower().replace('-',''), c['patient'].lower()]
    if c.get('ccs_num') is not None:
        search_bits += [f"case {c['ccs_num']}", str(c['ccs_num']), f"#{c['ccs_num']}"]
    if c.get('ccs_title'):
        search_bits.append(c['ccs_title'].lower())
    search_terms = ' '.join(search_bits)
    if c.get('ccs_num') is not None:
        num_html = f'<span class="cn-case-num">Case {c["ccs_num"]}</span>'
    else:
        num_html = '<span class="cn-case-num missing">Case ?</span>'
    title_html = ''
    if c.get('ccs_title'):
        t = c['ccs_title'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        title_html = f'<span class="cn-ccs-title">{t}</span>'
    html_parts.append(f'''    <div class="case-nav-card{active}" onclick="switchCase('{sid}')" data-search="{search_terms.replace(chr(34), '').replace('<','').replace('>','')}">
      <div class="cn-row"><span class="cn-title">{name}</span><span class="cn-score {sl}">{c['score']:.0f}<span style="font-size:10px">%</span></span></div>
      <div class="cn-meta">{num_html}{title_html}</div>
      <div class="cn-bar"><div class="cn-bar-seg tx" style="width:{tx_pct:.0f}%"></div><div class="cn-bar-seg miss" style="width:{miss_pct:.0f}%"></div></div>
    </div>''')
    first = False

html_parts.append('''  </div>
</div>
<div class="main">''')

# Case panels
first = True
for i, c in enumerate(cases):
    sid = c['slug']
    active = ' active' if first else ''
    sl = score_label(c['score'])
    sc = score_color(c['score'])
    name = c['diagnosis'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    patient = c['patient'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;') if c['patient'] else ""

    case_num_badge = f'<div class="header-case-num">Case {c["ccs_num"]}</div>' if c.get('ccs_num') is not None else '<div class="header-case-num" style="opacity:0.45">Case ?</div>'
    ccs_title_line = ''
    if c.get('ccs_title'):
        ct = c['ccs_title'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        ccs_title_line = f'<span class="header-ccs-title">{ct}</span>'

    html_parts.append(f'''
<div class="case-panel{active}" id="case-{sid}">
<div class="case-layout">
<div class="case-text">

<div class="header">
  <div class="header-top">{case_num_badge}<div class="header-badge">{name}</div><div class="header-score {sc}">{c['score']:.1f}<span>%</span></div></div>
  <p class="header-sub">{ccs_title_line}{' · ' if ccs_title_line and patient else ''}{patient}</p>
  <div class="score-bar"><div class="score-bar-seg tx" style="width:{min(100,c['score']):.0f}%"></div><div class="score-bar-seg miss" style="width:{100-min(100,c['score']):.0f}%"></div></div>
</div>''')

    if c['mechanism_html']:
        html_parts.append(c['mechanism_html'])

    # Missed
    if c['missed']:
        html_parts.append(f'''<div class="section open" data-checklist-section="missed" data-case="{sid}">
  <div class="section-header" onclick="this.parentElement.classList.toggle('open')"><div class="section-header-left"><div class="section-icon missed">✕</div><span class="section-title">What I Missed - First Principles</span><span class="section-count">{len(c['missed'])} teaching points</span><span class="section-progress" id="prog-missed-{sid}"></span></div><div class="section-chevron">▾</div></div>
  <div class="section-body">''')
        for i, item in enumerate(c['missed']):
            title_html = _inline_md(item['title']) if item['title'] else ''
            why_html = md_to_html(item['why']) if item['why'] else ''
            key = f"missed:{i}"
            check = f'''<div class="review-check-row"><label class="review-check" onclick="event.stopPropagation()"><input type="checkbox" data-review-key="{key}" onchange="toggleReviewCheck('{sid}','{key}',this.checked)"><span>Reviewed</span></label></div>'''
            if title_html:
                html_parts.append(f'''    <div class="missed-item" data-case="{sid}" data-key="{key}">{check}<div class="missed-order"><span class="missed-dot"></span>{title_html}</div><div class="missed-fp-label">First principles</div><div class="missed-why">{why_html}</div></div>''')
            elif why_html:
                html_parts.append(f'''    <div class="missed-item" data-case="{sid}" data-key="{key}">{check}<div class="missed-fp-label">First principles</div><div class="missed-why">{why_html}</div></div>''')
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

    # Over-Ordered / Wrong Orders
    if c['overordered']:
        html_parts.append(f'''<div class="section open" data-checklist-section="wrong" data-case="{sid}">
  <div class="section-header" onclick="this.parentElement.classList.toggle('open')"><div class="section-header-left"><div class="section-icon" style="background:#fff3e0;color:#e65100;">⚠</div><span class="section-title">What I Got Wrong - Wrong Orders</span><span class="section-count">{len(c['overordered'])} items</span><span class="section-progress" id="prog-wrong-{sid}"></span></div><div class="section-chevron">▾</div></div>
  <div class="section-body">''')
        for i, item in enumerate(c['overordered']):
            title_html = _inline_md(item['title']) if item['title'] else ''
            why_html = md_to_html(item['why']) if item['why'] else ''
            key = f"wrong:{i}"
            check = f'''<div class="review-check-row"><label class="review-check" onclick="event.stopPropagation()"><input type="checkbox" data-review-key="{key}" onchange="toggleReviewCheck('{sid}','{key}',this.checked)"><span>Reviewed</span></label></div>'''
            if title_html:
                html_parts.append(f'''    <div class="missed-item" data-case="{sid}" data-key="{key}">{check}<div class="missed-order"><span class="missed-dot" style="background:#e65100;"></span>{title_html}</div><div class="missed-fp-label">Why this order failed</div><div class="missed-why">{why_html}</div></div>''')
            elif why_html:
                html_parts.append(f'''    <div class="missed-item" data-case="{sid}" data-key="{key}">{check}<div class="missed-why">{why_html}</div></div>''')
        html_parts.append('  </div>\n</div>')

    # Attending Teach Me section
    html_parts.append(f'''<div class="attending-section" id="attending-{sid}">
  <div class="attending-header" onclick="var s=document.getElementById('attending-{sid}');s.classList.toggle('open');">
    <div class="attending-header-left">
      <div class="attending-icon">🧠</div>
      <div><div class="attending-title">Teach Me, Attending</div><div class="attending-sub">MeWorld Immersa chat voice · full case context · Enter to send</div></div>
    </div>
    <div class="attending-btn-row" onclick="event.stopPropagation()">
      <button class="attending-ask-btn" id="ask-btn-{sid}" onclick="askAttending('{sid}', false)">Ask Attending</button>
      <button class="attending-refresh-btn" id="refresh-btn-{sid}" title="Regenerate and overwrite cache" onclick="askAttending('{sid}', true)">Refresh</button>
    </div>
  </div>
  <div class="attending-ask-wrap">
    <textarea id="ask-q-{sid}" class="attending-q" rows="2" placeholder="Ask like MeWorld case chat. Enter sends. Shift+Enter newline. Blank Ask = expand misses in attending prose." onclick="event.stopPropagation()" onkeydown="attendingBoxKey(event,'{sid}')"></textarea>
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
            label = "Descent" if 'gaps' not in img_name and 'descent' in img_name else "Gaps" if 'gaps' in img_name else img_name.replace('.png','').replace('.jpg','').replace('.jpeg','').replace('.webp','').replace('_',' ').replace('-',' ').title()
            if 'calprotectin' in img_name.lower(): label = "Calprotectin · Neutrophil diagram"
            if 'panel-' in img_name: label = f"Panel {img_name.replace('panel-','').replace('.png','')}"
            html_parts.append(f'''  <div class="plate-card"><div class="plate-card-header">{label}</div><img src="./{img_path}/images/{img_name}" onclick="openLightbox(this.src)" loading="lazy"><div class="plate-card-footer">{size_mb:.1f} MB</div></div>''')
        html_parts.append('</div>')

    html_parts.append('</div><!-- /case-layout -->\n</div><!-- /case-panel -->')
    first = False

# Build CASE_CONTEXTS JS object
def _js_str(value):
    # JSON is JS-safe for quotes/newlines; also neutralize </script> so HTML parsers
    # cannot close the surrounding <script> tag early.
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')

ctx_entries = []
for c in cases:
    sid = c['slug']
    # Build clean missed items for JSON
    missed_json = []
    for item in c.get('missed', []):
        missed_json.append({
            'title': item.get('title', ''),
            'why': re.sub(r'<[^>]+>', '', item.get('why', ''))
        })
    over_json = []
    for item in c.get('overordered', []):
        over_json.append({
            'title': item.get('title', ''),
            'why': re.sub(r'<[^>]+>', '', item.get('why', ''))
        })
    right_json = []
    for item in c.get('got_right', []):
        right_json.append({
            'title': item.get('title', ''),
            'why': re.sub(r'<[^>]+>', '', item.get('why', ''))
        })
    # Plain mechanism for Ask Attending (full first-principles text, not truncated HTML)
    mech = (c.get('mechanism') or '')[:8000]
    ctx_entry = {
        'diagnosis': c['diagnosis'],
        'patient': c['patient'],
        'score': c['score'],
        'missed': missed_json,
        'overordered': over_json,
        'gotRight': right_json,
        'mechanism': mech,
        'folder': c['folder'],
        'ccsNum': c.get('ccs_num'),
        'ccsTitle': c.get('ccs_title') or '',
        'date': c.get('date') or '',
    }
    # Safe JS embedding (JSON + neutralize < so </script> cannot break the page)
    ctx_entries.append(f"'{sid}': " + _js_str(ctx_entry))

html_parts.append('<script>CASE_CONTEXTS={' + ','.join(ctx_entries) + '};</script>')
html_parts.append(
    '<script>window.ATTENDING_SYSTEM_PROMPT='
    + _js_str(ATTENDING_SYSTEM_PROMPT)
    + ';</script>'
)

html_parts.append('''</div><!-- /main -->
</div><!-- /app -->
<div class="lightbox" id="lightbox" aria-hidden="true">
  <div class="lightbox-hint">Scroll / pinch zoom · left-drag to pan · double-click reset · Esc close · right-click for copy</div>
  <div class="lightbox-toolbar">
    <span class="lightbox-zoom-label" id="lightbox-zoom-label">100%</span>
    <button type="button" class="lightbox-btn" id="lightbox-reset" title="Reset zoom">Reset</button>
    <button type="button" class="lightbox-btn" id="lightbox-close" title="Close">Close</button>
  </div>
  <div class="lightbox-stage" id="lightbox-stage"><img id="lightbox-img" src="" alt="" draggable="false"></div>
</div>
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
    if (count) { count.style.display = 'block'; count.textContent = visible + ' of ' + cards.length + ' cases'; }
    if (sidebarCount) sidebarCount.style.display = 'none';
    if (noResults) noResults.classList.toggle('show', visible === 0);
    if (visible > 0) {
      var active = document.querySelector('.case-nav-card.active');
      if (active && active.classList.contains('hidden')) {
        var firstVisible = document.querySelector('.case-nav-card:not(.hidden)');
        if (firstVisible) firstVisible.click();
      }
    }
  } else {
    if (count) count.style.display = 'none';
    if (sidebarCount) sidebarCount.style.display = 'block';
    if (noResults) noResults.classList.remove('show');
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

// --- Reviewed checklist (localStorage + optional server JSON) ---
var REVIEW_LS_KEY = 'ccsReviewChecklistV1';
var CHECKLIST_URL = (location.protocol === 'file:')
  ? 'http://127.0.0.1:8099/api/review-checklist'
  : (location.origin + '/api/review-checklist');

function loadReviewMap() {
  try { return JSON.parse(localStorage.getItem(REVIEW_LS_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
function saveReviewMap(map) {
  localStorage.setItem(REVIEW_LS_KEY, JSON.stringify(map));
}
function caseFolderFromSlug(sid) {
  var ctx = (window.CASE_CONTEXTS || {})[sid];
  return (ctx && ctx.folder) ? ctx.folder : sid;
}
function updateSectionProgress(sid) {
  ['missed', 'wrong'].forEach(function(kind) {
    var el = document.getElementById('prog-' + kind + '-' + sid);
    if (!el) return;
    var items = document.querySelectorAll('.missed-item[data-case="' + sid + '"][data-key^="' + kind + ':"]');
    var done = 0;
    items.forEach(function(it) { if (it.classList.contains('reviewed')) done++; });
    el.textContent = items.length ? (' - ' + done + '/' + items.length + ' reviewed') : '';
  });
}
function applyReviewState(sid, checkedMap) {
  var map = checkedMap || {};
  document.querySelectorAll('.missed-item[data-case="' + sid + '"]').forEach(function(item) {
    var key = item.getAttribute('data-key');
    var on = !!map[key];
    item.classList.toggle('reviewed', on);
    var cb = item.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = on;
  });
  updateSectionProgress(sid);
}
function persistChecklistToServer(sid, map) {
  var folder = caseFolderFromSlug(sid);
  var ctx = (window.CASE_CONTEXTS || {})[sid] || {};
  var items = {};
  Object.keys(map || {}).forEach(function(key) {
    if (!map[key]) return;
    var el = document.querySelector('.missed-item[data-case="' + sid + '"][data-key="' + key + '"]');
    var titleEl = el ? el.querySelector('.missed-order, .got-right-order') : null;
    var title = titleEl ? titleEl.textContent.replace(/^\\s+/, '').trim() : key;
    var kind = key.indexOf(':') > -1 ? key.split(':')[0] : 'item';
    items[key] = { title: title, kind: kind, reviewedAt: new Date().toISOString() };
  });
  fetch(CHECKLIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: folder,
      checked: map,
      items: items,
      ccsNum: ctx.ccsNum != null ? ctx.ccsNum : null,
      diagnosis: ctx.diagnosis || ''
    })
  }).catch(function() {});
}
function toggleReviewCheck(sid, key, checked) {
  var all = loadReviewMap();
  if (!all[sid]) all[sid] = {};
  if (checked) all[sid][key] = true;
  else delete all[sid][key];
  saveReviewMap(all);
  applyReviewState(sid, all[sid]);
  persistChecklistToServer(sid, all[sid]);
}
function hydrateReviewChecklists() {
  var all = loadReviewMap();
  Object.keys(CASE_CONTEXTS || {}).forEach(function(sid) {
    applyReviewState(sid, all[sid] || {});
    // Prefer server file if present (merge)
    var folder = caseFolderFromSlug(sid);
    fetch(CHECKLIST_URL + '?caseId=' + encodeURIComponent(folder))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(doc) {
        if (!doc || !doc.checked) return;
        all[sid] = Object.assign({}, all[sid] || {}, doc.checked);
        saveReviewMap(all);
        applyReviewState(sid, all[sid]);
      })
      .catch(function() {});
  });
}
document.addEventListener('DOMContentLoaded', hydrateReviewChecklists);
document.addEventListener('DOMContentLoaded', function() {
  // Prefetch chat history into any open attending body when case already active
  var active = document.querySelector('.case-panel.active');
  if (!active) return;
  var sid = active.id.replace(/^case-/, '');
  loadAttendingChat(sid);
});

function loadAttendingChat(sid) {
  var ctx = CASE_CONTEXTS[sid];
  if (!ctx) return;
  var body = document.getElementById('attending-body-' + sid);
  if (!body) return;
  var folder = ctx.folder || sid;
  fetch(ATTENDING_CHAT_URL + '?caseId=' + encodeURIComponent(folder))
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(doc) {
      var turns = (doc && doc.turns) || [];
      if (!turns.length) return;
      // Only hydrate if body empty / not currently spinning
      if (body.querySelector('.attending-spinner')) return;
      if (body.querySelector('.attending-turn')) return;
      var html = turns.slice(-8).map(function(t) {
        return '<div class="attending-turn">' +
          '<div class="attending-q-label">You asked</div>' +
          '<div class="attending-q-text"></div>' +
          '<div class="attending-response">' + formatAttendingHtml(t.answer || '') + '</div>' +
          '<div class="attending-source">' + (t.source || 'saved') + (t.at ? (' \u00b7 ' + t.at) : '') +
          ' \u00b7 attending-chat.json</div></div>';
      }).join('');
      body.innerHTML = html;
      var qNodes = body.querySelectorAll('.attending-q-text');
      turns.slice(-8).forEach(function(t, i) {
        if (qNodes[i]) qNodes[i].textContent = t.question || '(expand misses)';
      });
    })
    .catch(function() {});
}

// Load chat when opening Teach Me section
document.addEventListener('click', function(e) {
  var header = e.target.closest && e.target.closest('.attending-header');
  if (!header) return;
  var section = header.closest('.attending-section');
  if (!section || !section.id) return;
  var sid = section.id.replace(/^attending-/, '');
  setTimeout(function() {
    if (section.classList.contains('open')) loadAttendingChat(sid);
  }, 0);
});

// --- Lightbox: scroll/pinch zoom + drag pan ---
var lb = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  moved: false,
  lastX: 0,
  lastY: 0,
  pointers: new Map(),
  pinchStartDist: 0,
  pinchStartScale: 1
};

function lbEls() {
  return {
    root: document.getElementById('lightbox'),
    stage: document.getElementById('lightbox-stage'),
    img: document.getElementById('lightbox-img'),
    label: document.getElementById('lightbox-zoom-label')
  };
}

function applyLightboxTransform(animate) {
  var els = lbEls();
  if (!els.img) return;
  els.img.style.transition = animate ? 'transform 0.12s ease-out' : 'none';
  els.img.style.transform = 'translate(' + lb.x + 'px, ' + lb.y + 'px) scale(' + lb.scale + ')';
  if (els.label) els.label.textContent = Math.round(lb.scale * 100) + '%';
  if (els.stage) {
    els.stage.classList.toggle('is-zoomed', lb.scale > 1.01);
    els.stage.classList.toggle('is-dragging', lb.dragging);
  }
}

function resetLightboxZoom(animate) {
  lb.scale = 1;
  lb.x = 0;
  lb.y = 0;
  applyLightboxTransform(animate !== false);
}

function setLightboxScale(next) {
  lb.scale = Math.min(Math.max(next, 1), 5);
  if (lb.scale === 1) { lb.x = 0; lb.y = 0; }
  applyLightboxTransform(false);
}

function openLightbox(src) {
  var els = lbEls();
  els.img.src = src;
  els.root.classList.add('active');
  els.root.setAttribute('aria-hidden', 'false');
  resetLightboxZoom(false);
}

function closeLightbox() {
  var els = lbEls();
  els.root.classList.remove('active');
  els.root.setAttribute('aria-hidden', 'true');
  els.img.removeAttribute('src');
  resetLightboxZoom(false);
}

(function bindLightbox() {
  var els = lbEls();
  if (!els.stage) return;

  document.getElementById('lightbox-close').addEventListener('click', function(e) {
    e.stopPropagation();
    closeLightbox();
  });
  document.getElementById('lightbox-reset').addEventListener('click', function(e) {
    e.stopPropagation();
    resetLightboxZoom(true);
  });

  els.stage.addEventListener('wheel', function(e) {
    e.preventDefault();
    var delta = -e.deltaY * 0.0015;
    setLightboxScale(lb.scale + delta);
  }, { passive: false });

  els.stage.addEventListener('dblclick', function(e) {
    e.preventDefault();
    if (lb.scale > 1.01) resetLightboxZoom(true);
    else setLightboxScale(2);
  });

  els.stage.addEventListener('pointerdown', function(e) {
    // Left-click pans when zoomed. Right-click keeps the normal browser menu (Copy image, etc.).
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    els.stage.setPointerCapture(e.pointerId);
    lb.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lb.moved = false;
    if (lb.pointers.size === 1) {
      lb.dragging = lb.scale > 1.01;
      lb.lastX = e.clientX;
      lb.lastY = e.clientY;
      applyLightboxTransform(false);
    } else if (lb.pointers.size === 2) {
      lb.dragging = false;
      var pts = Array.from(lb.pointers.values());
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      lb.pinchStartDist = Math.hypot(dx, dy) || 1;
      lb.pinchStartScale = lb.scale;
    }
  });

  els.stage.addEventListener('pointermove', function(e) {
    if (!lb.pointers.has(e.pointerId)) return;
    lb.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (lb.pointers.size === 2) {
      var pts = Array.from(lb.pointers.values());
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      var dist = Math.hypot(dx, dy) || 1;
      setLightboxScale(lb.pinchStartScale * (dist / lb.pinchStartDist));
      lb.moved = true;
      return;
    }
    if (!lb.dragging) return;
    var mx = e.clientX - lb.lastX;
    var my = e.clientY - lb.lastY;
    if (Math.abs(mx) > 2 || Math.abs(my) > 2) lb.moved = true;
    lb.x += mx;
    lb.y += my;
    lb.lastX = e.clientX;
    lb.lastY = e.clientY;
    applyLightboxTransform(false);
  });

  function endPointer(e) {
    if (lb.pointers.has(e.pointerId)) lb.pointers.delete(e.pointerId);
    if (lb.pointers.size < 2) {
      lb.pinchStartDist = 0;
    }
    if (lb.pointers.size === 0) {
      var wasDragging = lb.dragging;
      var moved = lb.moved;
      lb.dragging = false;
      applyLightboxTransform(false);
      // Tap empty stage (not the image) closes when not zoomed
      if (!moved && lb.scale <= 1.01 && e.target === els.stage) closeLightbox();
    } else if (lb.pointers.size === 1) {
      var only = Array.from(lb.pointers.values())[0];
      lb.dragging = lb.scale > 1.01;
      lb.lastX = only.x;
      lb.lastY = only.y;
    }
  }
  els.stage.addEventListener('pointerup', endPointer);
  els.stage.addEventListener('pointercancel', endPointer);
  els.stage.addEventListener('pointerleave', function(e) {
    if (e.pointerType === 'mouse') endPointer(e);
  });
})();

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLightbox();
});

// --- Attending Chat: local DeepSeek + MeWorld-style attending-cache.json ---
var CASE_CONTEXTS = window.CASE_CONTEXTS || {};
var ATTENDING_URL = (location.protocol === 'file:')
  ? 'http://127.0.0.1:8099/api/attending'
  : (location.origin + '/api/attending');
var ATTENDING_MODEL = 'deepseek-r1:14b';
var ATTENDING_CHAT_URL = (location.protocol === 'file:')
  ? 'http://127.0.0.1:8099/api/attending-chat'
  : (location.origin + '/api/attending-chat');

var IMMERSA_SYSTEM = window.ATTENDING_SYSTEM_PROMPT || [
  'You are the Immersa Brilliant Attending. Teach by mechanism in flowing prose.',
  'Never print Hook:/Mechanism:/Spatial why: labels or square-bracket stacks.',
  'Bold 2-4 mechanistic anchors. Stay inside THIS case dossier.'
].join(' ');

function stripThink(text) {
  return String(text || '')
    .replace(/<think>[\\s\\S]*?<\\/think>/gi, '')
    .replace(/<think>[\\s\\S]*$/gi, '')
    .trim();
}

function formatAttendingHtml(content) {
  var raw = stripThink(content || '');
  // Unpack [Hook: x. Mechanism: y.] into labeled lines
  raw = raw.replace(/\\[([^\\]]{10,})\\]/g, function(_, inner) {
    return '\\n' + String(inner).replace(
      /\\b(Hook|Mechanism|Spatial why|Case thread|Clinical anchor|Connecting thread)\\s*:/gi,
      '\\n**$1:**'
    );
  });
  var esc = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var lines = esc.split(/\\n/);
  var out = [];
  var buf = [];
  function flush() {
    if (!buf.length) return;
    var p = buf.join('<br>');
    p = p.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    p = p.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
    p = p.replace(/\\b(Hook|Mechanism|Spatial why|Case thread|Clinical anchor|Connecting thread):/g,
      '<span class="att-label">$1:</span>');
    out.push('<p>' + p + '</p>');
    buf = [];
  }
  lines.forEach(function(line) {
    var h3 = line.match(/^###\\s+(.+)$/);
    var h2 = line.match(/^##\\s+(.+)$/);
    if (h3) {
      flush();
      out.push('<h4 class="att-h">' + h3[1].replace(/\\*\\*/g,'') + '</h4>');
      return;
    }
    if (h2) {
      flush();
      out.push('<h3 class="att-h">' + h2[1].replace(/\\*\\*/g,'') + '</h3>');
      return;
    }
    if (!line.trim()) { flush(); return; }
    buf.push(line);
  });
  flush();
  return out.join('');
}

function formatOrderList(items, emptyLabel) {
  items = items || [];
  if (!items.length) return emptyLabel || '(none listed)';
  return items.map(function(m, i) {
    return (i+1) + '. ' + (m.title || 'Untitled') + '\\n   ' + (m.why || '(no note)');
  }).join('\\n');
}

function buildCaseContextBundle(ctx) {
  var parts = [];
  parts.push('=== FULL CASE CONTEXT (use this for every answer) ===');
  if (ctx.ccsNum != null) parts.push('CCS CASE #: ' + ctx.ccsNum + (ctx.ccsTitle ? (' - ' + ctx.ccsTitle) : ''));
  parts.push('DIAGNOSIS: ' + (ctx.diagnosis || ''));
  parts.push('SCORE: ' + (ctx.score != null ? ctx.score : '') + '%');
  parts.push('PATIENT: ' + (ctx.patient || ''));
  if (ctx.date) parts.push('DATE: ' + ctx.date);
  parts.push('FOLDER: ' + (ctx.folder || ''));
  parts.push('');
  parts.push('--- MECHANISM / FIRST PRINCIPLES ---');
  parts.push((ctx.mechanism || '(none in dossier)').slice(0, 6000));
  parts.push('');
  parts.push('--- WHAT LEARNER MISSED ---');
  parts.push(formatOrderList(ctx.missed, '(no missed orders listed)'));
  parts.push('');
  parts.push('--- WHAT LEARNER GOT WRONG / WRONG-DIRECTION ORDERS ---');
  parts.push(formatOrderList(ctx.overordered, '(no wrong-order notes listed)'));
  parts.push('');
  parts.push('--- WHAT LEARNER GOT RIGHT ---');
  parts.push(formatOrderList(ctx.gotRight, '(none listed)'));
  parts.push('=== END CASE CONTEXT ===');
  return parts.join('\\n');
}

function buildExpandMissedPrompt(ctx) {
  var missed = ctx.missed || [];
  var lines = missed.map(function(m, i) {
    return (i+1) + '. ORDER: ' + (m.title || 'Unknown') + '\\n   STUB: ' + (m.why || '(none)');
  }).join('\\n\\n');
  return buildCaseContextBundle(ctx) + '\\n\\n' +
    'TASK: Expand EACH missed order below into Immersa Brilliant Attending teaching.\\n' +
    'For each order use this shape ONLY:\\n' +
    '### N. Order name\\n' +
    'Then 120-200 words of flowing bedside prose (mechanism first, spatial why, case thread, clinical anchor woven in).\\n' +
    'FORBIDDEN in the answer text: the words Hook:, Mechanism:, Spatial why:, Case thread:, Clinical anchor: as labels.\\n' +
    'FORBIDDEN: square brackets around teaching beats. FORBIDDEN: telegram-style one-liners.\\n' +
    'Use **bold** on 2-4 load-bearing anchors per order. Picture the... / Think of... when it helps.\\n' +
    'Number them to match. Do not skip. Do not invent unrelated orders.\\n\\n' +
    lines;
}

function attendingBoxKey(e, sid) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askAttending(sid, false);
  }
}

function askAttending(sid, forceRefresh) {
  forceRefresh = !!forceRefresh;
  var section = document.getElementById('attending-' + sid);
  var body = document.getElementById('attending-body-' + sid);
  var btn = document.getElementById('ask-btn-' + sid);
  var refreshBtn = document.getElementById('refresh-btn-' + sid);
  
  if (!section.classList.contains('open')) section.classList.add('open');
  
  var ctx = CASE_CONTEXTS[sid];
  if (!ctx) { body.innerHTML = '<div class="attending-error">No case context found.</div>'; return; }

  var qEl = document.getElementById('ask-q-' + sid);
  var customQ = qEl && qEl.value ? qEl.value.trim() : '';
  var caseId = ctx.folder || sid;

  var spinning = forceRefresh
    ? 'Refreshing with MeWorld Immersa attending voice...'
    : 'Thinking with MeWorld Immersa attending voice (full case context)...';
  var spin = document.createElement('div');
  spin.className = 'attending-spinner';
  spin.id = 'attending-spin-' + sid;
  spin.innerHTML = '<div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div> ' + spinning;
  var oldSpin = document.getElementById('attending-spin-' + sid);
  if (oldSpin) oldSpin.remove();
  body.appendChild(spin);
  body.scrollTop = body.scrollHeight;
  btn.disabled = true;
  if (refreshBtn) refreshBtn.disabled = true;
  btn.textContent = forceRefresh ? 'Refreshing...' : 'Thinking...';

  var userMsg;
  var maxTokens = 2200;
  var mode = 'expand';
  var cacheKey = 'expand_missed_v4';
  var bundle = buildCaseContextBundle(ctx);
  if (customQ) {
    mode = 'question';
    cacheKey = 'q:' + customQ.toLowerCase().replace(/\\s+/g, ' ').replace(/[^a-z0-9 ?\\-]/g, '').slice(0, 120);
    userMsg = bundle + '\\n\\n' +
      'LEARNER QUESTION (fix typos; answer the intended medical question using the FULL CASE CONTEXT above):\\n' + customQ + '\\n\\n' +
      'Reply in MeWorld Brilliant Attending chat voice: flowing prose, mechanism first, **bold** anchors, no Hook:/Mechanism: labels, no bracket stacks. 150-350 words.';
    maxTokens = 1200;
  } else {
    if (!(ctx.missed || []).length) {
      btn.disabled = false;
      if (refreshBtn) refreshBtn.disabled = false;
      btn.textContent = 'Ask Attending';
      body.innerHTML = '<div class="attending-error">No missed orders listed for this case. Type a question to ask about the case context.</div>';
      return;
    }
    userMsg = buildExpandMissedPrompt(ctx);
    maxTokens = 2800;
  }

  fetch(ATTENDING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: caseId,
      model: ATTENDING_MODEL,
      system: IMMERSA_SYSTEM,
      user: userMsg,
      max_tokens: maxTokens,
      mode: mode,
      cacheKey: cacheKey,
      forceRefresh: forceRefresh
    })
  })
  .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; }); })
  .then(function(res) {
    btn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
    btn.textContent = 'Ask Attending';
    var spinEl = document.getElementById('attending-spin-' + sid);
    if (spinEl) spinEl.remove();
    var data = res.data || {};
    var content = data.content || '';
    if (!res.ok || !content) {
      var err = document.createElement('div');
      err.className = 'attending-error';
      err.innerHTML = (data.error || 'No response from local model.') +
        '<br><br>Confirm Ollama + <code>serve_case_review.py</code>.';
      body.appendChild(err);
      return;
    }
    var src = data.source === 'cache' ? 'cache hit' : 'generated + saved';
    var when = data.cachedAt ? (' \u00b7 ' + data.cachedAt) : '';
    var qLabel = customQ ? customQ : 'Expand all missed orders';
    var turn = document.createElement('div');
    turn.className = 'attending-turn';
    turn.innerHTML = '<div class="attending-q-label">You asked</div>' +
      '<div class="attending-q-text"></div>' +
      '<div class="attending-response"></div>' +
      '<div class="attending-source"></div>';
    turn.querySelector('.attending-q-text').textContent = qLabel;
    turn.querySelector('.attending-response').innerHTML = formatAttendingHtml(content);
    turn.querySelector('.attending-source').textContent =
      'MeWorld Immersa attending \u00b7 ' + (data.model || ATTENDING_MODEL) + ' \u00b7 ' + src + when +
      ' \u00b7 attending-cache.json + attending-chat.json';
    body.appendChild(turn);
    body.scrollTop = body.scrollHeight;
    // Append to durable chat log JSON
    fetch(ATTENDING_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseId,
        question: qLabel,
        answer: content,
        mode: mode,
        cacheKey: cacheKey,
        source: data.source || 'ollama',
        model: data.model || ATTENDING_MODEL
      })
    }).catch(function() {});
  })
  .catch(function(e) {
    btn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
    btn.textContent = 'Ask Attending';
    var spinEl2 = document.getElementById('attending-spin-' + sid);
    if (spinEl2) spinEl2.remove();
    var err = document.createElement('div');
    err.className = 'attending-error';
    err.textContent = 'Could not reach local attending. ' + e.message;
    body.appendChild(err);
  });
}
</script>
</body>
</html>'''
)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(html_parts))

print(f"Written: {OUT}")
print(f"Cases: {len(cases)}")
kb = os.path.getsize(OUT) / 1024
print(f"Size: {kb:.0f} KB")
