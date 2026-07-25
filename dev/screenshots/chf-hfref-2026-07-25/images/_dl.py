import requests, os

d = r"C:\Users\steve\MeWorld\dev\screenshots\chf-hfref-2026-07-25\images"

urls = [
    ("https://cdn-magnific.freepik.com/result_NANO_BANANA_PRO_43891e46-83ff-442d-a654-8afb7786f91e_0.png?token=exp=1784997124~hmac=2f752e14c28646e2c5db729a83e2e23fdff393530316d830f9c36f53f9c96372&size=stable", "descent-3x3.png"),
    ("https://cdn-magnific.freepik.com/result_NANO_BANANA_PRO_3480ffc6-5f97-4120-a17b-0469c4619466_0.png?token=exp=1784997167~hmac=7c4ce382f46f34e534a77eaf4378a051e365a82bf136e19b46324d2d8c3ee943&size=stable", "descent-gaps-3x3.png"),
]

for url, name in urls:
    r = requests.get(url, timeout=60)
    path = os.path.join(d, name)
    with open(path, "wb") as f:
        f.write(r.content)
    print(f"{name}: {os.path.getsize(path)} bytes")
