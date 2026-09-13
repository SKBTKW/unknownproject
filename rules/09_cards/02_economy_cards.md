# 09-2. 経済・政策カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial / Planned / Retired
>
> カードの候補化データは `game/src/data/economy_cards.json` および生成済み `command_cards_data.js` に存在する。
> カードがOfferingへ存在することと、説明どおりの最終効果が接続済みであることは別とする。

---

## 1. 設計原則

> 土地カードが「どんな大地を得るか」を決め、経済・政策カードは「その大地をどう利用するか」を決める。

Offering条件・Weight・コストは実装データを現在値の正本とし、本文書では主に実装完成度を管理する。

- **Implemented**: 現在の主要システムへ実効接続済み。
- **Partial**: 発動骨格はあるが最終効果の一部が未接続。
- **Planned**: データ/設計またはflag中心。
- **Legacy / Retired**: 通常Offeringから外れた旧実装。

---

## 2. Stage 1

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_RATIONING` | **Implemented** | 食料維持費を50%化。旧40%値のfieldは残るが実効値ではない。 |
| `CMD_WETLAND_RECLAMATION` | **Implemented** | 🧱15＋🔥1。湖でない未地帯化湿原1マスを干拓地へ永久変換。 |
| `CMD_LOGGING_CAMP` | **Partial / Eligibility different** | 即時🧱+8。継続産出未接続。`reqForestNearby` は近接判定ではなく盤面全体の森系マス数。 |
| `CMD_GRANARY` | **Partial** | `granaryCount` は増えるがMaintenanceは参照しない。 |
| `CMD_AGRICULTURAL_REFORM` | **Implemented / Simplified / Eligibility different** | 全平地系へ恒久🌾+1/Verse。候補化の連結条件は実際には盤面全体合計。 |
| `CMD_PASTORAL_FARM` | **Partial** | 即時🌾+2中心。持続施設効果未接続。 |
| `CMD_ABANDONED_SETTLEMENT` | **Implemented** | 🔥1、2D6。2–5:🌾+15 / 6–8:🧱+15 / 9–11:✨+10 / 12:🌾+20🧱+20✨+15。 |
| `CMD_EMERGENCY_LEVY` | **Implemented** | 🌾20→即時🧱+15。旧維持費+5ペナルティは現発動では設定しない。 |

---

## 3. Stage 2

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_SAWMILL` | **Partial / Eligibility different** | `sawmillCount` とBuffのみ。森林産出×1.5未接続。`reqLoggingCamp` は森1マスでも通り得る。 |
| `CMD_QUARRY` | **Partial** | 即時🧱+10。周囲地形の継続産出未接続。 |
| `CMD_MINE` | **Partial** | `mineCount` 登録。鉱物socket産出×1.5未接続。 |
| `CMD_STABLE` | **Partial** | `stableCount` 登録。騎馬カードWeight/コスト軽減未接続。 |
| `CMD_LIME_KILN` | **Partial** | `limeKilnCount` 登録。建設コスト軽減未接続。 |
| `CMD_MARKET` | **Partial / Eligibility gap** | `marketCount` 登録。`reqMinLinks` は現Eligibilityで未評価。 |
| `CMD_DEPOT` | **Partial / Eligibility gap** | `depotCount` 登録。`reqIndustrySpecialBlocks` 未評価。 |
| `CMD_IRRIGATION` | **Partial / Eligibility gap** | `irrigationCount` 登録。`reqWaterSource`は評価、`reqPlainsOrReclaimed`は未評価。 |
| `CMD_RESETTLEMENT` | **Partial / Duplicate branch conflict** | 同一ID分岐が2回ある。先行分岐が実際に発火し、🔥+2を30でcapし、`resettlementFoodBonus += 2` を設定する。後段の `EmberSystem.addBonus(2)` 分岐はshadowされる。`resettlementFoodBonus` はProductionCalculatorで参照されず、継続🌾+2は未接続。 |
| `CMD_WORKSHOP` | **Partial / Eligibility gap** | `workshopCount` 登録。`reqDistinctPrimaryIndustries`未評価。 |

