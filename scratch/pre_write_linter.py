#!/usr/bin/env python3
import os
import re
import sys
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ==============================================================================
# 🛡️ AoT Master Static Lint Guardrail (Fast Pre-Write Linter)
#
# 責務:
# 禁止パターン・アーキテクチャ境界違反・新規CSS違反を静的解析し、数秒以内で高速判定する。
# 動的テスト（Domain / UI Lifecycle / Spec）は run_full_inspection.mjs に委譲する。
# ==============================================================================

# Rule IDs:
# I18N001: Hardcoded Japanese user-facing string
# CSS001:  Forbidden new '!important' in CSS / JS
# CSS002:  Forbidden raw HTML inline style attribute
# CSS003:  Direct JS style mutation (.style.foo = / .style.cssText =) [WARN]
# CARD001: Card master data hardcoded in logic layers
# CARD002: Contaminated land_cards.json (non-LAND card)
# CARD003: Banned legacy card ID in data assets
# ARCH001: Domain layer DOM access (document/window in core or trial domain)

class LintViolation:
    def __init__(self, rule_id, level, filepath, line_num, message, fix_hint):
        self.rule_id = rule_id
        self.level = level # 'ERROR' or 'WARN'
        self.filepath = filepath
        self.line_num = line_num
        self.message = message
        self.fix_hint = fix_hint

    def format(self):
        icon = "❌" if self.level == "ERROR" else "⚠️"
        loc = f"{self.filepath}:{self.line_num}" if self.line_num else self.filepath
        return f"  {icon} [{self.rule_id}] ({self.level}) {loc}\n      {self.message}\n      👉 Fix: {self.fix_hint}"


def get_git_diff_added_lines(root_dir):
    """
    ワーキングツリーの変更（未ステージ ＋ ステージ済み）から、
    新規追加された行番号のセットを取得する。
    辞書形式: { rel_filepath: set([line_number, ...]) }
    """
    added_lines_map = {}

    diff_cmds = [
        ["git", "diff", "--unified=0", "HEAD"],
        ["git", "diff", "--unified=0"]
    ]

    for cmd in diff_cmds:
        try:
            res = subprocess.run(cmd, cwd=root_dir, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            if res.returncode != 0:
                continue

            current_file = None
            for line in res.stdout.splitlines():
                if line.startswith("+++ b/"):
                    current_file = line[6:].replace("/", os.sep)
                    if current_file not in added_lines_map:
                        added_lines_map[current_file] = set()
                elif line.startswith("@@ ") and current_file:
                    m = re.search(r'\+(\d+)(?:,(\d+))?', line)
                    if m:
                        start = int(m.group(1))
                        count = int(m.group(2)) if m.group(2) else 1
                        for ln in range(start, start + count):
                            added_lines_map[current_file].add(ln)
        except Exception:
            pass

    return added_lines_map


def scan_file_for_japanese(filepath, rel_path):
    """
    [I18N001] 日本語直書き検査
    - 全 JS / HTML ファイルを対象
    - i18n.js, data/ 資産, task.md, specs 等は除外
    - コメント内の日本語は許容
    - I18n.t(...) 内のキー文字列は許容するが、同一行の生日本語文字列は検知する
    """
    violations = []
    japanese_regex = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]')

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    in_block_comment = False

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()

        # ブロックコメントの追跡
        if "/*" in stripped:
            in_block_comment = True
        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
                stripped = stripped.split("*/", 1)[1].strip()
            else:
                continue

        # HTMLコメントの除去
        clean = re.sub(r'<!--.*?-->', '', stripped)
        # 行コメントの除去 (URL 内の // を誤認識しないよう保護)
        clean = re.sub(r'(?<!http:)(?<!https:)\/\/.*$', '', clean).strip()

        if not clean or clean.startswith("*"):
            continue

        if not japanese_regex.search(clean):
            continue

        # 抑制コメントチェック (例: // lint-disable-next-line I18N001 -- reason)
        if idx > 1 and "lint-disable-next-line I18N001" in lines[idx - 2]:
            continue

        # 辞書定義ファイル自体のキー・値は除外
        if "dictionaries" in clean or "setLanguage" in clean:
            continue

        # 文字列リテラル内の日本語を特定
        string_matches = re.findall(r'(["\'`])((?:(?!\1).)*)\1', clean)
        has_raw_jp_string = False
        raw_snippet = clean
        for quote, s in string_matches:
            if japanese_regex.search(s):
                has_raw_jp_string = True
                raw_snippet = f"{quote}{s}{quote}"
                break

        if has_raw_jp_string:
            violations.append(LintViolation(
                rule_id="I18N001",
                level="ERROR",
                filepath=rel_path,
                line_num=idx,
                message=f"Hardcoded Japanese string in runtime code: {raw_snippet[:60]}",
                fix_hint="Use I18n.t('KEY') and register the text in game/src/i18n.js"
            ))

    return violations


