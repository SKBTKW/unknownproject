#!/usr/bin/env python3
import json
import os
import sys
import tempfile

sys.path.insert(0, 'scratch')
import verify_all_rule_files
import pre_write_linter

print("=== Spec verifier / lint fail-closed regression tests ===")

EXPECTED_LAND = [
    {"terrainId": "GL1_PLAINS", "shape": [[1]], "yields": {"food": 4, "wood": 0, "defense": 0, "mystic": 0}},
    {"terrainId": "GL2_FOREST", "shape": [[1]], "yields": {"food": 2, "wood": 2, "defense": 2, "mystic": 0}},
    {"terrainId": "E2_HILL", "shape": [[1]], "yields": {"food": 2, "wood": 1, "defense": 1, "mystic": 0}},
    {"terrainId": "E3_MOUNTAIN", "shape": [[1]], "yields": {"food": 0, "wood": 3, "defense": 5, "mystic": 1}},
]

PRODUCTION_SOURCE = """
export const ProductionCalculator = {
    multiplier: 1.20,
    read(cell) { return cell.mergeGroupId; }
};
"""

def write_fixture(root, *, plains_food=4, include_production=True):
    src = os.path.join(root, 'game', 'src')
    data = os.path.join(src, 'data')
    systems = os.path.join(src, 'systems')
    os.makedirs(data, exist_ok=True)
    os.makedirs(systems, exist_ok=True)

    cards = json.loads(json.dumps(EXPECTED_LAND))
    cards[0]['yields']['food'] = plains_food
    with open(os.path.join(data, 'land_cards.json'), 'w', encoding='utf-8') as f:
        json.dump(cards, f)

    if include_production:
        with open(os.path.join(systems, 'production_calculator.js'), 'w', encoding='utf-8') as f:
            f.write(PRODUCTION_SOURCE)

def failures(assertions):
    return {item['id']: item for item in assertions if not item['passed']}

with tempfile.TemporaryDirectory() as tmpdir:
    write_fixture(tmpdir, plains_food=99)
    assertions, _ = verify_all_rule_files.verify_all_specs_against_code('rules', os.path.join(tmpdir, 'game'))
    failed = failures(assertions)
    assert 'SPEC01_YIELD_GL1_PLAINS' in failed, failed
    print("PASS: corrupted land yield is rejected")

with tempfile.TemporaryDirectory() as tmpdir:
    write_fixture(tmpdir, include_production=False)
    assertions, _ = verify_all_rule_files.verify_all_specs_against_code('rules', os.path.join(tmpdir, 'game'))
    failed = failures(assertions)
    assert 'SPEC03_PRODUCTION_CALCULATOR_EXISTS' in failed, failed
    print("PASS: missing required Production implementation is rejected")

with tempfile.TemporaryDirectory() as tmpdir:
    write_fixture(tmpdir)
    assertions, _ = verify_all_rule_files.verify_all_specs_against_code('rules', os.path.join(tmpdir, 'game'))
    failed = failures(assertions)
    assert not failed, failed
    print("PASS: valid minimal current-spec fixture passes")

with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
    tf.write('const msg = "勝手に追加した未翻訳テキスト";\n')
    temp_filepath = tf.name

try:
    violations = pre_write_linter.scan_file_for_hardcoded_japanese(temp_filepath)
finally:
    os.remove(temp_filepath)

assert violations, 'hardcoded Japanese text must be detected'
print("PASS: hardcoded Japanese text is rejected")
print("Spec verifier / lint fail-closed regression tests: PASS")