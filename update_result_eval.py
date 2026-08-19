import os

# 1. Update rules/05_trials_and_defense.md
with open('rules/05_trials_and_defense.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_trial = f.read()

eval_text = """

---

## 📊 8. 試練詳細リザルト ✕ 5 段階評価 (S〜D) ＆ 防衛摩耗リソース消費仕様

試練終了時、敵制圧力の削り率および防衛実績に基づく詳細リザルトを表示する。

### 1. 🏆 S〜D (5段階) 評価マトリクス
* **S ランク (100% 削り完封)**: 直撃損害 `🔥 0` / 🛡️ 摩耗 10% (🌾5 / 🧱5 消費) / ボーナス `🔥 +3` ＋ `✨ +20`
* **A ランク (80〜99% 削り)**: 直撃損害 `🔥 0` / 🛡️ 摩耗 25% (🌾15 / 🧱15 消費) / ボーナス `🔥 +1` ＋ `✨ +10`
* **B ランク (60〜79% 削り)**: 直撃損害 `🔥 1〜2` / 🛡️ 摩耗 40% (🌾30 / 🧱30 消費) / ボーナス `✨ +5`
* **C ランク (40〜59% 削り)**: 直撃損害 `🔥 3〜5` / 🛡️ 摩耗 60% (🌾50 / 🧱50 消費) / ボーナスなし
* **D ランク (39% 以下)**: 直撃損害 `🔥 6〜` / 🛡️ 摩耗 80% (🌾80 / 🧱80 / ✨20 消費) / ボーナスなし

### 2. 🛡️ 防衛力の摩耗 (`🛡️` 減衰) ➔ 各種リソース (🌾/🧱/✨) 修復消費メカニクス
- **防衛摩耗**: 敵制圧力を削る際、各土地および拠点の `🛡️`（防衛力）が大きく摩耗（減少）する。
- **リソース自動修復消費**: 試練終了後のリザルト画面にて、削られた `🛡️` の減衰量に応じて、修復・補給コストとして `🌾 食料` ＋ `🧱 資材`（重度時は `✨`）がストックから消費される。
"""

if '試練詳細リザルト ✕ 5 段階評価' not in content_trial:
    content_trial += eval_text

with open('rules/05_trials_and_defense.md', 'w', encoding='utf-8') as f:
    f.write(content_trial)

# 2. Update rules/00_master_handover_specification.md
with open('rules/00_master_handover_specification.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_master = f.read()

eval_summary_master = """

- **📊 試練詳細リザルト ✕ 5 段階評価 (S〜D) ＆ 防衛摩耗仕様**:
  - **S〜D 評価軸**: 敵制圧力の削り率 (%) に応じて S〜D の 5 段階評価。評価が高いほど直撃損害 `🔥` 軽減。
  - **🛡️ 摩耗 ➔ リソース修復消費**: 敵を削った際の `🛡️` 減衰量に応じ、修復コストとして `🌾` ＋ `🧱` （重度時 `✨`）が消費される。
"""

if '試練詳細リザルト ✕ 5 段階評価' not in content_master:
    content_master += eval_summary_master

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content_master)

print("Updated result evaluation specs for branch AG260810 successfully.")
