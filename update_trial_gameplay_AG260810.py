import os

# 1. Update rules/05_trials_and_defense.md
with open('rules/05_trials_and_defense.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_trial = f.read()

gameplay_text = """

### 4. 🧭 初回第 1 試練 (Turn 15) 限定インタラクティブチュートリアル仕様
- **画面ハイライト導線**: 初回試練時、長文テキストではなく UI の点滅ハイライトにより「① 敵侵攻軸 ➔ ② 迎撃ポイント指定 ➔ ③ 試練開始ボタン」の 3 ステップを順に視覚ガイドする。
- **初回限定世界観演出**: 第 1 試練開始時、初回プレイ限定で **「── 人類初の大規模襲撃。そして、人類初の組織的抵抗が始まる。」** の 1 行シネマティック表示を挿入する（※2周目以降は自動スキップ）。
- **制圧力公式準拠**: 第 1 試練の敵制圧力は例外を設けず、確定公式 `本営防衛力 + (累計産出 × 30%)` に 100% 従い算出される（指揮官は `Lv.1 千人長`）。

### 5. 💡 プレイスタイル別 4 大試練解決メソッド (プレイヤー優位設計)
- **設計方針**: 単一の最適解を強いるのではなく、プレイヤーがプレイスタイルに応じて有利な解決策を模索できる 4 大ビルド軸（①要塞化 🛡️ / ②神聖奇跡 ✨ / ③物量修復 🌾🧱 / ④水脈減衰 🌊）を提示する。

### 6. ⚖️ 試練の難易度・緊張感調整方針 (サバイバルテンション)
- **楽勝化の防止**: 多彩な解決メソッドを提示しつつも、敵制圧力の追従スケーリングと `🛡️` 摩耗修復コストにより「油断すると `🔥` が削られる適度なサバイバルの緊張感」を維持する。
- **ストレス緩和構造**: 一発即死の盤面詰みを排除し、`🔥`（命の残量）によるクッション構造で「ギリギリ耐えて内政で巻き返す」ゲーム手触りを死守する。
"""

if '初回第 1 試練 (Turn 15) 限定インタラクティブチュートリアル仕様' not in content_trial:
    content_trial += gameplay_text

with open('rules/05_trials_and_defense.md', 'w', encoding='utf-8') as f:
    f.write(content_trial)

# 2. Update rules/00_master_handover_specification.md
with open('rules/00_master_handover_specification.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_master = f.read()

master_gameplay_summary = """

- **🧭 試練チュートリアル ✕ 4大解決メソッド ✕ 緊張感調整方針**:
  - **チュートリアル**: 第1試練(T15)はUI点滅3ステップガイド ＋ 初回限定1行世界観演出。制圧力は公式準拠。
  - **4大解決メソッド**: ①要塞化 🛡️ / ②神聖奇跡 ✨ / ③物量修復 🌾🧱 / ④水脈減衰 🌊 の4大ビルド軸。
  - **緊張感調整**: 楽勝化を防止しつつ、`🔥` 残り火クッション構造で過度な詰みストレスを緩和。
"""

if '試練チュートリアル ✕ 4大解決メソッド' not in content_master:
    content_master += master_gameplay_summary

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content_master)

print("Updated trial gameplay and tutorial specs on AG260810 successfully.")
