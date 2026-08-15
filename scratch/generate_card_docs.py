#!/usr/bin/env python3
import json
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def format_shape(shape):
    rows = len(shape)
    cols = len(shape[0])
    return f"`{rows} × {cols}` (`{json.dumps(shape)}`)"

def format_yields(yields, count=1):
    f = yields.get("food", 0) * count
    w = yields.get("wood", 0) * count
    d = yields.get("defense", 0) * count
    m = yields.get("mystic", 0) * count

    parts = []
    if f > 0: parts.append(f"🌾{f}")
    if w > 0: parts.append(f"🧱{w}")
    if d > 0: parts.append(f"🛡️{d}")
    if m > 0: parts.append(f"✨{m}")

    if not parts:
        return "なし"
    if len(parts) == 1:
        return f"**`{parts[0]}`**"
    return f"**`({', '.join(parts)})`**"

def generate_markdown(json_filepath, output_filepath):
    with open(json_filepath, 'r', encoding='utf-8') as f:
        cards = json.load(f)

    # グループ分け
    groups = {
        "平地": [c for c in cards if c["terrainId"] == "GL1_PLAINS"],
        "森": [c for c in cards if c["terrainId"] == "GL2_FOREST"],
        "深い森": [c for c in cards if c["terrainId"] == "GL3_DEEP_FOREST"],
        "丘陵": [c for c in cards if c["terrainId"] == "H2_HILL"],
        "山岳": [c for c in cards if c["terrainId"] == "H3_MOUNTAIN"],
        "砂漠": [c for c in cards if c["terrainId"] == "GL0_DESERT"],
        "複合土地": [c for c in cards if "HILL" in c["terrainId"] and c["terrainId"] != "H2_HILL"]
    }

    lines = [
        "# 09. カード一覧 仕様書 (Card List Specification)",
        "",
        "本仕様書は、`game/src/data/land_cards.json` を Single Source of Truth とし、自動同期スクリプトにより生成された全カードマスターデータベースである。",
        "",
        "---",
        "",
        "## ─── 🌱 カテゴリ: 土地 (Land Cards) ───",
        "",
        "土地カードは領土を開墾し、毎ターンの基礎持続収入（🌾食料 / 🧱資材 / 🛡️防衛 / ✨神秘）を生み出すインフラカードである。",
        "1 マスあたりの基礎持続収入は公式計算式 `基礎産出 = 基礎産出 × マス数` に従って自動算出される。",
        ""
    ]

    section_names = {
        "平地": "🌾 1. 平地 (Plains) カード群 (`GL1+H1` / 1マス産出: `🌾 4`)",
        "森": "🌲 2. 森 (Forest) カード群 (`GL2+H1` / 1マス産出: `🌾 2 / 🧱 2 / 🛡️ 2`)",
        "深い森": "🌳 3. 深い森 (Deep Forest) カード群 (`GL3+H1` / 1マス産出: `🌾 1 / 🧱 3 / 🛡️ 3 / ✨ 1`)",
        "丘陵": "⛰️ 4. 丘陵 (Hill) カード群 (`GL1+H2` / 1マス産出: `🌾 2 / 🧱 1 / 🛡️ 1`)",
        "山岳": "🏔️ 5. 山岳 (Mountain) カード群 (`GL2+H3` / 1マス産出: `🧱 3 / 🛡️ 5 / ✨ 1`)",
        "砂漠": "🏜️ 6. 砂漠 (Desert) カード群 (`GL0+H1` / 1マス産出: `✨ 5`)",
        "複合土地": "🪵 7. 複合土地 (Composite Lands) カード群 (モデル A 積集合: `1×2` 固定)"
    }

    for g_key, g_cards in groups.items():
        lines.append(f"### {section_names[g_key]}")
        lines.append("")
        if g_key == "複合土地":
            lines.append("| カード ID | カード名称 | 属性組み合わせ | ブロック形状 (`shapeMatrix`) | レアリティ | 毎ターン合計持続産出 | 特徴・プレイ感 |")
            lines.append("| :--- | :--- | :---: | :--- | :---: | :---: | :--- |")
            for c in g_cards:
                tile_count = sum(sum(row) for row in c["shape"])
                tot_yield = format_yields(c["yields"], tile_count)
                combo = f"地勢(GL{c['gl']}) ✕ 丘陵(H{c['h']})"
                lines.append(f"| `{c['id']}` | **{c['id'].replace('CARD_', '').replace('_1X2', '')}** | {combo} | {format_shape(c['shape'])} 🔄 | **{c['rarity']}** | {tot_yield} | 複合カード ({c['rarity']})。 |")
        else:
            lines.append("| カード ID | カード名称 | アンロック | ブロック形状 (`shapeMatrix`) | レアリティ | 毎ターン合計持続産出 | 特徴・プレイ感 |")
            lines.append("| :--- | :--- | :---: | :--- | :---: | :---: | :--- |")
            for c in g_cards:
                tile_count = sum(sum(row) for row in c["shape"])
                tot_yield = format_yields(c["yields"], tile_count)
                unlock = f"Stage {c['minStage']}" if c['reqH2'] == 0 else f"丘陵{c['reqH2']}マス配置"
                rot = " 🔄" if tile_count > 1 and c['shape'] != [[1, 1], [1, 1]] else ""
                lines.append(f"| `{c['id']}` | **{c['id'].replace('CARD_', '')}** | {unlock} | {format_shape(c['shape'])}{rot} | **{c['rarity']}** | {tot_yield} | {g_key}カード ({c['rarity']})。 |")
        lines.append("")
        lines.append("---")
        lines.append("")

    with open(output_filepath, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
    print(f"Successfully generated {output_filepath} from {json_filepath}")

if __name__ == "__main__":
    root = os.path.join(os.path.dirname(__file__), "..")
    json_p = os.path.join(root, "game", "src", "data", "land_cards.json")
    out_p = os.path.join(root, "rules", "09_card_list.md")
    generate_markdown(json_p, out_p)
