#!/usr/bin/env python3
import os
import re
import sys

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
    game_dir = os.path.join(os.path.dirname(__file__), "..", "game")
    target_files = [
        os.path.join(game_dir, "index_v2.html"),
        os.path.join(game_dir, "src", "v2_unity_ready_main.js")
    ]

    total_violations = 0
    print("=== AGENTS.md Rule 3 Automated I18N Linter Inspection ===")

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

    if total_violations > 0:
        print(f"\nFAILED: Total {total_violations} AGENTS.md Rule 3 violations detected!")
        sys.exit(1)
    else:
        print("\nSUCCESS: All files passed AGENTS.md Rule 3 Automated Linter Inspection!")
        sys.exit(0)

if __name__ == "__main__":
    main()
