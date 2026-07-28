import requests, time, os, base64

API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83'
ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro'
OUT = r'C:\Users\steve\MeWorld\dev\screenshots\viral-meningitis-infant-2026-07-27\images'
HEADERS = {'x-magnific-api-key': API_KEY, 'Content-Type': 'application/json'}

REF_PATH = r'C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png'
ref_b64 = None
if os.path.exists(REF_PATH):
    with open(REF_PATH, 'rb') as f:
        ref_b64 = base64.b64encode(f.read()).decode('utf-8')
    print(f"Reference image loaded: {len(ref_b64)} chars base64")

# Reworded prompt — focus on CSF/lab/clinical environment, avoid direct infant depiction
prompt = (
    "Naughty Dog cinematic CGI macro render, Uncharted 4 / The Last of Us visual style. "
    "Not a photograph. Cool blue-gray dominant ambient lighting with warm amber focal accents. "
    "Heavy ambient occlusion. Volumetric haze and atmospheric depth. Lived-in worn surfaces. "
    "Soft vignette at edges. One warm point light catching edges.\n\n"
    "3x3 grid, 9 panels, landscape 16:9. NO TEXT ANYWHERE. "
    "One continuous hospital environment across all panels, camera traveling through it.\n\n"
    "Story: Viral meningitis workup in a pediatric patient — from clinical suspicion to CSF interpretation to supportive care. "
    "The CSF triad (glucose, protein, cell count) tells the story: viral, not bacterial.\n\n"
    "PANEL 1 wide shot pediatric exam room warm amber light stethoscope otoscope on counter "
    "PANEL 2 close-up LP tray on sterile table spinal needles amber vials gloved hands preparing "
    "PANEL 3 macro CSF dripping into three glass collection tubes numbered one two three "
    "PANEL 4 close-up lab bench CSF panel card WBC 20 protein 50 glucose normal gram stain negative sterile result "
    "PANEL 5 medium shot microscope objective lens CSF gram stain slide no organisms visible blue-gray lab lighting "
    "PANEL 6 close-up IV fluid bag hanging on pole drips falling into tubing warm amber glow "
    "PANEL 7 medium shot hospital crib empty and made up soft blanket nightlight dim peaceful room "
    "PANEL 8 close-up acetaminophen bottle and oral syringe on bedside table soft pediatric ward light "
    "PANEL 9 wide shot pediatric ward hallway nurses station ambient monitors quiet overnight shift blue-gray atmosphere\n\n"
    "Cinematic, high contrast, glossy detail, consistent style throughout, no text anywhere."
)

print(f"Descent prompt: {len(prompt)} chars", flush=True)

payload = {'prompt': prompt, 'resolution': '2K'}
if ref_b64:
    payload['reference_images'] = [{'image': ref_b64, 'mime_type': 'image/png'}]

r = requests.post(ENDPOINT, json=payload, headers=HEADERS, timeout=60)
print(f"Submit: {r.status_code}", flush=True)
data = r.json()
tid = (data.get('data') or data).get('task_id')
print(f"task_id: {tid}", flush=True)

for i in range(120):
    time.sleep(10)
    pr = requests.get(f'{ENDPOINT}/{tid}', headers=HEADERS, timeout=30)
    pd = pr.json()
    status = str((pd.get('data') or pd).get('status', '')).upper()
    if i % 6 == 0:
        print(f'  [{i*10}s] status: {status}', flush=True)
    if status == 'COMPLETED':
        generated = (pd.get('data') or pd).get('generated', [])
        if generated:
            url = generated[0] if isinstance(generated[0], str) else generated[0].get('url', '')
            img = requests.get(url, timeout=120)
            out_path = os.path.join(OUT, 'descent-3x3.png')
            with open(out_path, 'wb') as f:
                f.write(img.content)
            print(f'  Saved: {out_path} ({len(img.content)/1048576:.1f} MB)', flush=True)
        break
    elif status == 'FAILED':
        print(f'  FAILED: {pd.get("data", pd).get("error", "unknown")}', flush=True)
        break
else:
    print('  TIMEOUT after 1200s', flush=True)

print('Done.', flush=True)
