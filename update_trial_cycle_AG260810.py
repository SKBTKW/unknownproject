import os

# 1. Update rules/05_trials_and_defense.md
with open('rules/05_trials_and_defense.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_trial = f.read()

trial_cycle_text = """

---

## ⚔️ 7. 試練進行 ✕ 幕間準備 (Into the Breach 風) ＆ Stage 移行確定サイクル

### 1. 🌾 勘違い・唐突感ゼロのプレイヤートリガー方式 (確定仕様)
- ターン開始時の自動開始によるパニックを完全排除。
- Turn 15（例: 第1試練）開始時、画面上に ⚠️「このターン終了時に第1試練襲来！」と強調表示。手札を通常プレイして最終防衛補強を行い、プレイヤーが自らの意思で **`🔘 試練を迎撃する！ (Turn 15 終了)`** ボタンを押すことで試練本番がスタートする。

### 2. 🏆 試練突破後の強調リザルト ＆ 幕間準備フェーズ (Into the Breach 風)
- **試練戦果リザルト画面 (Result Screen)**:
  - 防衛成功時、「第1試練撃破！ [ 評価: S ランク ]」等のリザルト画面が強調表示され、完全防衛ボーナス（`🔥 +3` 即時回復 / `✨ +20` 給付）が進呈される。
- **幕間準備フェーズ (Intermission Phase)**:
  - 『7×7 盤面拡大 ＆ 拠点アンロック』を視覚的に確認し、獲得したリソースで指導者スキルの習得やデッキのカスタマイズをじっくり実施。
  - 準備完了後、**`🔘 第 2 章 (Stage 2) へ進撃！`** ボタンを押す（※ワンクリック 0.6 秒スキップ可で高速テンポも保証）。

### 3. 🚀 Turn 16 開始時の 7×7 盤面一括拡大
- 「第2章へ進撃！」ボタン押下後、Turn 16 開始とともに盤面が 5×5 から 7×7 へ一括拡大し、新領域での開拓がスタートする。
"""

if '試練進行 ✕ 幕間準備 (Into the Breach 風)' not in content_trial:
    content_trial += trial_cycle_text

with open('rules/05_trials_and_defense.md', 'w', encoding='utf-8') as f:
    f.write(content_trial)

# 2. Update rules/00_master_handover_specification.md
with open('rules/00_master_handover_specification.md', 'r', encoding='utf-8', errors='ignore') as f:
    content_master = f.read()

master_trial_summary = """

- **⚔️ 試練進行 ✕ 幕間準備 (Into the Breach 風) 確定サイクル**:
  - **プレイヤートリガー**: Turn 15 では通常通りカードをプレイして最終補強を行い、自らの意思で「試練を迎撃する！」ボタンを押して開始。
  - **強調リザルト ＆ 幕間準備**: 突破時、S/A/B ランク等の評価リザルト画面表示 ➔ Into the Breach 風の幕間準備フェーズ（スキル習得・7×7拡大確認）を経て「第2章へ進撃！」を押す（※ワンクリック0.6秒スキップ可）。
  - **Turn 16 開始時拡大**: Turn 16 開始とともに 7×7 盤面へ一括拡大し新時代スタート。
"""

if '試練進行 ✕ 幕間準備 (Into the Breach 風)' not in content_master:
    content_master += master_trial_summary

with open('rules/00_master_handover_specification.md', 'w', encoding='utf-8') as f:
    f.write(content_master)

print("Updated trial cycle for branch AG260810 successfully.")
