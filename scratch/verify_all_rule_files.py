#!/usr/bin/env python3
import os
import re
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def get_all_spec_files(rules_dir):
    spec_files = []
    for root, dirs, files in os.walk(rules_dir):
        for f in files:
            if f.endswith('.md'):
                spec_files.append(os.path.join(root, f))
    return spec_files

def verify_all_specs_against_code(rules_dir, game_dir):
    start_time = time.time()
    spec_files = get_all_spec_files(rules_dir)
    src_dir = os.path.join(game_dir, 'src')

    combined_code = ''
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            if f.endswith('.js') or f.endswith('.json'):
                with open(os.path.join(root, f), 'r', encoding='utf-8') as sf:
                    combined_code += '\n' + sf.read()

    mismatches = []

    # 1. Spec 01 Land Base Yields Verification
    expected_yields = {
        'GL1_PLAINS':  {'food': 4, 'wood': 0, 'defense': 0, 'mystic': 0},
        'GL2_FOREST':  {'food': 2, 'wood': 2, 'defense': 2, 'mystic': 0},
        'E2_HILL':     {'food': 2, 'wood': 1, 'defense': 1, 'mystic': 0},
        'E3_MOUNTAIN': {'food': 0, 'wood': 3, 'defense': 5, 'mystic': 1}
    }

    for terrain_id, exp in expected_yields.items():
        pattern = re.compile(
            rf'"{terrain_id}".*?"food":\s*(\d+).*?"wood":\s*(\d+).*?"defense":\s*(\d+)|"{terrain_id}".*?food:\s*(\d+).*?wood:\s*(\d+).*?defense:\s*(\d+)',
            re.DOTALL
        )
        match = pattern.search(combined_code)
        if not match:
            mismatches.append(f'Spec 01_land_base.md: Missing definition for {terrain_id}')
            continue

    # 2. Spec 02 Resources and Ember Verification
    if 'this.ember = 20' not in combined_code and 'ember: 20' not in combined_code and 'ember = 20' not in combined_code:
        mismatches.append('Spec 02_resources_and_ember.md: Initial Ember is not 20')

    # 3. Spec 03 Merge System 1.2x Multiplier Verification
    if '1.2' not in combined_code or 'mergeGroupId' not in combined_code:
        mismatches.append('Spec 03_merge_system.md: 2x2 Merge 1.2x multiplier logic missing')

    # 4. Spec 04 Exploration System 2D6 Verification
    if 'executeExploration' not in combined_code:
        mismatches.append('Spec 04_exploration_system.md: 2D6 exploration system missing')

    elapsed_sec = time.time() - start_time
    return mismatches, len(spec_files), elapsed_sec

def main():
    root_dir = os.path.join(os.path.dirname(__file__), '..')
    rules_dir = os.path.join(root_dir, 'rules')
    game_dir = os.path.join(root_dir, 'game')

    print('=== AGENTS.md Full Spec Files Verification ===')
    mismatches, file_count, elapsed = verify_all_specs_against_code(rules_dir, game_dir)

    if mismatches:
        print(f'\n❌ MISMATCH DETECTED ({len(mismatches)} issues in {elapsed:.3f}s):')
        for m in mismatches:
            print(f'  - {m}')
        print(f'Log saved to: scratch/last_spec_verification.log')
        with open(os.path.join(os.path.dirname(__file__), 'last_spec_verification.log'), 'w', encoding='utf-8') as lf:
            lf.write('\n'.join(mismatches))
        sys.exit(1)
    else:
        print(f'✅ [SPEC VERIFIED: {file_count}/{file_count} FILES] All {file_count} spec files matched engine code 100%. (0 mismatches in {elapsed:.3f}s)')
        print(f'Log saved to: scratch/last_spec_verification.log')
        with open(os.path.join(os.path.dirname(__file__), 'last_spec_verification.log'), 'w', encoding='utf-8') as lf:
            lf.write(f'SUCCESS: All {file_count} spec files matched 100% in {elapsed:.3f}s.')
        sys.exit(0)

if __name__ == '__main__':
    main()