def scan_css_for_important(filepath, rel_path, added_lines):
    """
    [CSS001] 新規 !important 検出
    - 既存負債はカウントのみ
    - 変更行 (added_lines) に含まれる新規 !important のみ ERROR
    """
    violations = []
    existing_debt_count = 0

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    is_changed_file = rel_path in added_lines

    for idx, line in enumerate(lines, 1):
        if "!important" in line:
            stripped = line.strip()
            if stripped.startswith("/*") or stripped.startswith("*"):
                continue

            if is_changed_file and idx in added_lines[rel_path]:
                violations.append(LintViolation(
                    rule_id="CSS001",
                    level="ERROR",
                    filepath=rel_path,
                    line_num=idx,
                    message="Forbidden new '!important' rule detected in changed lines.",
                    fix_hint="Use scoped CSS selectors (:not() or dedicated wrapper classes) instead of !important"
                ))
            else:
                existing_debt_count += 1

    return violations, existing_debt_count


def scan_html_for_inline_styles(filepath, rel_path, added_lines):
    """
    [CSS002] HTML 内のインライン style="..." 検出
    - 新規追加行の style= は ERROR
    """
    violations = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    is_changed_file = rel_path in added_lines

    for idx, line in enumerate(lines, 1):
        if re.search(r'<\w+[^>]*\sstyle=["\']', line):
            if line.strip().startswith("<!--"):
                continue
            if is_changed_file and idx in added_lines[rel_path]:
                violations.append(LintViolation(
                    rule_id="CSS002",
                    level="ERROR",
                    filepath=rel_path,
                    line_num=idx,
                    message="Raw inline style attribute 'style=\"...\"' detected in HTML.",
                    fix_hint="Move visual styling to dedicated CSS classes or layout_config.js"
                ))
    return violations


def scan_js_for_style_mutations(filepath, rel_path, added_lines):
    """
    [CSS003] JS 内の直接スタイル操作検出 (WARN)
    - .style.cssText =
    """
    violations = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    is_changed_file = rel_path in added_lines

    for idx, line in enumerate(lines, 1):
        if is_changed_file and idx in added_lines[rel_path]:
            if re.search(r'\.style\.cssText\s*=', line):
                violations.append(LintViolation(
                    rule_id="CSS003",
                    level="WARN",
                    filepath=rel_path,
                    line_num=idx,
                    message="Direct style mutation via '.style.cssText =' detected.",
                    fix_hint="Switch to CSS class toggling or layout_config.js SSOT"
                ))
    return violations


def scan_architecture_guards(filepath, rel_path):
    """
    [ARCH001] Domain 層からの DOM 直接参照禁止
    - core/ および trial/domain/ が対象
    - document, window, HTMLElement, querySelector を禁止
    """
    violations = []
    is_domain_core = ("src" + os.sep + "core" in rel_path) or ("trial" + os.sep + "domain" in rel_path)
    if not is_domain_core:
        return violations

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    dom_pattern = re.compile(r'\b(document\.|window\.|HTMLElement|document\.getElementById|document\.querySelector)\b')

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        if dom_pattern.search(line):
            violations.append(LintViolation(
                rule_id="ARCH001",
                level="ERROR",
                filepath=rel_path,
                line_num=idx,
                message=f"Domain layer must not access DOM APIs: '{line.strip()[:60]}'",
                fix_hint="Keep domain logic pure (Mobile & Unity Ready). Notify UI layer via state/events"
            ))

    return violations


