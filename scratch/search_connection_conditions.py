import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

filepath = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\user_1x3_matches.txt"

if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    print("=== SEARCHING FOR CONNECTION CONDITIONS IN LOGS ===")
    for idx, l in enumerate(lines):
        if any(k in l for k in ["条件", "隣接", "同属性", "接続", "前提", "獲得", "ルール", "直線", "L字"]):
            print(f"[Line {idx+1}]: {l.strip()}")
