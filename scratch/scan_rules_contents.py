import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

root = os.path.join(os.path.dirname(__file__), "..", "rules")

print("=== ALL RULES FILES SUMMARY ===")
for f in sorted(os.listdir(root)):
    if f.endswith(".md"):
        path = os.path.join(root, f)
        with open(path, "r", encoding="utf-8", errors="ignore") as file:
            first_lines = [line.strip() for line in file.readlines()[:15] if line.strip()]
            print(f"\n--- FILE: {f} ---")
            for l in first_lines[:5]:
                print("  ", l)
