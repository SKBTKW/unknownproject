# State Persistence Gap Audit

> **Status:** Audit Ledger / Non-Authority
>
> Chronicle / History Restore が使用する `StateSerializer` と、カード・Trial準備stateのruntime保持範囲の差分を記録する。ゲームルールの正本ではない。

## 1. Restore境界

`HistorySnapshotService` は `serializeGameState(state)` をHistory / Restore Pointへ保存する。

`HistoryRestoreService` は新しいGameStateを作り直さず、既存の `engine.state` に `hydrateGameState()` を適用する。

`hydrateGameState_base` はSerializerに含まれるfieldだけを上書きする。

したがって、Serializer対象外のfieldはRestore時に過去値へ戻らず、**Restore操作時点の現在値がそのまま残り得る。**

一方、BuffSystemの `buffs` 配列はHistorySnapshot runtimeへ別保存され、Restore時に過去snapshotへ戻される。

そのため、

> **表示Buffは過去へ戻るが、そのBuffが依存する専用GameState fieldは未来の値のまま残る / 過去値へ復元されない**

という分裂が起こり得る。

分類: **INTERNAL_CONFLICT — snapshot coverage gap**

---

## 2. Serializerへ含まれる主なカードstate

現 `state_serializer_base.js` で明示的に保存される例:

- `nextTrialDamageMitigation`
- `nextTrialMultiplier`
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

これらは少なくともHistory snapshotのGameState payloadへ含まれる。

---

## 3. 現役カードで確認できるSerializer対象外state

以下は現行カード分岐が書き込む一方、現 `state_serializer_base.js` のserialized payload / hydrate field一覧に含まれないことを確認した代表例。

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
- `greatRampartTurns`
- `greatRampartActive`
- `resettlementFoodBonus`

多くは効果consumer自体が未接続だが、Restore完全性という別問題も持つ。

### Military / Trial preparation

- `mudObstacleActive`
- `highGroundFormationActive`
- `guidedDefenseActive`
- `cavalryScoutsActive`
- `cavalryHostActive`
- `localIronArmamentActive`
- `stoneStrongpointActive`
- `outpostSignalActive`
- `scoutEnemyActive`
- `scorchedRetreatTurns`

これらはTrial側consumerが未接続という問題に加え、History Restoreでも過去状態を再現できない。

### Mystic / Offering manipulation

- `fillTheVoidTurns`
- `voiceBeneathEarthTurns`
- `omenDreamActive`
- `revelationChoiceTurns`
- `leylineResonanceActive`
- `twoFuturesTurns`

これらの一部はconsumer / expirationも未接続であり、Serializer omissionと組み合わさることで状態再現性がさらに低い。

### Rationing

- `foodCostHalvedTurns`
- `foodCostRationingActive`
- `foodCostRationingDiscount`

現在のMaintenance実効値は `foodCostHalvedTurns` を読むが、このfieldはSerializer対象外。

したがって《配給》が有効なVerse開始点へHistory Restoreした場合でも、Buff表示と実維持費軽減stateが一致しない可能性がある。

---

## 4. 特に実効影響が明確な例

### 《配給》

Maintenance resolverは `foodCostHalvedTurns > 0` を実効条件とする。

しかしHistory snapshotはBuff配列を保存しても `foodCostHalvedTurns` を保存しない。

したがってRestore後、

- Buff表示は《配給》有効
- 実維持費は50%軽減されない

またはRestore方向によってはその逆、という状態が成立し得る。

### Trial準備flag

軍事カードflag群は通常GameStateへ立つもののTrialへの正式受け渡し自体が未接続である。

さらにHistory Restoreでも過去値へ戻らないため、将来Trial consumerを接続する際にRestore境界も同時に監査対象となる。

---

## 5. wood / material

資材についてはSerializerが `wood` を保存し、hydrate後に明示的に

```text
state.material = state.wood
```

へ同期する。

したがって `wood / material` の二重名は残るが、History Restore境界では `wood` を正として収束させる処理が存在する。

現監査ではこの点単独をRestore不整合とは分類しない。

---

## 6. 現在の結論

History / Chronicle Restoreは盤面・主要資源・一部カードstate・Buff表示を復元できるが、**カード効果GameState全体を完全にはserializeしていない。**

特に「Buff配列は保存されるが、その効果判定用fieldが保存されない」カードはPresentationとruntime effectが分離し得る。

本監査ではgameを変更しない。
