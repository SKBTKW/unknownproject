# Ember Action Boundary Audit

> **Labels:** [AUDIT] [REFERENCE]

> **Status:** Audit Ledger / Non-Authority
>
> `rules/02_resources_and_ember.md` の採用ルールと、通常Action経路における🔥支払い・🔥0終端のruntime差分を記録する。ゲームルールの正本ではない。

## 1. 採用ルール

現在の正本では、ゲーム中の任意時点で `🔥 = 0` になった場合はラン敗北とする。

`RunTerminationService` は `ember <= 0` を `DEFEAT / EMBER_DEPLETED` として終端でき、`EmberSystem.applyDamage()` はダメージ適用後に `runTerminationService.evaluate()` を呼ぶ。

一方、通常Actionのすべてが同じ終端境界を通るわけではない。

---

## 2. 土地開発🔥コスト

`GameEngine.placeLand()` のValidate段階は、

- Verse内選択済みか
- shape配置が合法か

を確認するが、土地開発🔥コストを支払えるかは検査しない。

その後 `GridEngine.placeShape()` は、

1. 土地セルを配置
2. socket・接続・地帯・連携を処理
3. `getPlacementEmberCost()` でコスト算出
4. `emberSystem.consume(placementCost)` を呼ぶ

という順で進む。

しかし `EmberSystem.consume()` は🔥不足時に `false` を返すだけであり、`GridEngine.placeShape()` はこの戻り値を確認しない。

したがってAction API上は、

> **必要🔥を持っていない土地開発でも盤面変更が成功し、🔥コストだけ支払われない経路が存在する。**

分類: **INTERNAL_CONFLICT / RULES-GAME GAP — affordability validation missing**

---

## 3. 土地開発で🔥0になった場合

`EmberSystem.consume()` は成功時に現在🔥を減算するが、`RunTerminationService.evaluate()` は呼ばない。

そのため、十分な🔥を持っていて土地開発コストを正しく支払い、その結果 `🔥 = 0` になった場合も、そのActionの中では即時敗北終端を確定しない。

分類: **PARTIAL — payment succeeds, immediate defeat boundary not shared**

---

## 4. Commandカード🔥コスト

`DeckManager.playCommandCard()` は発動前に🔥不足を検査するため、土地配置と異なり「不足したまま無料発動」はしない。

ただし支払いは、

```text
state.ember -= cost.ember
```

という直接減算で行い、支払い直後に `RunTerminationService.evaluate()` を呼ばない。

したがって、現在🔥とカード🔥コストが同値の場合、カード効果処理は `🔥 = 0` の状態でも続行する。

分類: **PARTIAL — affordability implemented / immediate defeat boundary missing**

---

## 5. Mulligan🔥コスト

通常UIは `UIController.mulligan()` から `GameEngine.mulligan()` を呼ぶ。

`GameEngine.mulligan()` は、

- `ember < 1` なら拒否
- それ以外は `state.ember -= 1`
- `hasMulliganedThisTurn=true`
- Offering再生成用APIを呼ぶ

という順で進む。

したがって `🔥 = 1` でMulliganした場合、🔥0へ到達した後も同Action内の処理を続行し、`RunTerminationService.evaluate()` は呼ばれない。

なおOffering再生成API自体にも別のruntime不一致があり、詳細は `99_mulligan_runtime_gap_audit.md` を参照する。

分類: **PARTIAL — immediate defeat boundary missing**

---

## 6. 正しく終端評価される既知経路

### Trial / HQ damage

`EmberSystem.applyDamage()` は減算後に `runTerminationService.evaluate({ source: "EMBER_DAMAGE" })` を呼ぶため、🔥0到達時の終端評価がAction内に存在する。

### Verse commit

`TurnLifecycleService` はVerse確定時に `RunTerminationService.evaluate()` を呼ぶため、維持費・自然変動等によって🔥0になった状態はVerse境界で敗北終端へ接続される。

---

## 7. 敗北確定後の通常Action停止

`ActionTransactionManager.execute()` はAction開始時に、

```text
runTermination.terminated
```

を確認し、敗北確定済みなら `RUN_TERMINATED` で拒否する。

したがって、GameEngineのtransaction経由Actionについては、**一度RunTerminationが確定した後の共通Action拒否境界は存在する。**

この点は「敗北確定後もActionが通る」とは扱わない。

現在の問題は、Command🔥支払い・土地開発🔥支払い・Mulligan等が🔥0へ到達した直後に `RunTerminationService.evaluate()` を呼ばず、**敗北確定そのものが次の評価機会まで遅れる**ことである。

分類: **PARTIAL — global reject exists / zero-reaching payment does not immediately create termination**

---

## 8. 現在の結論

現在の🔥終端は、すべての減算経路へ一元化されていない。

| 経路 | 支払い不足拒否 | 🔥0即時終端 |
| :--- | :---: | :---: |
| Trial HQ damage / `applyDamage()` | N/A | あり |
| Verse commit | N/A | あり |
| Command🔥コスト | あり | なし |
| Mulligan🔥1 | あり | なし |
| 土地開発🔥コスト | **なし** | なし |

敗北が一度確定した後は、transaction経由Actionの共通拒否は存在する。

本監査ではgameを変更しない。採用ルールは引き続き「任意時点で🔥0なら敗北」とする。
