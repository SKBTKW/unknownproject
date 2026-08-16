import os
import re

game_dir = r"C:\Users\mam07\.gemini\antigravity\scratch\unknownproject\game"

# Keywords that could indicate personal info or absolute local paths
sensitive_patterns = [
    (r"mam07", "Local Username (mam07)"),
    (r"C:\\Users", "Windows Local User Path (C:\\Users)"),
    (r"k:\\マイドライブ", "Google Drive Path (k:\\マイドライブ)"),
    (r"[\w\.-]+@[\w\.-]+\.\w+", "Email Address"),
    (r"AIzaSy[A-Za-z0-9_-]{33}", "Google API Key"),
    (r"sk-[A-Za-z0-9]{32,}", "OpenAI API Key"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Token")
]

found_issues = []

for root, dirs, files in os.walk(game_dir):
    for file in files:
        filepath = os.path.join(root, file)
        # Skip binary files if any
        if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.ttf', '.mp3', '.wav')):
            continue
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                for pattern, desc in sensitive_patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    if matches:
                        rel_path = os.path.relpath(filepath, game_dir)
                        found_issues.append((rel_path, desc, matches[:3]))
        except Exception as e:
            print(f"Could not read {filepath}: {e}")

print("=== GAME DIRECTORY PRIVACY & SENSITIVE DATA SCAN RESULT ===")
if not found_issues:
    print("SUCCESS: 0 personal info, 0 local paths, 0 credentials found in game/ folder!")
else:
    print(f"WARNING: Found {len(found_issues)} potential issues in game/ folder:")
    for rel_path, desc, sample in found_issues:
        print(f" - [{rel_path}]: {desc} -> Samples: {sample}")
