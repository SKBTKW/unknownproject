# 09-2. 経済・政策カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial / Planned
>
> カードの候補化データは `game/src/data/economy_cards.json` および生成済み `command_cards_data.js` に存在する。
> ただし、カードがOfferingへ存在することと、説明どおりの最終効果がゲームシステムへ接続済みであることは別とする。

---

## 1. 設計原則

> 土地カードが「どんな大地を得るか」を決め、経済・政策カードは「その大地をどう利用するか」を決める。

この方向性は維持する。

Offering条件・Weight・コストは実装データを現在値の正本とし、本文書では主に**実装完成度**を管理する。

### 状態ラベル

- **Implemented**: 発動結果が現在の主要システムへ接続され、実ゲーム上の効果を持つ。
- **Partial**: カード・コスト・条件・発動分岐はあるが、記述された効果の一部が未接続。
- **Planned**: データ/設計のみ、またはフラグだけで実効処理が未完成。
- **Legacy**: 現行方針と合わず整理対象。

---

## 2. Stage 1

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_RATIONING` | **Implemented** | 食料維持費軽減。現在resolverは `foodCostHalvedTurns` を見て**基本維持費を50%**にする。旧rulesの「40%軽減」と不一致。 |
| `CMD_WETLAND_RECLAMATION` | **Implemented** | 🧱15＋🔥1。湖でない未地帯化湿原1マスを `E1_RECLAIMED_LAND` へ永久変換し、変換後に地帯化/連携再判定。 |
| `CMD_LOGGING_CAMP` | **Partial / Eligibility different** | 🔥1、即時🧱+8は実装。周囲森林からの継続産出は現ProductionCalculatorへ未接続。データの `reqForestNearby:3` は「近隣」判定ではなく、現Eligibilityでは盤面全体の森系マス数を単純集計する。 |
| `CMD_GRANARY` | **Partial** | 🧱20、`granaryCount` は増えるが、現在のMaintenance resolverは `granaryCount` を参照しない。維持費×0.90は未接続。 |
| `CMD_AGRICULTURAL_REFORM` | **Implemented / Simplified / Eligibility different** | 🧱20、`permanentPlainsFoodBonus +1`。現実装では指定4マスではなく**全平地系への恒久+1/Verse**として処理される。またデータの `reqConnectedPlainsOrReclaimed:3` に対し、Eligibility実装は連結判定をせず、盤面全体の平地＋干拓地を単純合計して3マス以上なら通す。 |
| `CMD_PASTORAL_FARM` | **Partial** | 🧱15、現実装は即時🌾+2とBuff登録。牧畜場化・周囲平地による持続産出は未接続。 |
| `CMD_ABANDONED_SETTLEMENT` | **Implemented** | 🔥1、2D6。現在値は 2–5:🌾+15 / 6–8:🧱+15 / 9–11:✨+10 / 12:🌾+20🧱+20✨+15。旧土地探索表は使わない。 |
| `CMD_EMERGENCY_LEVY` | **Implemented** | 🌾20を支払い、即時🧱+15。旧「次Verse維持費+5」ペナルティは現発動分岐では設定しない。 |

---

## 3. Stage 2

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_SAWMILL` | **Partial / Eligibility different** | 🧱25、`sawmillCount` とBuff登録のみ。森林由来産出×1.5は主要産出計算へ未接続。データの `reqLoggingCamp:1` に対し、現Eligibilityは伐採拠点そのものを厳密に要求せず、盤面に森が1マスでもあれば条件を通す。 |
| `CMD_QUARRY` | **Partial** | 🧱20、即時🧱+10は実装。周囲丘陵/山岳の継続産出は未接続。 |
| `CMD_MINE` | **Partial** | 🧱25、`mineCount` 登録。鉱物socket産出×1.5は未接続。 |
| `CMD_STABLE` | **Partial** | 🧱20、`stableCount` 登録。騎馬カードWeight/コスト軽減は実効処理未確認・未接続扱い。 |
| `CMD_LIME_KILN` | **Partial** | 🌾10＋🧱15、`limeKilnCount` 登録。建設コスト軽減は未接続。 |
| `CMD_MARKET` | **Partial / Eligibility gap** | 🧱25、`marketCount` 登録。持続産出は未接続。データには `reqMinLinks:2` があるが、現 `DeckManager.isCardEligible()` は `reqMinLinks` を評価しないため、2連携条件もOffering抽選へ未接続。 |
| `CMD_DEPOT` | **Partial / Eligibility gap** | 🧱30、`depotCount` 登録。PROJECTコスト軽減は未接続。データの `reqIndustrySpecialBlocks:2` は現Eligibilityで評価されない。 |
| `CMD_IRRIGATION` | **Partial / Eligibility gap** | 🧱20、`irrigationCount` 登録。対象農地への恒久🌾+1/Verseは未接続。既存の水源灌漑+50%とは別。`reqWaterSource` は評価されるが、データの `reqPlainsOrReclaimed:1` は現Eligibilityで評価されないため、平地/干拓地条件は未接続。 |
| `CMD_RESETTLEMENT` | **Partial** | 🌾15＋🧱10、即時🔥+2は実装。指定平地地帯への🌾+2/Verseは未接続。 |
| `CMD_WORKSHOP` | **Partial / Eligibility gap** | 🧱30、`workshopCount` 登録。SPECIAL_BLOCKコスト軽減は未接続。データの `reqDistinctPrimaryIndustries:2` は現Eligibilityで評価されない。 |

