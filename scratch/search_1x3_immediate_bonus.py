import os
import re

search_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject"
brain_dir = r"C:\Users\mam07\.gemini\antigravity\brain\af6d4803-5dd7-4a55-87d7-472ecdecfde4"

keywords = ["1x3", "1×3", "即時ボーナス", "即時", "ボーナス", "連結", "1x2", "1×2"]

files_to_check = [
    os.path.join(search_dir, "all_brains_1x3_results.txt"),
    os.path.join(search_dir, "user_1x3_matches.txt"),
    os.path.join(search_dir, "user_immediate_bonus.txt"),
    os.path.join(search_dir, "popup_bonus_steps_900.txt"),
    os.path.join(search_dir, "attr_bonus_details.txt"),
    os.path.join(search_dir, "step1004.txt"),
    os.path.join(search_dir, "rules", "00_master_handover_specification.md"),
]

# Also search inside brain directory for transcript logs
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith(('.jsonl', '.txt', '.log', '.md')):
            files_to_check.append(os.path.join(root, f))

results = []

for filepath in files_to_check:
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for idx, line in enumerate(lines):
                    if ("1x3" in line or "1×3" in line or "即時" in line or "連結" in line) and ("ボーナス" in line or "食料" in line or "資材" in line or "神秘" in line):
                        filename = os.path.basename(filepath)
                        results.append((filename, idx + 1, line.strip()))
        except Exception as e:
            pass

print(f"=== FOUND {len(results)} RELEVANT MATCHES ===")
for fn, lnum, line in results[:20]:
    print(f"[{fn}:{lnum}] {line[:120]}")