### 《移住》duplicate branch conflict

`DeckManager.playCommandCard()` には `CMD_RESETTLEMENT` が2回存在する。

先行分岐は、

```text
ember = min(30, ember + 2)
resettlementFoodBonus += 2
PERMANENT Buff
```

を実行する。

後段には `EmberSystem.addBonus(2)` を使う別分岐があるが、同じ `else-if` チェーンのため通常実行では到達しない。

さらに `ProductionCalculator` は `resettlementFoodBonus` を参照しない。

したがって現在は、

> **即時🔥+2は先行分岐で実効するが、30capを持つ。継続🌾+2はstate登録だけで未接続。後段の別実装はdead branch。**

と扱う。

---

## 4. Stage 3 大規模事業

| ID | 状態 | 現在 |
| :--- | :---: | :--- |
| `CMD_GRANARY_NETWORK` | **Planned / Partial / Eligibility gap** | 永続state骨格あり。`reqGranaries`未評価。 |
| `CMD_INDUSTRIAL_ROAD` | **Planned / Partial / Eligibility gap** | `industrialRoadActive` とBuffまでは存在。道路グラフ/道路edge/移動コスト/Trial誘導は未実装。 |
| `CMD_IRRIGATION_NETWORK` | **Planned / Partial / Eligibility gap** | state骨格あり。`reqIrrigationDone`未評価。 |
| `CMD_INDUSTRIAL_CLUSTER` | **Planned / Partial / Eligibility gap** | state骨格あり。`reqLinkedDistinctIndustries`未評価。 |

### 《大防塁》について

`CMD_GREAT_RAMPART_PROJECT` は現在 `CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` に含まれる。

したがって通常Offeringへ復帰せず、現役Stage3 Projectとして扱わない。

`DeckManager.playCommandCard()` 内には同一IDの旧分岐が複数残るが、これは現役カードの実行競合ではなく **LEGACY / RETIRED code残存**として扱う。

---

## 5. Offering条件の実装境界

現 `DeckManager.isCardEligible()` で未評価の確認済みキー:

- `reqMinLinks`
- `reqIndustrySpecialBlocks`
- `reqDistinctPrimaryIndustries`
- `reqGranaries`
- `reqIrrigationDone`
- `reqLinkedDistinctIndustries`
- `reqPlainsOrReclaimed`

意味が名前とズレる確認済みキー:

- `reqConnectedPlainsOrReclaimed`: 連結成分ではなく盤面全体合計。
- `reqForestNearby`: 近接ではなく盤面全体の森系マス数。
- `reqLoggingCamp`: 伐採拠点がなくても森1マスで通り得る。

したがって、カードデータに条件があること自体は、その意味どおりのEligibility実装を保証しない。

---

## 6. 《放棄された集落》と探索

`CMD_ABANDONED_SETTLEMENT` は独立探索システムとは分離する。

- カード自身の2D6判定として存続
- `CheckSystem` を利用
- 専用報酬表を持つ
- Legacy `executeExploration()` 報酬表を参照しない

---

## 7. 既知の重要差分

1. 《配給》: runtimeは50%軽減。旧40%fieldは実効値ではない。
2. 《農地改革》: 指定区域ではなく全平地系+1/Verse。Eligibilityの連結条件も非連結合計。
3. 《伐採拠点》《製材所》: 条件名より実Eligibilityが緩い。
4. 《灌漑》: 水源条件は有効だが平地/干拓地条件は未評価。
5. 《移住》: 現役同一ID分岐が重複。先行分岐が後段をshadowし、継続🌾stateはconsumerなし。
6. 複数施設カード: counter/flagは存在するが持続効果consumer未接続。
7. Stage3事業: flag/Buff骨格中心でProduction/Cost/Trialへの接続が未完成。
8. 《大防塁》: 現在はretired。旧重複分岐はlegacy cleanup対象。

---

## 8. Legacy分岐

`DeckManager.playCommandCard()` には現カードmasterから到達しない旧分岐が残る。

詳細は `rules/99_legacy_command_branch_audit.md` を参照する。
