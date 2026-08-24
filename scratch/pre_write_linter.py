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
    is_i18n_dict_file = ("i18n" in filepath or "data" in filepath or "task.md" in filepath or "specs" in filepath)

    violations = []
    in_block_comment = False

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if "/*" in stripped:
            in_block_comment = True
        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
            continue
        
        # HTMLコメント除去
        clean_line = re.sub(r'<!--.*?-->', '', stripped)
        # JSインラインコメント除去
        if "//" in clean_line:
            clean_line = clean_line.split("//")[0].strip()

        if not clean_line or clean_line.startswith("*"):
            continue
        if is_i18n_dict_file:
            continue

        if japanese_regex.search(clean_line):
            if "I18n.t" not in clean_line and "i18n.t" not in clean_line and "setLanguage" not in clean_line and "dictionaries" not in clean_line and "console.log" not in clean_line:
                violations.append((idx, clean_line))

    return violations

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    game_dir = os.path.join(root_dir, "game")

    target_files = [
        os.path.join(game_dir, "src", "ui", "hand_cards_component.js"),
        os.path.join(game_dir, "src", "ui", "reserve_slot_component.js"),
        os.path.join(game_dir, "src", "ui", "tooltip_system.js"),
        os.path.join(game_dir, "src", "ui", "ui_controller.js"),
        os.path.join(game_dir, "src", "systems", "deck_manager.js"),
        os.path.join(game_dir, "src", "v2_unity_ready_main.js"),
        os.path.join(game_dir, "src", "app.js")
    ]

    total_violations = 0
    print("=== AGENTS.md Automated Inspection & Spec Verification ===")

    for filepath in target_files:
        rel_path = os.path.relpath(filepath, root_dir)
        if not os.path.exists(filepath):
            continue

        violations = scan_file_for_hardcoded_japanese(filepath)
        if violations:
            print(f"\n[VIOLATIONS FOUND] in [{rel_path}]: {len(violations)} lines with hardcoded Japanese:")
            for line_num, content in violations[:5]:
                print(f"  Line {line_num}: {content}")
            total_violations += len(violations)
        else:
            print(f"[PASSED]: [{rel_path}] zero hardcoded Japanese text.")

    print("\n=== Running Master Spec Verification ===")
    node_res = subprocess.run(["node", os.path.join(root_dir, "scratch", "run_full_inspection.mjs")], capture_output=True, text=True, encoding='utf-8')
    print(node_res.stdout)
    if node_res.returncode != 0:
        total_violations += 1

    if total_violations > 0:
        print(f"\nFAILED: Total {total_violations} AGENTS.md Rule violations detected!")
        sys.exit(1)
    else:
        print("\nSUCCESS: All inspections and Spec verification passed 100%!")
        sys.exit(0)

if __name__ == "__main__":
    main()
