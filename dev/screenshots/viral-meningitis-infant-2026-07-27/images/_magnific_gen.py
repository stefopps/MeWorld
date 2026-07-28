import requests, time, os, base64

API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83'
ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro'
OUT = r'C:\Users\steve\MeWorld\dev\screenshots\viral-meningitis-infant-2026-07-27\images'
HEADERS = {'x-magnific-api-key': API_KEY, 'Content-Type': 'application/json'}

# Load reference image as base64 (raw, no data URL prefix)
REF_PATH = r'C:\Users\steve\MeWorld\dev\screenshots\uncharted-4-main-menu.png'
ref_b64 = None
if os.path.exists(REF_PATH):
    with open(REF_PATH, 'rb') as f:
        ref_b64 = base64.b64encode(f.read()).decode('utf-8')
    print(f"Reference image loaded: {len(ref_b64)} chars base64")

for name in ['descent-3x3', 'descent-gaps-3x3']:
    prompt_path = os.path.join(OUT, f'{name}.claude-img.txt')
    prompt = open(prompt_path, encoding='utf-8').read()
    assert len(prompt) <= 2995, f'{name}: {len(prompt)} chars (over 2995)'
    print(f'\n--- {name}: {len(prompt)} chars ---', flush=True)

    payload = {'prompt': prompt, 'resolution': '2K'}
    if ref_b64:
        # RAW base64, no data URL prefix. Plus mime_type.
        payload['reference_images'] = [{'image': ref_b64, 'mime_type': 'image/png'}]
        print('Reference image attached to payload', flush=True)

    r = requests.post(ENDPOINT, json=payload, headers=HEADERS, timeout=60)
    if r.status_code not in (200, 201):
        print(f'ERROR {r.status_code}: {r.text[:300]}')
        continue

    data = r.json()
    tid = (data.get('data') or data).get('task_id')
    if not tid:
        print(f'No task_id. Keys: {list(data.keys())} {list((data.get("data") or {}).keys())}')
        continue
    print(f'task_id: {tid}', flush=True)

    # Poll at correct URL: ENDPOINT/{task_id}
    for i in range(120):  # up to 20 min
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
                print(f'  Downloading: {url[:80]}...', flush=True)
                img = requests.get(url, timeout=120)
                out_path = os.path.join(OUT, f'{name}.png')
                with open(out_path, 'wb') as f:
                    f.write(img.content)
                size_mb = len(img.content) / (1024*1024)
                print(f'  Saved: {out_path} ({size_mb:.1f} MB)', flush=True)
            break
        elif status == 'FAILED':
            print(f'  FAILED: {pd.get("data", pd).get("error", "unknown")}', flush=True)
            break
    else:
        print(f'  TIMEOUT after 1200s', flush=True)

print('\nDone.', flush=True)
