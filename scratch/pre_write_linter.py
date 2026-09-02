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

def scan_for_card_architecture_violations(root_dir):
    """
    🛡️ カードデータ分離 ＆ ハードコード機械的遮断ガードレール (Unity & Mobile Ready)
    1. systems/, ui/, core/ 配下の JS コード内にカードマスターデータ配列の直書き・ハードコードが存在してはならない。
    2. land_cards.json に非LANDカード (category != "LAND") が混入してはならない。
    3. rules/09_cards/ で削除指定された旧カード (CMD_CONSERVE_EMBER, CMD_LAND_FOCUS, CMD_BLACK_MARKET) がデータ資産に残存してはならない。
    """
    violations = []
    game_dir = os.path.join(root_dir, "game", "src")
    import json

    # 1. ロジックディレクトリでのカードデータハードコード検知
    logic_dirs = [os.path.join(game_dir, "systems"), os.path.join(game_dir, "ui"), os.path.join(game_dir, "core")]
    for d in logic_dirs:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            for f in files:
                if f.endswith(".js") and "backup" not in f:
                    p = os.path.join(root, f)
                    rel_p = os.path.relpath(p, root_dir)
                    with open(p, 'r', encoding='utf-8') as fp:
                        content = fp.read()
                        # const COMMAND_CARDS_MASTER = [ ... ] 直書き検知
                        if re.search(r'const\s+COMMAND_CARDS_MASTER\s*=\s*\[', content):
                            violations.append(f"[{rel_p}] ロジックコード内にカードデータ配列 'const COMMAND_CARDS_MASTER = [...]' がハードコードされています。game/src/data/*.json へ完全分離してください。")
                        # id: "CMD_...", category: "COMMAND" 形式のオブジェクト定義直書き検知
                        if re.search(r'\{\s*id:\s*"CMD_[A-Z_]+",\s*category:\s*"(?:COMMAND|ECONOMY|MILITARY|MYSTIC)"', content):
                            violations.append(f"[{rel_p}] ロジックコード内にカードマスターデータが直接ハードコードされています。game/src/data/*.json へ完全分離してください。")

    # 2. land_cards.json の純化検知（非LANDカード混入禁止）
    land_json = os.path.join(game_dir, "data", "land_cards.json")
    if os.path.exists(land_json):
        with open(land_json, 'r', encoding='utf-8') as fp:
            try:
                cards = json.load(fp)
                for idx, c in enumerate(cards):
                    cid = c.get("id", "")
                    cat = c.get("category", "")
                    if cat != "LAND":
                        violations.append(f"game/src/data/land_cards.json: #{idx} ({cid}) に非LANDカテゴリ '{cat}' が混入しています。土地データ資産にはLANDのみを配置してください。")
            except Exception as e:
                violations.append(f"land_cards.json parse error: {e}")

    # 3. 削除された旧カードの残存検知
    banned_legacy_cards = ["CMD_CONSERVE_EMBER", "CMD_LAND_FOCUS", "CMD_BLACK_MARKET"]
    data_dir = os.path.join(game_dir, "data")
    if os.path.exists(data_dir):
        for root, _, files in os.walk(data_dir):
            for f in files:
                if f.endswith((".json", ".js")):
                    p = os.path.join(root, f)
                    rel_p = os.path.relpath(p, root_dir)
                    with open(p, 'r', encoding='utf-8') as fp:
                        c_text = fp.read()
                        for b_card in banned_legacy_cards:
                            if f'"{b_card}"' in c_text or f"'{b_card}'" in c_text:
                                violations.append(f"[{rel_p}] 02で削除指定された旧カード '{b_card}' が残存しています。完全に除去してください。")

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

    # 🛡️ カードデータ分離 ＆ ハードコード機械的遮断ガードレール検問
    card_violations = scan_for_card_architecture_violations(root_dir)
    if card_violations:
        print(f"\n[VIOLATIONS FOUND] Card Architecture & Hardcoding Violations:")
        for v in card_violations:
            print(f"  ❌ {v}")
        total_violations += len(card_violations)
    else:
        print("[PASSED]: カードデータ完全分離検問 ALL PASS (ロジック内ハードコード0件 & 土地JSON純化 & 旧カード完全排除確認)。")

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