---

## 4. Stage 3 大規模事業

以下はカードデータ・発動分岐・永続フラグ/Buffの骨格は存在するが、完成した国家事業効果としては未接続部分が大きい。

| ID | 状態 | 現在 |
| :--- | :---: | :--- |
| `CMD_GRANARY_NETWORK` | **Planned / Partial / Eligibility gap** | UNIQUE。永続状態を立てる骨格あり。データの `reqGranaries:2` は現 `DeckManager.isCardEligible()` で評価されない。 |
| `CMD_INDUSTRIAL_ROAD` | **Planned / Partial / Eligibility gap** | `industrialRoadActive=true` とBuff登録までは実装。ただし盤面セル/辺としての道路、移動コスト、産業拠点+20%、Trial route誘導のいずれも実装確認できない。データの `reqIndustrySpecialBlocks:2` も現Eligibilityで未評価。 |
| `CMD_IRRIGATION_NETWORK` | **Planned / Partial / Eligibility gap** | `irrigationNetworkActive` 等の状態は持てるが、最大8農地強化は未接続。`reqWaterSource` は評価されるが、データの `reqIrrigationDone` は現Eligibilityで評価されない。 |
| `CMD_INDUSTRIAL_CLUSTER` | **Planned / Partial / Eligibility gap** | `industrialClusterActive` を立てるが、PROJECTコスト軽減は未接続。データの `reqLinkedDistinctIndustries:3` は現Eligibilityで評価されない。 |
| `CMD_GREAT_RAMPART_PROJECT` | **Partial / Duplicate branch conflict** | 現masterのカードIDと発動分岐は存在するが、`playCommandCard()` 内に同一ID分岐が2回ある。先行分岐が `greatRampartTurns=4` を設定するため、後段の `greatRampartActive=true` 分岐は到達不能。`greatRampartTurns` の実効consumerも確認できず、現行大防塁効果は未接続。`reqLargeTerritory` と資材条件はEligibilityで評価される。 |

### 《大防塁》duplicate branch conflict

`DeckManager.playCommandCard()` の同一 `else-if` チェーン内に `CMD_GREAT_RAMPART_PROJECT` が2回存在する。

先に一致する分岐は、

```text
greatRampartTurns = 4
+ Buff登録
```

を行う。

後段には、

```text
greatRampartActive = true
+ PERMANENT Buff登録
```

という別実装があるが、同じIDのため通常実行では先行分岐で処理が終了し、後段へ到達しない。

