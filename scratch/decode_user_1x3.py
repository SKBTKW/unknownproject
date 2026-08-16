import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

filepath = r"C:\Users\mam07\.gemini\antigravity\scratch/unknownproject\user_1x3_matches.txt"

if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if any(k in l for k in ["3マス", "即時", "連結", "ボーナス", "2度目", "3度目", "マージ", "1x3", "1×3", "2x2"]):
            print(f"[Line {idx+1}]: {l.strip()}")
