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

def scan_for_tooltip_architecture_violations(root_dir):
    violations = []
    game_dir = os.path.join(root_dir, "game")
    
    # 1. index.html に tileTooltip が存在しないこと
    index_html = os.path.join(game_dir, "index.html")
    if os.path.exists(index_html):
        with open(index_html, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'id="tileTooltip"' in content or 'class="tile-tooltip"' in content:
                violations.append("game/index.html にレガシー独自DOM 'tileTooltip' が残存しています。TooltipSystem へ一本化してください。")

    # 2. i18n.js 内のツールチップ文字列にインライン style= が含まれていないこと
    i18n_file = os.path.join(game_dir, "src", "i18n.js")
    if os.path.exists(i18n_file):
        with open(i18n_file, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f.readlines(), 1):
                if ("TOOLTIP_" in line or "_DESC:" in line or "_TITLE:" in line) and "style=" in line:
                    violations.append(f"game/src/i18n.js:{idx} ツールチップ文面にインライン style= が含まれています。共通クラスを使用してください: {line.strip()[:60]}")

    return violations

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    game_dir = os.path.join(root_dir, "game")

    # 🛡️ 物理ガードレール: 全稼働中モジュール（ui, systems, core, app.js, v2_main, index.html）を完全自動走査
    active_dirs = [
        os.path.join(game_dir, "src", "ui"),
        os.path.join(game_dir, "src", "systems"),
        os.path.join(game_dir, "src", "core")
    ]
    target_files = [
        os.path.join(game_dir, "index.html"),
        os.path.join(game_dir, "src", "app.js"),
        os.path.join(game_dir, "src", "v2_unity_ready_main.js")
    ]
    for d in active_dirs:
        if os.path.exists(d):
            for f in os.listdir(d):
                if f.endswith(".js") and "backup" not in f:
                    target_files.append(os.path.join(d, f))

    target_files.sort()
    total_violations = 0
    print(f"=== AGENTS.md Automated Full Inspection & Spec Verification ({len(target_files)} active files) ===")

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

    # 🛡️ ツールチップ・ポップアップ統一アーキテクチャ検問
    tt_violations = scan_for_tooltip_architecture_violations(root_dir)
    if tt_violations:
        print(f"\n[VIOLATIONS FOUND] Tooltip Architecture Violations:")
        for v in tt_violations:
            print(f"  ❌ {v}")
        total_violations += len(tt_violations)
    else:
        print("[PASSED]: ツールチップ統一アーキテクチャ検問 ALL PASS (独自DOM排除 & インラインCSSゼロ確認)。")

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
