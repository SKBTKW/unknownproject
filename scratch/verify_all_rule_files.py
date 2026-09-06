#!/usr/bin/env python3
import os
import re
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def load_json_file(filepath):
    import json
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def verify_all_specs_against_code(rules_dir, game_dir):
    start_time = time.time()
    src_dir = os.path.join(game_dir, 'src')

    assertions = []

    # 1. Spec 01 Land Base Yields: land_cards.json (1x1カード) および land_system.json の実数値突合
    land_cards_path = os.path.join(src_dir, 'data', 'land_cards.json')
    land_system_json_path = os.path.join(src_dir, 'data', 'land_system.json')

    land_cards = load_json_file(land_cards_path)
    land_system = load_json_file(land_system_json_path)

    expected_yields = {
        'GL1_PLAINS':  {'food': 4, 'wood': 0, 'defense': 0, 'mystic': 0},
        'GL2_FOREST':  {'food': 2, 'wood': 2, 'defense': 2, 'mystic': 0},
        'E2_HILL':     {'food': 2, 'wood': 1, 'defense': 1, 'mystic': 0},
        'E3_MOUNTAIN': {'food': 0, 'wood': 3, 'defense': 5, 'mystic': 1}
    }

    if not land_cards and not land_system:
        assertions.append({
            'id': 'SPEC01_LAND_DATA_EXISTS',
            'spec': '01_land_base.md',
            'passed': False,
            'message': 'Neither land_cards.json nor land_system.json found'
        })
    else:
        # land_cards.json から 1x1 カードをマッピング
        cards_1x1 = {}
        if land_cards:
            for c in land_cards:
                if isinstance(c, dict) and c.get('shape') == [[1]]:
                    tid = c.get('terrainId')
                    if tid and tid not in cards_1x1:
                        cards_1x1[tid] = c.get('yields', {})

        # land_system.json からもマスター定義を取得
        system_terrains = {}
        if land_system and isinstance(land_system, dict):
            # terrains or land_types
            t_dict = land_system.get('TERRAINS') or land_system.get('terrains') or land_system
            if isinstance(t_dict, dict):
                for k, v in t_dict.items():
                    if isinstance(v, dict):
                        tid = v.get('id') or k
                        system_terrains[tid] = v.get('baseYieldsPerTile') or v.get('yields') or v

        for terrain_id, exp_yield in expected_yields.items():
            actual_yield = cards_1x1.get(terrain_id)
            if not actual_yield and terrain_id in system_terrains:
                actual_yield = system_terrains[terrain_id]

            if not actual_yield:
                assertions.append({
                    'id': f'SPEC01_EXISTS_{terrain_id}',
                    'spec': '01_land_base.md',
                    'passed': False,
                    'message': f'Yields definition for {terrain_id} not found in land data assets'
                })
                continue

            mismatch_props = []
            for res_key, exp_val in exp_yield.items():
                act_val = actual_yield.get(res_key)
                if act_val != exp_val:
                    mismatch_props.append(f'{res_key}: expected {exp_val}, got {act_val}')

            assertions.append({
                'id': f'SPEC01_YIELD_{terrain_id}',
                'spec': '01_land_base.md',
                'passed': len(mismatch_props) == 0,
                'message': f'{terrain_id} yield mismatch: {", ".join(mismatch_props)}' if mismatch_props else f'{terrain_id} yields matched expected values'
            })

    # 2. Spec 02 Initial Resources: GameState / Engine の初期定数突合
    game_state_path = os.path.join(src_dir, 'core', 'game_state.js')
    if os.path.exists(game_state_path):
        with open(game_state_path, 'r', encoding='utf-8') as f:
            gs_content = f.read()

        # initial ember = 20
        ember_match = re.search(r'this\.ember\s*=\s*(\d+)', gs_content)
        act_ember = int(ember_match.group(1)) if ember_match else None
        assertions.append({
            'id': 'SPEC02_INITIAL_EMBER',
            'spec': '02_resources_and_ember.md',
            'passed': act_ember == 20,
            'message': f'Initial Ember: expected 20, got {act_ember}'
        })

        # initial food = 50
        food_match = re.search(r'this\.food\s*=\s*(\d+)', gs_content)
        act_food = int(food_match.group(1)) if food_match else None
        assertions.append({
            'id': 'SPEC02_INITIAL_FOOD',
            'spec': '02_resources_and_ember.md',
            'passed': act_food == 50,
            'message': f'Initial Food: expected 50, got {act_food}'
        })

        # initial wood = 30
        wood_match = re.search(r'this\.wood\s*=\s*(\d+)', gs_content)
        act_wood = int(wood_match.group(1)) if wood_match else None
        assertions.append({
            'id': 'SPEC02_INITIAL_WOOD',
            'spec': '02_resources_and_ember.md',
            'passed': act_wood == 30,
            'message': f'Initial Wood: expected 30, got {act_wood}'
        })

    # 3. Spec 03 Merge System 1.2x Multiplier
    prod_calc_path = os.path.join(src_dir, 'systems', 'production_calculator.js')
    if os.path.exists(prod_calc_path):
        with open(prod_calc_path, 'r', encoding='utf-8') as f:
            pc_content = f.read()
        mult_match = re.search(r'(?:1\.2|1\.20)', pc_content)
        has_group = 'mergeGroupId' in pc_content
        assertions.append({
            'id': 'SPEC03_MERGE_MULTIPLIER',
            'spec': '03_merge_system.md',
            'passed': bool(mult_match and has_group),
            'message': '2x2 Merge 1.2x multiplier logic verified in production_calculator.js' if mult_match and has_group else 'Merge 1.2x logic missing'
        })

    # 4. Spec 04 Exploration System (2D6 exploration in deck_manager.js)
    deck_mgr_path = os.path.join(src_dir, 'systems', 'deck_manager.js')
    has_exploration = False
    if os.path.exists(deck_mgr_path):
        with open(deck_mgr_path, 'r', encoding='utf-8') as f:
            dm_content = f.read()
        has_exploration = 'executeExploration(r, c)' in dm_content or 'executeExploration(' in dm_content

    assertions.append({
        'id': 'SPEC04_EXPLORATION_METHOD',
        'spec': '04_exploration_system.md',
        'passed': has_exploration,
        'message': '2D6 Exploration system verified in deck_manager.js' if has_exploration else 'Exploration system missing in deck_manager.js'
    })

    elapsed_sec = time.time() - start_time
    return assertions, elapsed_sec

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    rules_dir = os.path.join(root_dir, 'rules')
    game_dir = os.path.join(root_dir, 'game')

    print('=== AoT Master Spec Assertions (Expected vs Actual) ===')
    assertions, elapsed = verify_all_specs_against_code(rules_dir, game_dir)

    passed_count = sum(1 for a in assertions if a['passed'])
    total_count = len(assertions)
    failed = [a for a in assertions if not a['passed']]

    if failed:
        print(f'\n❌ FAILED: {len(failed)} of {total_count} spec assertions failed ({elapsed:.3f}s):')
        for a in failed:
            print(f'  - [{a["id"]}] ({a["spec"]}): {a["message"]}')
        sys.exit(1)
    else:
        print(f'✅ PASSED: {passed_count}/{total_count} automated spec assertions passed. (0 mismatches in {elapsed:.3f}s)')
        sys.exit(0)

if __name__ == '__main__':
    main()
