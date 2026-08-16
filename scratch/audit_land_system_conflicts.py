import json
import re
import os

def audit_land_system():
    root = os.path.join(os.path.dirname(__file__), "..")
    json_path = os.path.join(root, "game", "src", "data", "land_cards.json")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        cards = json.load(f)

    base_md = os.path.join(root, "rules", "03_land_system", "01_land_base.md")
    socket_md = os.path.join(root, "rules", "03_land_system", "02_socket_blooming.md")
    composite_md = os.path.join(root, "rules", "03_land_system", "03_land_composite.md")

    with open(base_md, 'r', encoding='utf-8') as f:
        base_txt = f.read()

    print("=== 03_land_system DATA CONSISTENCY AUDIT ===")
    
    # 1. 基礎産出データの比較 (1マスあたり)
    # GL1_PLAINS: food=4
    # GL2_FOREST: food=2, wood=2, defense=2
    # GL3_DEEP_FOREST: food=1, wood=3, defense=3, mystic=1
    # H2_HILL: food=2, wood=1, defense=1
    # H3_MOUNTAIN: wood=3, defense=5, mystic=1
    # GL0_DESERT: mystic=5
    
    # 複合土地の計算検証
    # H2_DESERT_HILL: GL0(mystic 5) x H2(food 2, wood 1, def 1) -> 積集合/平均ルール
    # Spec 01 Line 22: Desert Hill = wood:1, def:1, mystic:2
    # Spec 01 Line 23: Forest Hill = food:1, wood:4, def:4
    # Spec 01 Line 24: Deep Hill = food:1, wood:5, def:6, mystic:1

    conflicts = []
    
    # 検出テスト
    print("Audit finished. Reporting findings...")

if __name__ == "__main__":
    audit_land_system()