def scan_card_architecture_violations(root_dir):
    """
    [CARD001 / CARD002 / CARD003] カードデータ分離 ＆ 整合性検査
    """
    violations = []
    game_dir = os.path.join(root_dir, "game", "src")
    import json

    # 1. [CARD001] ロジックディレクトリでのカードデータ定義ハードコード
    logic_dirs = [
        os.path.join(game_dir, "systems"),
        os.path.join(game_dir, "ui"),
        os.path.join(game_dir, "core"),
        os.path.join(game_dir, "trial")
    ]
    for d in logic_dirs:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            for f in files:
                if f.endswith(".js") and "backup" not in f and "dev" not in root:
                    p = os.path.join(root, f)
                    rel_p = os.path.relpath(p, root_dir)
                    with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                        if re.search(r'const\s+COMMAND_CARDS_MASTER\s*=\s*\[', content):
                            violations.append(LintViolation(
                                rule_id="CARD001",
                                level="ERROR",
                                filepath=rel_p,
                                line_num=1,
                                message="Hardcoded card master array 'const COMMAND_CARDS_MASTER = [...]' in logic layer.",
                                fix_hint="Store cards in game/src/data/*.json pure assets"
                            ))
                        if re.search(r'\{\s*(?:id:\s*"CMD_[A-Z_]+"[^}]+category:\s*"(?:COMMAND|ECONOMY|MILITARY|MYSTIC)"|category:\s*"(?:COMMAND|ECONOMY|MILITARY|MYSTIC)"[^}]+id:\s*"CMD_[A-Z_]+")', content):
                            violations.append(LintViolation(
                                rule_id="CARD001",
                                level="ERROR",
                                filepath=rel_p,
                                line_num=1,
                                message="Card master object literal definition detected in logic code.",
                                fix_hint="Isolate card data into game/src/data/*.json"
                            ))

    # 2. [CARD002] land_cards.json の純化（非LANDカード混入禁止）
    land_json = os.path.join(game_dir, "data", "land_cards.json")
    if os.path.exists(land_json):
        try:
            with open(land_json, 'r', encoding='utf-8') as fp:
                cards = json.load(fp)
                for idx, c in enumerate(cards):
                    cid = c.get("id", "")
                    cat = c.get("category", "")
                    if cat != "LAND":
                        violations.append(LintViolation(
                            rule_id="CARD002",
                            level="ERROR",
                            filepath="game/src/data/land_cards.json",
                            line_num=idx + 1,
                            message=f"Non-LAND category '{cat}' ({cid}) found in land_cards.json.",
                            fix_hint="Only LAND category cards belong in land_cards.json"
                        ))
        except Exception as e:
            violations.append(LintViolation(
                rule_id="CARD002",
                level="ERROR",
                filepath="game/src/data/land_cards.json",
                line_num=1,
                message=f"JSON parse error: {e}",
                fix_hint="Fix JSON syntax in land_cards.json"
            ))

    # 3. [CARD003] 削除された旧カードの残存検知
    banned_legacy_cards = ["CMD_CONSERVE_EMBER", "CMD_LAND_FOCUS", "CMD_BLACK_MARKET"]
    data_dir = os.path.join(game_dir, "data")
    if os.path.exists(data_dir):
        for root, _, files in os.walk(data_dir):
            for f in files:
                if f.endswith((".json", ".js")):
                    p = os.path.join(root, f)
                    rel_p = os.path.relpath(p, root_dir)
                    with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                        c_text = fp.read()
                        for b_card in banned_legacy_cards:
                            if f'"{b_card}"' in c_text or f"'{b_card}'" in c_text:
                                violations.append(LintViolation(
                                    rule_id="CARD003",
                                    level="ERROR",
                                    filepath=rel_p,
                                    line_num=1,
                                    message=f"Deleted legacy card ID '{b_card}' still present in data assets.",
                                    fix_hint=f"Remove reference to {b_card}"
                                ))

    return violations


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    game_dir = os.path.join(root_dir, "game")

    strict_all_mode = "--all" in sys.argv

    # 差分行情報の取得 (Diff-Aware: 未ステージ + ステージ済み)
    added_lines = get_git_diff_added_lines(root_dir)
    all_violations = []
    total_files_scanned = 0
    total_css_debt = 0
    total_legacy_i18n_debt = 0
    total_legacy_arch_debt = 0

    print("=== AoT Master Static Lint Guardrail (Fast Pre-Write Inspection) ===")
    print(
        "Policy: existing violations are baseline debt; "
        "new violations in Git-added lines fail"
        + ("; --all treats every violation as an error." if strict_all_mode else ".")
    )
    print(f"Git-added source lines detected in {len(added_lines)} file(s).")

    # 1. game/src 配下の全 JS を走査 (除外: i18n.js, data/)
    src_dir = os.path.join(game_dir, "src")
    exclude_files = ["i18n.js"]

    for root, dirs, files in os.walk(src_dir):
        if "data" in root:
            continue
        for f in files:
            if f.endswith(".js") and f not in exclude_files and "backup" not in f:
                filepath = os.path.join(root, f)
                rel_path = os.path.relpath(filepath, root_dir)
                total_files_scanned += 1

                # I18N001 日本語直書き
                jp_v = scan_file_for_japanese(filepath, rel_path)
                for v in jp_v:
                    is_new = (rel_path in added_lines and v.line_num in added_lines[rel_path])
                    if is_new or strict_all_mode:
                        all_violations.append(v)
                    else:
                        total_legacy_i18n_debt += 1

                # ARCH001 ドメイン境界
                arch_v = scan_architecture_guards(filepath, rel_path)
                for v in arch_v:
                    is_new = (rel_path in added_lines and v.line_num in added_lines[rel_path])
                    if is_new or strict_all_mode:
                        all_violations.append(v)
                    else:
                        total_legacy_arch_debt += 1

                # CSS003 スタイル直接操作 (WARN)
                all_violations.extend(scan_js_for_style_mutations(filepath, rel_path, added_lines))

    # 2. game/index.html 走査
    index_html = os.path.join(game_dir, "index.html")
    if os.path.exists(index_html):
        rel_path = os.path.relpath(index_html, root_dir)
        total_files_scanned += 1
        jp_v = scan_file_for_japanese(index_html, rel_path)
        for v in jp_v:
            if rel_path in added_lines and v.line_num in added_lines[rel_path]:
                all_violations.append(v)
            else:
                total_legacy_i18n_debt += 1
        all_violations.extend(scan_html_for_inline_styles(index_html, rel_path, added_lines))

    # 3. game/css 配下の全 CSS 走査
    css_dir = os.path.join(game_dir, "css")
    if os.path.exists(css_dir):
        for root, dirs, files in os.walk(css_dir):
            for f in files:
                if f.endswith(".css"):
                    filepath = os.path.join(root, f)
                    rel_path = os.path.relpath(filepath, root_dir)
                    total_files_scanned += 1
                    css_v, debt = scan_css_for_important(filepath, rel_path, added_lines)
                    all_violations.extend(css_v)
                    total_css_debt += debt

    # 4. カードデータ完全分離 ＆ 旧カード排除 (CARD001, CARD002, CARD003)
    card_v = scan_card_architecture_violations(root_dir)
    all_violations.extend(card_v)

    errors = [v for v in all_violations if v.level == "ERROR"]
    warnings = [v for v in all_violations if v.level == "WARN"]

    print(f"Scanned {total_files_scanned} runtime files.")
    print(f"  [Baseline Debt] CSS !important: {total_css_debt} | Legacy DOM refs: {total_legacy_arch_debt} | Legacy I18N debt: {total_legacy_i18n_debt}")

    if warnings:
        print(f"\n⚠️  WARNINGS ({len(warnings)} found):")
        for w in warnings:
            print(w.format())

    if errors:
        print(f"\n❌ LINT FAILED: {len(errors)} error violation(s) detected:")
        for e in errors:
            print(e.format())
        print("\nPlease resolve all ERROR violations before completing work.")
        sys.exit(1)
    else:
        print(f"✅ PASSED: No configured static lint violations found. (0 errors, {len(warnings)} warnings)")
        sys.exit(0)

if __name__ == "__main__":
    main()
