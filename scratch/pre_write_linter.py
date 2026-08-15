#!/usr/bin/env python3
import os
import re
import sys
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def scan_file_for_hardcoded_japanese(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    japanese_regex = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]')
    is_i18n_dict_file = ("i18n.js" in filepath)

    violations = []

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue
        if is_i18n_dict_file:
            continue

        if japanese_regex.search(line):
            if "I18n.t" not in line and "i18n.t" not in line and "setLanguage" not in line and "dictionaries" not in line:
                violations.append((idx, line.strip()))

    return violations

def main():
    root_dir = os.path.join(os.path.dirname(__file__), "..")
    game_dir = os.path.join(root_dir, "game")

    target_files = [
        os.path.join(game_dir, "index_v2.html"),
        os.path.join(game_dir, "src", "v2_unity_ready_main.js")
    ]

    total_violations = 0
    print("=== AGENTS.md Automated Inspection & Spec Verification ===")

    for filepath in target_files:
        rel_path = os.path.relpath(filepath)
        if not os.path.exists(filepath):
            print(f"File not found: {rel_path}")
            continue

        violations = scan_file_for_hardcoded_japanese(filepath)
        if violations:
            print(f"\n[VIOLATIONS FOUND] in [{rel_path}]: {len(violations)} lines with hardcoded Japanese without I18n.t():")
            for line_num, content in violations:
                print(f"  Line {line_num}: {content}")
            total_violations += len(violations)
        else:
            print(f"[PASSED]: [{rel_path}] zero hardcoded Japanese text violations.")

    print("\n=== Running 14 Spec Files Instant Verification ===")
    res = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "verify_all_rule_files.py")], capture_output=True, text=True, encoding='utf-8')
    print(res.stdout)
    if res.returncode != 0:
        total_violations += 1

    if total_violations > 0:
        print(f"\nFAILED: Total {total_violations} AGENTS.md Rule violations detected!")
        sys.exit(1)
    else:
        print("\nSUCCESS: All inspections and Spec verification passed 100%!")
        sys.exit(0)

if __name__ == "__main__":
    main()
