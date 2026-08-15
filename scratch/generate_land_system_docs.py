#!/usr/bin/env python3
import json
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def format_yield(y):
    f = y.get("food", 0)
    w = y.get("wood", 0)
    d = y.get("defense", 0)
    m = y.get("mystic", 0)
    return f"`🌾{f} 🧱{w} 🛡️{d} ✨{m}`"

def format_socket_yield(y):
    parts = []
    f = y.get("food", 0)
    w = y.get("wood", 0)
    d = y.get("defense", 0)
    m = y.get("mystic", 0)
    if f > 0: parts.append(f"🌾 +{f}")
    if w > 0: parts.append(f"🧱 +{w}")
    if d > 0: parts.append(f"🛡️ +{d}")
    if m > 0: parts.append(f"✨ +{m}")
    return f"**`{' ＋ '.join(parts)} / T`**"

def generate_docs(json_path, output_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    terrains = data["terrains"]
    sockets = data["sockets"]

    lines = [
        "# 01. 土地基礎産出 ＆ ★ ソケット ＆ 湖 仕様書",
        "",
        "本仕様書は `game/src/data/land_system.json` を Single Source of Truth とし、自動同期スクリプトにより生成された土地システムの決定仕様書である。",
        "",
        "## 🧮 1. 1マス基礎産出公式 ＆ 9パターン確定数値マトリクス (全数値 1マスあたり統一)",
        "",
        "- **1マス基礎産出公式 (※絶対厳守)**: `基礎産出 = 基礎産出 × マス数`",
    ]

    terrain_order = [
        ("GL0_DESERT", "🏜️ 砂漠 (`H1+GL0`)"),
        ("GL1_PLAINS", "🌾 草原 (`H1+GL1`)"),
        ("GL2_FOREST", "🌲 森 (`H1+GL2`)"),
        ("GL3_DEEP_FOREST", "🌳 深い森 (`H1+GL3`)"),
        ("H2_DESERT_HILL", "🏜️ 荒野 (`H2+GL0`)"),
        ("H2_HILL", "⛰️ 丘陵 (`H2+GL1`)"),
        ("H2_FOREST_HILL", "🪵 森丘陵 (`H2+GL2`)"),
        ("H2_DEEP_HILL", "🌲 森林丘陵 (`H2+GL3`)"),
        ("H3_MOUNTAIN", "🏔️ 山岳 (`H3`)")
    ]

    for tid, label in terrain_order:
        t = terrains[tid]
        lines.append(f"  - {label}: {format_yield(t['baseYieldsPerTile'])}")

    lines.extend([
        "",
        "- **🌱 同属性土地接続 ✕ 段階的即時リソースボーナス**:",
        "  - 同属性の土地ブロックを繋げて配置した際、置いた瞬間にストックへ直接入る「即時ボーナス (一時金)」が給付される。",
        "  - **1マス配置 (単体)**: 通常配置 (ボーナスなし)。",
        "  - **2マス目接続 (2度目)**: 確定マトリクス即時ボーナス獲得 (例: 草原 `🌾+5`, 森 `🌾+2/🧱+3`, 丘陵 `🌾+3/🧱+2`, 山岳 `🧱+5/✨+2` ※🛡️即時給付は全廃)。",
        "  - **3マス目接続 (3度目)**: 確定マトリクス拡張即時ボーナス獲得 (※🛡️即時ストック給付全廃)。",
        "  - **4マス目完成 (マージ合体)**: 全持続産出 `1.2倍` 増幅 ＋ 即座に `🔥 +1` 給付 (`explorationAllowed: false`)。",
        "",
        "---",
        "",
        "## 🌿 2. ★ ソケット (ボーナス資源) 開花時の毎ターン持続収入一覧 (全17種確定フルマスター)",
        "",
        "初期配置3マス `★` の土地被せ開花、または 2D6 土地探索 (出目 9-11) 成功時に開花する全 17 種類のソケット資源一覧。",
        "",
        "| 5大カテゴリ | プレビュー | 対象地形 (地勢/高度) | 出現アイテム名 | 毎ターンの追加持続収入 (+y/T) |",
        "| :---: | :---: | :--- | :--- | :--- |"
    ])

    socket_name_map = {
        "SOCKET_COW": "牛", "SOCKET_SHEEP": "羊", "SOCKET_DEER": "鹿・猪", "SOCKET_HORSE": "馬",
        "SOCKET_GOAT": "山羊", "SOCKET_CAMEL": "ラクダ", "SOCKET_WILD_WHEAT": "野麦・野生米",
        "SOCKET_BARLEY": "大麦・ライ麦", "SOCKET_APPLES": "林檎・野苺", "SOCKET_DATES": "デーツ",
        "SOCKET_LIMESTONE": "石灰岩", "SOCKET_HEMATITE": "赤鉄鉱", "SOCKET_GRANITE": "花崗岩",
        "SOCKET_IRON_DEPOSIT": "金銀鉱脈", "SOCKET_NITER": "硝石・塩湖", "SOCKET_CEDAR": "杉・楢",
        "SOCKET_GREAT_TREE": "巨木"
    }

    terrain_label_map = {
        "GL1_PLAINS": "🌾 草原 (H1+GL1)", "GL2_FOREST": "🌲 森林 (H1+GL2)",
        "GL3_DEEP_FOREST": "🌳 深林 (H1+GL3)", "H2_HILL": "⛰️ 丘陵 (H2)",
        "H3_MOUNTAIN": "🏔️ 山岳 (H3)", "GL0_DESERT": "🏜️ 砂漠 (GL0)"
    }

    for key, sock_list in sockets.items():
        t_label = terrain_label_map.get(key, key)
        for s in sock_list:
            item_name = socket_name_map.get(s["id"], s["id"])
            lines.append(f"| **{s['category']}** | **`{s['icon']}`** | **{t_label}** | **{item_name}** | {format_socket_yield(s['bonusYields'])} |")

    lines.extend([
        "| **`🌊`** | **全地形** | **清湖 (Lake)** | **清湖 (Lake)** | **`🌾 +2 / T`** (※淡水漁獲 🌾+2/T ＋ 周囲8マス `灌漑バフ +50%` ＆ 敵減衰 `-30%`) |",
        "",
        "---",
        "",
        "## 🌊 3. 水脈ソケット開花 ✕ 💧 清湖 (Lake) ＆ 🌴 オアシス (Oasis) 確定仕様",
        "",
        "1. **🌾 平地 (H1+GL1) 被せ時 ➔ 『💧 清湖 (Lake)』 の発見**: 1×1 平地配置時 `25%` の確率で発見。",
        "2. **🏜️ 砂漠 (H1+GL0) 被せ時 ➔ 『🌴 オアシス (Oasis)』 の発見**: 1×1 砂漠配置時 **`25%` の確率で発見・湧出**（開花時 `🌾+1`）。",
        "",
        "---",
        "",
        "## 🔒 4. 高度 ✕ 気候 二重ギャップ配置制限ルール ＆ マージ探索制限",
        "",
        "* **高度ギャップ制限**: `H1 (平地)` と `H3 (山岳)` は直接面隣接不可。",
        "* **気候ギャップ制限**: `GL0 (砂漠)` と `GL2/GL3 (森・深い森)` は直接面隣接不可。",
        "* **マージ土地探索制限**: `explorationAllowed: false` により、マージ完了土地は 2D6 探索不可。"
    ])

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
    print(f"Successfully generated {output_path} from {json_path}")

if __name__ == "__main__":
    root = os.path.join(os.path.dirname(__file__), "..")
    json_p = os.path.join(root, "game", "src", "data", "land_system.json")
    out_p = os.path.join(root, "rules", "03_land_system", "01_land_base.md")
    generate_docs(json_p, out_p)
