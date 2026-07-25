import requests, time, os, json

API_KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83'
TASK_PATH = '/v1/ai/text-to-image/nano-banana-pro'
CREATE_URL = f'https://api.magnific.com{TASK_PATH}'
OUTDIR = os.path.dirname(os.path.abspath(__file__))

pairs = [
    ('descent-3x3.claude-img.txt', 'descent-3x3.png'),
    ('descent-gaps-3x3.claude-img.txt', 'descent-gaps-3x3.png'),
]

HEADERS = {
    'x-magnific-api-key': API_KEY,
    'Content-Type': 'application/json',
}

for prompt_file, out_name in pairs:
    prompt_path = os.path.join(OUTDIR, prompt_file)
    with open(prompt_path, 'r', encoding='utf-8', errors='replace') as f:
        prompt_text = f.read().strip()
    print(f'[SUBMIT] {prompt_file} ({len(prompt_text)} chars)', flush=True)

    payload = {
        'prompt': prompt_text,
        'aspect_ratio': '16:9',
        'resolution': '2K',
        'num_outputs': 1,
        'negative_prompt': 'text overlay, lettering, captions, subtitles, cartoon, anime, 2D flat, plastic skin, overexposed, blurry',
    }

    r = requests.post(CREATE_URL, json=payload, headers=HEADERS, timeout=30)
    created = r.json()
    task_id = (created.get('data') or {}).get('task_id') or created.get('task_id')
    if not task_id:
        print(f'  ERROR: No task_id — {json.dumps(created)[:400]}', flush=True)
        continue
    print(f'  task_id={task_id}', flush=True)

    POLL_URL = f'{CREATE_URL}/{task_id}'
    for i in range(80):
        time.sleep(3)
        sr = requests.get(POLL_URL, headers={'x-magnific-api-key': API_KEY}, timeout=15)
        sd = sr.json()
        data = sd.get('data') or sd
        status = str(data.get('status', '')).upper()
        print(f'  poll {i+1}: {status}', flush=True)

        if status == 'COMPLETED':
            urls = data.get('generated') or data.get('result', {}).get('url') or []
            if isinstance(urls, list) and urls:
                url = urls[0]
            elif isinstance(urls, str):
                url = urls
            else:
                url = data.get('url') or data.get('result', {}).get('url')
            if url:
                print(f'  downloading...', flush=True)
                ir = requests.get(url, timeout=60)
                out_path = os.path.join(OUTDIR, out_name)
                with open(out_path, 'wb') as f:
                    f.write(ir.content)
                print(f'  SAVED {out_path} ({len(ir.content)} bytes)', flush=True)
            else:
                print(f'  COMPLETED but no URL — keys: {list(data.keys())}', flush=True)
            break
        elif status == 'FAILED':
            print(f'  FAILED: {json.dumps(sd)[:400]}', flush=True)
            break
    else:
        print(f'  TIMEOUT after 80 polls', flush=True)

print('DONE', flush=True)