したがって、

> **現masterにカードが存在すること、発動分岐が存在することだけでは、後段の現行風効果が実行される根拠にならない。**

と扱う。

### 《産業街道》と道路システムの境界

現 `game/` には、Trial route計算に使える一般的な道路グラフ/道路セル/道路edge/移動コストシステムは確認できない。

`GridEngine` は土地配置・地帯化・連携等を管理するが、道路状態や道路移動コストを保持しない。`ProductionCalculator` も `industrialRoadActive` を参照しない。

したがって現在は、

> **道路カードのデータと永続フラグはあるが、「道路」という盤面システム自体はまだ存在しない**

と分類する。

---

## 5. Offering条件の実装境界

`DeckManager.isCardEligible()` は、地形数・資源量・socket発見・連結土地・水源・Stage・Trial距離等の多数の条件を評価できる。

一方、カードデータに存在していても、現 `isCardEligible()` から参照されない条件キーがある。今回確認済みなのは以下。

- `reqMinLinks`
- `reqIndustrySpecialBlocks`
- `reqDistinctPrimaryIndustries`
- `reqGranaries`
- `reqIrrigationDone`
- `reqLinkedDistinctIndustries`
- `reqPlainsOrReclaimed`

さらに、条件キー自体は参照されても、名前が示す意味と実判定が一致しないものがある。

- `reqConnectedPlainsOrReclaimed`: 現実装は連結成分を探索せず、盤面全体の平地＋干拓地を単純合計する。
- `reqForestNearby`: 現実装は対象位置との近接関係を見ず、盤面全体の森系マスを単純集計する。
- `reqLoggingCamp`: 現実装は伐採拠点の存在に加えて「盤面に森がある」だけでも通すため、伐採拠点を厳密な前提条件にしていない。

したがって、

> **カードデータに条件が書かれていること自体は、Offering条件がその意味どおり実装済みであることを意味しない。**

と扱う。

逆に、`reqWaterSource`、`reqLargeTerritory`、`reqWood`、`reqFood`、`reqMystic`、`reqPlainsMerge2x2`、地形/socket系など、現Eligibilityで明示的に評価される条件も存在する。

---

## 6. 《放棄された集落》と探索の扱い

`CMD_ABANDONED_SETTLEMENT` は独立土地探索システムとは分離する。

- カード自身の2D6判定として存続
- `CheckSystem` を利用
- 専用の現在報酬表を持つ
- 廃止方向の `executeExploration()` 報酬表を参照しない

これにより「探索という題材をカード化する」現在方針と整合する。

---

## 7. 既知のrules/game差分

特に重要な差分：

1. 《配給》: rules旧40%軽減 vs runtime 50%軽減。
2. 《農地改革》: rules旧「指定最大4マス」 vs runtime「全平地系+1/Verse」。さらに候補化の `reqConnectedPlainsOrReclaimed:3` は実際には非連結でも合計3マスで成立する。
3. 《伐採拠点》《製材所》: 前者の `reqForestNearby` は盤面全体集計、後者の `reqLoggingCamp` は森が1マスあるだけでも成立し得るため、カードデータ名が示す前提関係より緩い。
4. 《灌漑》: `reqWaterSource` は評価されるが、`reqPlainsOrReclaimed` は未評価のため、対象農地条件が候補化へ接続されていない。
5. 《穀物庫》《牧畜場》《製材所》《鉱山》等: カードは存在するが、完成した持続効果が未接続。
6. Stage 3 Project群: フラグ/Buff骨格中心で、Trial/Production/Cost resolverへの接続が未完成。
7. 《大防塁》: 同一IDの発動分岐が重複し、先行旧分岐が後段分岐をshadowする。

---

## 8. Legacy分岐

`DeckManager.playCommandCard()` には、現 `COMMAND_CARDS_MASTER` に存在せず通常Offeringから到達しない旧カード分岐も残る。

詳細は `rules/99_legacy_command_branch_audit.md` を参照する。
