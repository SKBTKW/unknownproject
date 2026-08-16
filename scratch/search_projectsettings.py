import os
import re

root = os.path.join(os.path.dirname(__file__), "..")
matches = []

for dirpath, dirnames, filenames in os.walk(root):
    if ".git" in dirpath or "node_modules" in dirpath or ".gemini" in dirpath:
        continue
    for f in filenames:
        ext = os.path.splitext(f)[1].lower()
        if ext in [".md", ".json", ".js", ".html", ".py", ".cs", ".txt"]:
            filepath = os.path.join(dirpath, f)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as file:
                    for i, line in enumerate(file, 1):
                        if re.search(r"project\s*setting", line, re.IGNORECASE):
                            rel_path = os.path.relpath(filepath, root)
                            matches.append((rel_path, i, line.strip()))
            except Exception as e:
                pass

print(f"=== SEARCH RESULTS FOR 'projectsetting' ({len(matches)} matches) ===")
for path, line_no, content in matches:
    print(f"[{path}:{line_no}] {content}")
