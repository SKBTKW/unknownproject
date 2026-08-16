import os
import re

root = os.path.join(os.path.dirname(__file__), "..")
matches = []

for dirpath, dirnames, filenames in os.walk(root):
    if ".git" in dirpath or "node_modules" in dirpath or ".gemini" in dirpath:
        continue
    for f in filenames:
        ext = os.path.splitext(f)[1].lower()
        if ext in [".md", ".json", ".js", ".html"]:
            filepath = os.path.join(dirpath, f)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as file:
                    for i, line in enumerate(file, 1):
                        if "setting" in line.lower() or "setting" in line.lower() or "project" in line.lower() or "設定" in line:
                            rel_path = os.path.relpath(filepath, root)
                            matches.append((rel_path, i, line.strip()))
            except Exception as e:
                pass

print(f"=== SEARCH RESULTS FOR 'settings / 設定' ({len(matches)} matches) ===")
for path, line_no, content in matches[:30]: # print first 30
    print(f"[{path}:{line_no}] {content}")
