# Land Undo State Gap Audit

> **Status:** Audit Ledger / Non-Authority
>
> 土地配置Undoのsnapshot範囲と、土地配置から派生して変化するGameState / Buff状態の差分を記録する。ゲームルールの正本ではない。

## 1. 現在のUndo境界

`UndoLandSystem.captureSnapshot()` は土地配置前に主に以下を保存する。

- 主要資源
- grid
- merge / link
- Offering / Hold
- Card cooldown / UNIQUE消費
- current / max defense
- `hasPickedThisTurn`, `hasReservedThisTurn`
- `placedBlockCount`
- CheckSystem state

一方、以下はsnapshot対象ではない。

- `activeDrawBias`
- BuffSystemの `buffs`
- 多数のカード専用state

`UndoLandSystem.undo()` もこれらを復元しない。

---

## 2. 現役《Military Focus》との不一致

`CMD_MILITARY_FOCUS` は現 `COMMAND_CARDS_MASTER` に存在し、

```text
activeDrawBias = {
  targetCategory: "MILITARY",
  type: "UNTIL_DEFENSE",
  untilValue: 20
}
```

を設定する。

`GameState.checkConditionalBuffs()` は最大🛡️が20以上になると、

- `activeDrawBias = null`
- `CMD_MILITARY_FOCUS` Buff削除

を行う。

土地配置成功後、`GridEngine.placeShape()` はDefense reconcileの後に `checkConditionalBuffs()` を呼ぶ。

したがって、

```text
Military Focus有効
→ 土地配置で最大🛡️が20以上へ到達
→ Focus解除
→ その土地配置をUndo
```

という経路が成立する。

Undoによって盤面・防衛値は配置前へ戻るが、Undo snapshotに `activeDrawBias` / BuffSystemが含まれないため、**解除されたMilitary Focusは配置前状態へ復元されない。**

分類: **INTERNAL_CONFLICT — land rollback does not restore derived card state**

---

## 3. 一般化できる境界

土地配置は盤面だけでなく、

- 地帯 / 連携
- 防衛max
- 条件付きBuff解除
- UNIQUE消費
- socket発見

等を派生させる。

現Undoは盤面・資源・一部カード状態を戻すが、全派生stateを一つのsnapshot契約で復元しているわけではない。

現時点で実プレイ影響まで確認できた代表例は《Military Focus》解除である。

本監査ではgameを変更しない。
