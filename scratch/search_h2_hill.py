import os, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

game_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\game"
for root, dirs, files in os.walk(game_dir):
    for f in files:
        if f.endswith(".js") or f.endswith(".html"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                lines = file.readlines()
                for idx, line in enumerate(lines, 1):
                    if "H2_HILL" in line or "丘陵" in line or "wood: 4" in line or "wood:4" in line:
                        print(f"{f}:{idx}: {line.strip()}")
