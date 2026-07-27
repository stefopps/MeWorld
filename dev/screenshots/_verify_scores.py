import re
with open(r'C:\Users\steve\MeWorld\dev\screenshots\case-review-all.html','r',encoding='utf-8') as f:
    html = f.read()
pattern = r'onclick="switchCase\(\'(.+?)\'\)">\s*<div class="cn-row"><span class="cn-title">(.+?)</span><span class="cn-score \w+">([\d.]+)'
for m in re.finditer(pattern, html):
    sid = m.group(1)
    title = m.group(2)[:55]
    score = m.group(3)
    print(f'{score:>6}%  {title}')
