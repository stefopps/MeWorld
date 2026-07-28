# Measure prompt lengths
import os

base = r'C:\Users\steve\MeWorld\dev\screenshots\pku-newborn-2026-07-28\images'

# Descent prompt is inline in _gen_descent.py
content = open(os.path.join(base, '_gen_descent.py'), encoding='utf-8').read()
s = content.find('PROMPT = """')
e = content.find('"""', s + 13)
prompt = content[s+13:e]
print(f'descent prompt (inline): {len(prompt)} chars')

# Contrast prompt is in .txt
txt = open(os.path.join(base, 'descent-contrast-3x3.claude-img.txt'), encoding='utf-8').read()
print(f'contrast prompt (.txt): {len(txt)} chars')
