# State Persistence Gap Audit

> **Status:** Audit Ledger / Non-Authority
>
> Chronicle / History Restore が使用する `StateSerializer` と、カード効果stateのruntime保持範囲の差分を記録する。ゲームルールの正本ではない。

## 1. Restore境界

`HistorySnapshotService` は `serializeGameState(state)` をHistory / Restore Pointへ保存する。

`HistoryRestoreService` は新しいGameStateを作らず、既存の `engine.state` にhydrateする。

そのためSerializer対象外fieldはRestore時に過去値へ戻らず、現在値が残り得る。

BuffSystemの表示Buffは別保存されるため、

> **表示Buffは過去へ戻るが、効果判定用GameState fieldは未来値のまま残る**

という分裂が起こり得る。

分類: **INTERNAL_CONFLICT — snapshot coverage gap**

---

## 2. Serializerへ含まれる主なstate

現 `state_serializer_base.js` が保存する代表例:

- `activeConstructionProjects`
- `activeDrawBias`
- `permanentPlainsFoodBonus`
- `permanentVicinityDefenseBonus`
- `emberConsumptionReducedTurns`
- `vigilanceTurns`
- `grandCultivationTurns`
- `systematicLoggingTurns`
- `emergencyLevyTurns`
- `manifestMiracleTurns`
- `reserveFeeWaivedTurns`
- 対応する一部 `startsNextTurn` flag
- `hasPickedThisTurn`
- `hasReservedThisTurn`
- `hasMulliganedThisTurn`

wrapperの `state_serializer.js` は、

- `isGameOver`
- `runTermination`

も追加保存する。

したがって敗北終端state自体はRestore対象。

### retired Trial modifier

以前保存対象だった、

- `nextTrialDamageMitigation`
- `nextTrialMultiplier`

は現在Serializerから削除済み。

診断テストでも「両fieldをserializeしてはならない」と固定されている。

`GameState` 初期fieldは残るが、現在の永続Gameplay契約には含めない。

分類: **LEGACY / retired / non-persistent**

---

## 3. 現役カードで確認できるSerializer対象外state

### Economy / Project

- `granaryCount`
- `sawmillCount`
- `mineCount`
- `stableCount`
- `limeKilnCount`
- `marketCount`
- `depotCount`
- `irrigationCount`
- `workshopCount`
- `granaryNetworkActive`
- `industrialRoadActive`
- `irrigationNetworkActive`
- `industrialClusterActive`
- `resettlementFoodBonus`

多くは効果consumer自体も未接続だが、Restore完全性という別問題を持つ。

### Mystic / Offering manipulation

- `fillTheVoidTurns`
- `voiceBeneathEarthTurns`
- `revelationChoiceTurns`
- `leylineResonanceActive`
- `twoFuturesTurns`

一部はconsumer / expirationも未接続。

### Rationing

- `foodCostHalvedTurns`
- `foodCostRationingActive`
- `foodCostRationingDiscount`

Maintenance実効値は `foodCostHalvedTurns` を読むが、このfieldはSerializer対象外。

したがって《配給》有効状態へRestoreした場合、表示Buffと実維持費効果が一致しない可能性がある。

---

## 4. retired Trial予約flagについて

以下の旧Trial予約カード群は現在 `CardCycleSystem` でretired固定され、通常Offeringへ戻らない。

Mud Obstacle / High Ground Formation / Cavalry Scouts / Outpost Signal / Ballista Set / Guided Defense / Scout Enemy / Scorched Retreat / Cavalry Host / Local Iron Armament / Omen Dream / Stone Strongpoint / Great Rampart Project / Outpost

これら由来の旧flagがSerializer対象外であっても、現在は**現役カードのRestore欠陥として数えない。**

コード内に残る旧stateは **LEGACY残存**として別管理する。

---

## 5. 実効影響が明確な例 — 《配給》

Maintenance resolverは `foodCostHalvedTurns > 0` を実効条件とする。

しかしHistory snapshotはBuff表示を保存しても `foodCostHalvedTurns` を保存しない。

したがってRestore後に、

- Buff表示は有効
- 実維持費軽減は無効

または逆方向の不整合が起こり得る。

---

## 6. wood / material

Serializerは `wood` を保存し、hydrate後に `material = wood` へ同期する。

したがって二重名は残るが、Restore境界では `wood` を正として収束する。

---

## 7. 現在の結論

History / Chronicle Restoreは盤面・主要資源・RunTermination・一部カードstate・Buff表示を復元できるが、**現役カード効果state全体を完全にはserializeしていない。**

一方、retired Trial予約カードの旧stateは現役Persistence要件から分離して扱う。

本監査ではgameを変更しない。
