# 99. Card Eligibility Audit

> **Status:** Audit / Non-Authority
>
> 本文書は、現行カードマスターに存在する Offering 条件キーと `DeckManager.isCardEligible()` の対応状況を監査するための非正本文書である。
> ゲームルールの正解は `04_draw_and_hand_system.md` および `09_cards/` を参照する。
>
> 目的は、**カードデータに条件キーが存在すること**と、**runtimeでその条件が意味どおり評価されていること**を混同しないこと。

---

## 1. 分類

| 分類 | 意味 |
| :--- | :--- |
| **SUPPORTED** | 現 `DeckManager.isCardEligible()` が条件を明示的に評価する。 |
| **UNSUPPORTED** | 現カードデータに存在するが、Eligibility側に対応処理を確認できない。 |
| **SEMANTIC_MISMATCH** | キー自体は評価されるが、名前・データ意図と実判定の意味が一致しない。 |
| **KEY_MISMATCH** | データ側とEligibility側でキー名が一致せず、意図した条件が接続されない。 |
| **INTERNAL_CONFLICT** | 同一条件を複数経路で異なる意味で評価する。 |

---

## 2. Land Cards

### 現在確認済み

| データキー | 分類 | runtime |
| :--- | :---: | :--- |
| `minStage` | **SUPPORTED** | `cardStage > stageNum` なら除外。 |
| `reqE2` | **KEY_MISMATCH** | 山岳カードは `reqE2:3` を持つが、Eligibility側が見るのは `reqE2HillsOnBoard`。`reqE2` の正規化/参照を確認できない。 |

### 影響

山岳カード3種はデータ上「丘陵3マス」を前提としているが、現runtimeではその条件がOfferingへ接続されていない。

---

## 3. Economy Cards

### SUPPORTED

以下は現 `DeckManager.isCardEligible()` で明示的に評価される。

- `minStage`
- `reqWood`
- `reqFood`
- `reqPlains`
- `reqWetland`
- `reqDiscoveredResourceTag`
- `reqDiscoveredResourceTags`
- `reqEmptyCells`
- `reqFoodDeficitOrFallback`
- `reqWoodDeficit`
- `reqHill`
- `reqOreSocket`
- `reqWaterSource`
- `reqPlainsMerge2x2`
- `reqLargeTerritory`

### UNSUPPORTED

現カードデータに存在するが、Eligibility側の対応処理を確認できない。

| キー | 主なカード |
| :--- | :--- |
| `reqMinLinks` | `CMD_MARKET` |
| `reqIndustrySpecialBlocks` | `CMD_DEPOT`, `CMD_INDUSTRIAL_ROAD` |
| `reqDistinctPrimaryIndustries` | `CMD_WORKSHOP` |
| `reqGranaries` | `CMD_GRANARY_NETWORK` |
| `reqIrrigationDone` | `CMD_IRRIGATION_NETWORK` |
| `reqLinkedDistinctIndustries` | `CMD_INDUSTRIAL_CLUSTER` |
| `reqPlainsOrReclaimed` | `CMD_IRRIGATION` |

これらは未評価なので、他の条件だけを満たせば想定より早くOfferingへ出現し得る。

### SEMANTIC_MISMATCH

| キー | 現データ上の意味 | 現runtime判定 |
| :--- | :--- | :--- |
| `reqConnectedPlainsOrReclaimed` | 連結した平地/干拓地 | 連結成分を探索せず、盤面全体の平地＋干拓地を単純合計。 |
| `reqForestNearby` | 近隣の森 | 対象位置を持たず、盤面全体の森系マス数を集計。 |
| `reqLoggingCamp` | 伐採拠点の存在 | 伐採拠点Buffがなくても、盤面に森が1マスあれば成立。 |

---

## 4. Military Cards

現 `military_cards.json` / `command_cards_data.js` で使用される主要Eligibilityキーについては、今回の監査範囲では対応処理を確認できた。

- `minStage`
- `reqTrialOrLowDefense`
- `reqWetlandOrLake`
- `reqTrialNotice`
- `maxDefense`
- `reqDiscoveredResourceTag`
- `reqPlains`
- `reqOutpostOrHighGround`
- `reqWood`
- `reqHillOrMountain`
- `reqConnectedHillOrForest`
- `reqTrialWithin`
- `reqConnectedPlains`
- `reqFood`

したがって、軍事カードの主要な未完成点はEligibilityより、**発動後のTrial効果消費側**に集中している。

別途、`CMD_MILITARY_FOCUS` のDraw Biasはテーマ上の軍事カード全体ではなく、`category:"MILITARY"` のカードだけを×2する。これはEligibilityではなくWeight/Category側の内部不一致として扱う。

---

## 5. Mystic Cards

現 `mystic_cards.json` / `command_cards_data.js` で使用される主要Eligibilityキーについては、今回の監査範囲では対応処理を確認できた。

- `minStage`
- `maxMystic`
- `reqMystic`
- `reqDiscoveredResourcesCount`
- `reqTrialWithin`
- `maxEmber`
- `reqUnmergedDesertOrMountain`
- `reqDiscoveredMysticResourcesCount`

したがって、神秘カードの主要な未完成点はEligibilityより、**発動後のコスト代替 / Offering操作 / 情報解像度の消費側**に集中している。

別途、`CMD_MYSTIC_FOCUS` のDraw Biasはテーマ上の神秘カード全体ではなく、`category:"MYSTIC"` のカードだけを×2する。

---

## 6. Eligibility実装内の潜在的不一致

### `maxPlacedBlocks`

`DeckManager.isCardEligible()` 内には `maxPlacedBlocks` を評価する処理が二系統ある。

1. 前半: `state.countPlacedTiles()` を使用する。
2. 後半: `ConditionEvaluator.PLACED_BLOCKS_AT_MOST` を使用する。

後者は `state.placedBlocksCount` または `state.placedCards.length` を参照するが、現 `GameState` の正式な開発ブロック数stateは `placedBlockCount`（単数）である。

したがって同じ `maxPlacedBlocks` という名前に対して、

- マス数
- 別名のブロック数state

が混在している。

現行主要カードマスターでの実利用は今回確認できていないため、現在のプレイヤー挙動への影響は確定扱いせず、**潜在的なINTERNAL_CONFLICT**として記録する。

---

## 7. Draw BiasはEligibilityとは別

現 `DeckManager.drawSingleCard()` のDraw Biasは、

```text
card.category === activeDrawBias.targetCategory
```

の完全一致で対象を決める。

したがって、

- `MILITARY` Bias → `category:"MILITARY"` のみ
- `MYSTIC` Bias → `category:"MYSTIC"` のみ
- テーマ上は軍事/神秘でも `category:"COMMAND"` のカードは対象外

となる。

このためカードテーマ・tags・rules上の分類語とruntime `category` を同一視しない。

---

## 8. 監査結論

現カードシステムでは、

> **カードマスターに条件やカテゴリが書かれている = その意味どおりOffering runtimeへ接続済み**

とは限らない。

今回確認された主なパターンは以下。

1. 条件キーそのものが未対応。
2. データとEligibilityでキー名が違う。
3. 条件名と実際の判定意味が違う。
4. テーマ上のカテゴリとruntime `category` が違う。
5. 条件判定が複数系統に重複している。

この文書は監査結果の索引であり、新しいゲーム仕様を定義しない。
