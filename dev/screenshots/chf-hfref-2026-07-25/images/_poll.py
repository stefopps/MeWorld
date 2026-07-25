import requests, json, os

API_KEY = "MS6b2d6d7d3fb64d30960c9856197a9f83"
ENDPOINT = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro"
headers = {"x-magnific-api-key": API_KEY}

for tid, name in [("43891e46-83ff-442d-a654-8afb7786f91e", "descent-3x3"), ("3480ffc6-5f97-4120-a17b-0469c4619466", "descent-gaps-3x3")]:
    print(f"\n=== {name} ({tid}) ===")
    r = requests.get(f"{ENDPOINT}/{tid}", headers=headers, timeout=30)
    d = r.json()
    sd = d.get("data") or d
    print(f"keys: {list(sd.keys())[:15]}")
    print(f"error: {sd.get('error')}")
    
    gen = sd.get("generated")
    if gen:
        print(f"generated type: {type(gen).__name__}, preview: {str(gen)[:300]}")
    
    # Try all URL fields
    for k in ["output_url", "result_url", "url", "image_url", "result", "output", "download_url", "asset_url"]:
        v = sd.get(k)
        if v and isinstance(v, str) and v.startswith("http"):
            print(f"FOUND URL ({k}): {v[:200]}")
    
    # Check 'result' if dict
    result = sd.get("result")
    if isinstance(result, dict):
        print(f"result keys: {list(result.keys())[:10]}")
        r_keys = list(result.keys())
        for rk in r_keys[:5]:
            rv = result[rk]
            print(f"  result.{rk}: {str(rv)[:200]}")
    
    # Check 'generated' if list
    if isinstance(gen, list) and len(gen) > 0:
        g0 = gen[0]
        print(f"generated[0] type: {type(g0).__name__}")
        if isinstance(g0, dict):
            print(f"generated[0] keys: {list(g0.keys())[:10]}")
            for kg in g0:
                gv = g0[kg]
                print(f"  {kg}: {str(gv)[:300]}")
    elif isinstance(gen, dict):
        print(f"generated dict keys: {list(gen.keys())[:10]}")
        for kg in gen:
            gv = gen[kg]
            print(f"  {kg}: {str(gv)[:300]}")

    # Dump full sd for debugging
    dump = json.dumps(sd, indent=2)
    if len(dump) > 3000:
        dump = dump[:3000]
    print(f"--- RAW (first 3000 chars) ---\n{dump}")
