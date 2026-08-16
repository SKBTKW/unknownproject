import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

filepath = r"C:\Users\mam07\.gemini/antigravity\scratch\unknownproject\user_1x3_matches.txt"

if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    print("=== PAST LOG FULL TEXT (Line 35 to Line 110) ===")
    for idx in range(34, min(110, len(lines))):
        print(lines[idx].rstrip())
