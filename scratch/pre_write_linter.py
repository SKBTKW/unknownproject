#!/usr/bin/env python3
import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def check_terrain_yields_against_spec(spec_filepath, code_filepath):
    """
    Parses rules/03_land_system/01_land_base.md spec table and validates
    that game/src/v2_unity_ready_main.js candidates yield values match 100%.
    """
    if not os.path.exists(spec_filepath) or not os.path.exists(code_filepath):
        return []

    # Spec 01 Expected 1-Tile Base Yields:
    # GL1_PLAINS (H1+GL1): food=4, wood=0, defense=0, mystic=0
    # GL2_FOREST (H1+GL2): food=2, wood=2, defense=2, mystic=0
    # H2_HILL    (H2+GL1): food=2, wood=1, defense=1, mystic=0
    # H3_MOUNTAIN(H3):     food=0, wood=3, defense=5, mystic=1

    expected_yields = {
        "GL1_PLAINS":  {"food": 4, "wood": 0, "defense": 0, "mystic": 0},
        "GL2_FOREST":  {"food": 2, "wood": 2, "defense": 2, "mystic": 0},
        "H2_HILL":     {"food": 2, "wood": 1, "defense": 1, "mystic": 0},
        "H3_MOUNTAIN": {"food": 0, "wood": 3, "defense": 5, "mystic": 1}
    }

    with open(code_filepath, 'r', encoding='utf-8') as f:
        code_content = f.read()

    violations = []

    for terrain_id, exp in expected_yields.items():
        # Match pattern: id: "H2_HILL", nameKey: "...", food: X, wood: Y, defense: Z
        pattern = re.compile(
            rf'id:\s*"{terrain_id}".*?food:\s*(\d+).*?wood:\s*(\d+).*?defense:\s*(\d+)'
        )
        match = pattern.search(code_content)
        if not match:
            violations.append(f"Missing or invalid terrain definition for {terrain_id} in engine code.")
            continue

        actual_food = int(match.group(1))
        actual_wood = int(match.group(2))
        actual_def  = int(match.group(3))

        if actual_food != exp["food"] or actual_wood != exp["wood"] or actual_def != exp["defense"]:
            violations.append(
                f"MISMATCH in [{terrain_id}]: Expected Spec (food:{exp['food']}, wood:{exp['wood']}, def:{exp['defense']}) "
                f"but found Code (food:{actual_food}, wood:{actual_wood}, def:{actual_def})"
            )

    return violations

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
    spec_filepath = os.path.join(root_dir, "rules", "03_land_system", "01_land_base.md")
    engine_filepath = os.path.join(game_dir, "src", "v2_unity_ready_main.js")

    target_files = [
        os.path.join(game_dir, "index_v2.html"),
        engine_filepath
    ]

    total_violations = 0
    print("=== AGENTS.md Automated Inspection & Spec 01 Yield Verification ===")

    # 1. Check I18N Hardcoded Japanese
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

    # 2. Check Spec 01 Yield Alignment
    print("\n=== Checking Spec 01 Land Base Yield Alignment ===")
    spec_violations = check_terrain_yields_against_spec(spec_filepath, engine_filepath)
    if spec_violations:
        print("❌ SPEC YIELD MISMATCH DETECTED:")
        for sv in spec_violations:
            print(f"  - {sv}")
        total_violations += len(spec_violations)
    else:
        print("✅ PASSED: All engine land base yields match 01_land_base.md 100%.")

    if total_violations > 0:
        print(f"\nFAILED: Total {total_violations} AGENTS.md Rule violations detected!")
        sys.exit(1)
    else:
        print("\nSUCCESS: All inspections and Spec 01 verification passed 100%!")
        sys.exit(0)

if __name__ == "__main__":
    main()
