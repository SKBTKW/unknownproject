# Mulligan Runtime Gap Audit

> **Labels:** [AUDIT] [REFERENCE]

> **Status:** Audit Ledger / Non-Authority
>
> Offering正本は `04_draw_and_hand_system.md`。本書はMulliganの通常UI経路とDeckManager内部APIの不一致を記録する。

## 1. 採用ルール

Mulliganは、

- 1 Verseにつき最大1回
- 通常選択確定後は不可
- 🔥1を支払う
- Offering全体を引き直す

ものとする。

---

## 2. DeckManager側

`DeckManager.mulligan()` は、

1. 使用可否を検査
2. 🔥1を消費
3. `hasMulliganedThisTurn=true`
4. `generateOfferingCards()` を実行

する。

この内部メソッド単体では「🔥1を払いOfferingを再生成する」というMulliganの骨格が存在する。

---

## 3. 通常UI経路

通常UIの `UIController.mulligan()` / Mulliganボタンは `GameEngine.mulligan()` を呼ぶ。

`GameEngine.mulligan()` は、

1. ActionTransactionManager経由でMulliganを開始
2. 🔥1を直接減算
3. `hasMulliganedThisTurn=true`
4. `deckManager.drawOffering()` があれば呼ぶ
5. なければ `state.drawOffering()` があれば呼ぶ

という処理を持つ。

しかし現 `DeckManager` の正式なOffering再生成APIは `generateOfferingCards()` であり、`drawOffering()` は確認できない。

現 `GameState` にも `drawOffering()` は確認できない。

したがって通常UI経路では、

> **🔥1とMulligan使用権だけ消費し、Offeringを再生成しないままsuccessを返す経路が成立する。**

分類: **INTERNAL_CONFLICT / RULES-GAME GAP**

---

## 4. 二重実装

現在は同じMulligan概念について、

```text
DeckManager.mulligan()
  → generateOfferingCards()
  → 再抽選あり

GameEngine.mulligan()
  → drawOffering() を探す
  → 現API名と不一致
```

という二重実装が存在する。

通常UIが後者を使用するため、「DeckManager側に動くMulliganがある」ことは通常プレイでMulliganが動く根拠にならない。

---

## 5. 🔥0との関係

`GameEngine.mulligan()` は `🔥 >= 1` なら実行でき、🔥1から0へ減算しても同Action内では `RunTerminationService.evaluate()` を呼ばない。

このためMulliganには、

- Offering再生成API不一致
- 🔥0即時敗北境界未接続

の2つの独立した問題がある。

🔥終端については `99_ember_action_boundary_audit.md` を参照する。

本監査ではgameを変更しない。
