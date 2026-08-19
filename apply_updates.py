import os

files = [
    'rules/00_master_handover_specification.md',
    'rules/03_land_system/01_land_base.md',
    'rules/03_land_system/03_merge_system.md'
]

for filepath in files:
    content = None
    for enc in ['utf-8', 'cp932', 'shift_jis', 'euc-jp']:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                content = f.read()
            print(f"Successfully read {filepath} with {enc}")
            break
        except Exception:
            continue
    
    if content:
        content = content.replace('王都圏', '本営近郊')
        
        if filepath.endswith('01_land_base.md'):
            summary_block = """

- **🌱 同属性土地接続 ✕ 段階的即時リソースボーナス (確定統合ルール)**:
  - **配置ルールの準拠**: 土地の配置自体は既存の二重ギャップ制限等に 100% 準拠し、何マスでも自由に接続配置可能（「5マス目だから置けない」といった配置制限ストップは一切なし）。
  - **1面接続判定**: 新しく置いた1マスが、既存の同属性グループと「1面 (1マス分)」で繋がった際に接続判定が発動。
  - **自動融合 (Block Fusion)**: 同属性が繋がった瞬間、境界線が消滅し、1個の『1×2』『1×3』『マージブロック』へと自動融合・成長する。
  - **接続ボーナスの 4 マス上限ルール**:
    - **1マス配置 (単体)**: 通常配置 (ボーナスなし)。
    - **2マス目接続 (2度目 / 1×2化)**: 【2度目即時ボーナス (小)】 即時獲得 (例: 草原 `🌾+3`, 丘陵 `🧱+2`, 山岳 `🛡️+2`)。
    - **3マス目接続 (3度目 / 1×3化)**: 【3度目即時ボーナス (倍額)】 即時獲得 (例: 草原 `🌾+6`, 丘陵 `🧱+4`, 山岳 `🛡️+4`)。
    - **4マス目完成 (4度目 / マージ成立)**: 指定4マス形状 (2×2正方形/L字/凸字) 達成で【4マスマージ合体発動！】 (全持続産出 `1.2倍増幅` ＋ 祝儀 `🔥 +1` 給付 ＋ 一枚絵スプライト進化 ＋ 光脈オーラ強調)。
      *(※1×4直線などの非マージ形状で4マス目になった場合は、マージ合体ではなく「即時ボーナス大 (🌾+8/🧱+5)」が給付される)*
    - **5マス目以降の接続**: 接続ボーナス給付は完全終了 (ゼロ)。土地本来の基礎産出 `(GL+H)` のみが通常加算される。
"""
            if '段階的即時リソースボーナス' not in content:
                content = content.replace('## 🧮 1. 1マス基礎産出公式 ＆ 13パターン確定数値マトリクス', '## 🧮 1. 1マス基礎産出公式 ＆ 13パターン確定数値マトリクス' + summary_block)

        if filepath.endswith('03_merge_system.md'):
            content = content.replace('本営近郊マージ禁止', '本営近郊マージの完全許可')
            merge_addition = """

3. **4マスマージ完成祝儀 (🔥 +1 即時回復)**:
   - 4マスマージが完成した瞬間にのみ、マージ完成祝儀として即座に **`🔥 +1`** をスマートに一括給付する（配置コスト `🔥 -1` の回収 ✕ 命の増殖メカニクス）。
4. **持続バフ受給土地の視覚的強調 (バフ視認性 UI)**:
   - マージ1.2倍増幅、本営近郊+1/マス、清湖灌漑+50%等の持続バフを受けた土地ブロックは、光脈オーラ境界線（Border Glow）、微粒子アニメ、バフバッジ表示等により、強化されていることが一目で判別できるよう視覚的強調が施される。
"""
            if '4マスマージ完成祝儀' not in content:
                content = content.replace('## 📐 2. マージの産出計算 ＆ 合体ルール (Line 4445, 4451, 4453)', '## 📐 2. マージの産出計算 ＆ 合体ルール (Line 4445, 4451, 4453)' + merge_addition)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Robust update completed.")
