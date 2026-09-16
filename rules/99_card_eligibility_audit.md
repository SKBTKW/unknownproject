# 99. Card Eligibility Audit

> **Status:** Audit / Non-Authority
>
> 現行カードmasterに存在し、通常Offeringへ到達し得るカードの条件キーと `DeckManager.isCardEligible()` の対応状況を監査する。

## 1. 分類

| 分類 | 意味 |
| :--- | :--- |
| **SUPPORTED** | runtimeが条件を明示評価する。 |
| **UNSUPPORTED** | データにあるが対応処理を確認できない。 |
| **SEMANTIC_MISMATCH** | キーは読むが意味が一致しない。 |
| **KEY_MISMATCH** | データ側とruntime側でキー名が違う。 |
| **INTERNAL_CONFLICT** | 同じ条件を複数経路で異なる意味に扱う。 |

---

## 2. Land Cards

| データキー | 分類 | runtime |
| :--- | :---: | :--- |
| `minStage` | **SUPPORTED** | Stage条件を評価。 |
| `reqE2` | **KEY_MISMATCH** | 山岳カードは `reqE2:3`、Eligibility側は `reqE2HillsOnBoard` を見る。 |

さらに `countE2HillsOnBoard()` は `terrain.id === "E2_HILL"` を見る一方、通常配置カードは `terrainId:"E2_HILL"` を持つため、キー名だけ直しても丘陵数を正しく数えない可能性がある。

山岳カードは丘陵条件を無視してOfferingへ出現し、配置側の高度差制約により合法配置先を持たない死に札になり得る。

---

## 3. Economy Cards

### SUPPORTED

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

| キー | 主な現役カード |
| :--- | :--- |
| `reqMinLinks` | `CMD_MARKET` |
| `reqIndustrySpecialBlocks` | `CMD_DEPOT`, `CMD_INDUSTRIAL_ROAD` |
| `reqDistinctPrimaryIndustries` | `CMD_WORKSHOP` |
| `reqGranaries` | `CMD_GRANARY_NETWORK` |
| `reqIrrigationDone` | `CMD_IRRIGATION_NETWORK` |
| `reqLinkedDistinctIndustries` | `CMD_INDUSTRIAL_CLUSTER` |
| `reqPlainsOrReclaimed` | `CMD_IRRIGATION` |

### SEMANTIC_MISMATCH

| キー | 現runtime |
| :--- | :--- |
| `reqConnectedPlainsOrReclaimed` | 連結成分ではなく盤面全体の平地＋干拓地合計。 |
| `reqForestNearby` | 近接ではなく盤面全体の森系マス数。 |
| `reqLoggingCamp` | 伐採拠点がなくても森1マスで成立し得る。 |

---

## 4. Military Cards — 現役masterのみ

現 `military_cards.json` に存在するのは3枚。

- `CMD_VIGILANCE`
- `CMD_MILITARY_FOCUS`
- `CMD_IRON_RAMPART`

現役masterで使用される主要条件:

- `minStage`
- `reqTrialOrLowDefense`
- `maxDefense`
- `reqWood`

これらは今回の監査範囲では対応処理あり。

以前ここへ含めていた、

- `reqWetlandOrLake`
- `reqTrialNotice`
- `reqDiscoveredResourceTag`
- `reqPlains`
- `reqOutpostOrHighGround`
- `reqHillOrMountain`
- `reqConnectedHillOrForest`
- `reqTrialWithin`
- `reqConnectedPlains`
- `reqFood`

等の多くはretired Trial予約カード由来であり、**現役軍事Eligibility監査から除外する。**

### Military Focus境界値

データの `maxDefense:20` はEligibility側で20ちょうどを許可する一方、発動後の終了条件は最大🛡️20以上。

そのため最大🛡️=20では候補化・発動後に即解除される。

---

## 5. Mystic Cards — 現役masterのみ

現 `mystic_cards.json` の主要条件:

- `minStage`
- `maxMystic`
- `reqMystic`
- `reqDiscoveredResourcesCount`
- `maxEmber`
- `reqUnmergedDesertOrMountain`
- `reqDiscoveredMysticResourcesCount`

これらは今回の監査範囲では対応処理あり。

以前含めていた `reqTrialWithin` はretired化された `CMD_OMEN_DREAM` 由来なので、現役神秘Eligibility要件から除外する。

---

## 6. retiredカード条件の扱い

`CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` に含まれるカードは、定義や旧条件処理が残っていても通常Offeringへ戻らない。

したがってretiredカードだけが使用する条件キーを、現役カードシステムの未完成要件として数えない。

分類: **LEGACY / RETIRED**

---

## 7. `maxPlacedBlocks` 潜在不一致

`DeckManager.isCardEligible()` 内には `maxPlacedBlocks` 評価が複数系統ある。

- `countPlacedTiles()` を見る経路
- `placedBlocksCount` / `placedCards.length` を見る経路

一方、現GameStateの正式fieldは `placedBlockCount`。

現役主要masterでの実利用は確認できていないため、**潜在INTERNAL_CONFLICT**として保留する。

---

## 8. Draw BiasはEligibilityとは別

Draw Biasは、

```text
card.category === activeDrawBias.targetCategory
```

の完全一致。

- Military Focus → `MILITARY`のみ
- Mystic Focus → `MYSTIC`のみ

テーマ上は軍事/神秘でも `COMMAND` categoryなら対象外。

---

## 9. 結論

Eligibility監査では常に、

1. 現masterに存在するか
2. CardCycleでretiredされていないか
3. 条件キーをruntimeが読むか
4. キー名どおりの意味で判定するか

を分けて確認する。

**旧カードの条件処理が残っていることを、現役Offering仕様の根拠にしない。**
