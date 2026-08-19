with open('rules/00_master_handover_specification.md', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

surround_summary = """
- **🌟 周囲 8 マス包囲 ✕ 中央穴埋めボーナス 確定仕様**:
  - 未配置 1 マスの周囲 8 マス（3×3 領域）を土地で包囲し、最後の中央 1 マスを埋めた時に発動。
  - **パターン A (通常マス)**: 恒常ボーナス **`✨ +10 / T`** ＋ 穴埋め祝儀 **`🔥 +2`** 即時回復。
  - **パターン B (★ソケット埋め)**: **`25%`** の確率で 『🌴 オアシス (Oasis)』 (産出昇華 `🌾+3/T` ＋ `✨+5/T` ＋ 祝儀 `🔥+3`) へ昇華開花！ (※25%外時は通常ソケット＋`✨+10/T`給付)。
  - **パターン C (全9マス同属性統一)**: 上記に加え、全持続産出 **`1.3倍`** 超増幅 ＋ 一枚絵『3×3 巨大都心スプライト』進化。
"""

if '周囲 8 マス包囲 ✕ 中央穴埋めボーナス 確定仕様' not in content:
    content += "\n" + surround_summary

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Master handover spec updated for surround bonus.")
