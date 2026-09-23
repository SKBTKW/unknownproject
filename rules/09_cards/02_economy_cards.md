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
| `CMD_RATIONING` | **Implemented / Player-facing description mismatch** | 食料維持費を50%化。表示説明は「40%軽減」のままでruntimeと一致しない。旧 `foodCostRationingDiscount=0.40` fieldは残るが実効値ではない。 |
| `CMD_WETLAND_RECLAMATION` | **Implemented / Interaction mismatch** | 🧱15＋🔥1。湖でない未地帯化湿原1マスを干拓地へ永久変換。ただし表示説明は「1マスを指定」とする一方、runtimeはtarget入力を使わず走査順で最初の有効湿原を自動選択する。 |
| `CMD_LOGGING_CAMP` | **Partial / Player-facing description mismatch / Eligibility different** | runtimeは即時🧱+8とBuffのみ。表示説明の「森1マスを伐採拠点化」「周囲森林から継続🧱産出」は未接続。`reqForestNearby` は近接判定ではなく盤面全体の森系マス数。 |
| `CMD_GRANARY` | **Partial / Player-facing description mismatch** | `granaryCount` は増えるがMaintenanceは参照しない。表示説明の食料維持費×0.90は実効しない。 |
| `CMD_AGRICULTURAL_REFORM` | **Implemented / Simplified / Player-facing description mismatch / Eligibility different** | runtimeは全平地系へ恒久🌾+1/Verse。表示説明は「指定した連結農業地域の最大4マス」だが、target選択はなく盤面全体へ作用する。候補化の連結条件も実際には盤面全体合計。 |
| `CMD_PASTORAL_FARM` | **Partial** | 即時🌾+2中心。表示説明の持続施設効果は未接続。 |
| `CMD_ABANDONED_SETTLEMENT` | **Implemented** | 🔥1、2D6。2–5:🌾+15 / 6–8:🧱+15 / 9–11:✨+10 / 12:🌾+20🧱+20✨+15。 |
| `CMD_EMERGENCY_LEVY` | **Implemented** | 🌾20→即時🧱+15。旧維持費+5ペナルティは現発動では設定しない。 |

### プレイヤー表示とruntimeの重要差分

現状、カード説明をそのまま操作仕様として信頼できない現役カードがある。

#### 《配給》

表示:

> 今Verseの最終食料維持費を40%軽減

runtime:

> `foodCostHalvedTurns=1` により50%化

#### 《干拓》

表示:

> 盤面の湿原1マスを指定して干拓

runtime:

> `targetTile` を使わず盤面を走査し、最初の有効湿原を自動変換

#### 《農地改革》

表示:

> 指定した連結農業地域の最大4マスを強化

runtime:

> `permanentPlainsFoodBonus += 1` により全平地系へ恒久加算

#### 《伐採拠点》

表示:

> 森1マスを拠点化し、周囲森林から継続産出

runtime:

> 即時🧱+8のみ。対象マス変換・周囲継続産出consumerなし

---

## 3. Stage 2

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_SAWMILL` | **Partial / Player-facing description mismatch / Eligibility different** | `sawmillCount` とBuffのみ。表示説明の森林産出×1.5は未接続。`reqLoggingCamp` は森1マスでも通り得る。 |
| `CMD_QUARRY` | **Partial / Player-facing description mismatch** | 即時🧱+10。表示説明の周囲地形による継続産出は未接続。 |
| `CMD_MINE` | **Partial / Player-facing description mismatch** | `mineCount` 登録。表示説明の鉱物socket産出×1.5は未接続。 |
| `CMD_STABLE` | **Partial / Player-facing description mismatch** | `stableCount` 登録。表示説明の騎馬カードWeight/コスト軽減は未接続。 |
| `CMD_LIME_KILN` | **Partial / Player-facing description mismatch** | `limeKilnCount` 登録。表示説明の建設コスト20%軽減は未接続。 |
| `CMD_MARKET` | **Partial / Player-facing description mismatch / Eligibility gap** | `marketCount` 登録。表示説明の連携資源カテゴリ継続産出は未接続。`reqMinLinks` は現Eligibilityで未評価。 |
| `CMD_DEPOT` | **Partial / Player-facing description mismatch / Eligibility gap** | `depotCount` 登録。表示説明のProject🧱コスト15%軽減は未接続。`reqIndustrySpecialBlocks` 未評価。 |
| `CMD_IRRIGATION` | **Partial / Player-facing description mismatch / Eligibility gap** | `irrigationCount` 登録。表示説明の対象農業マス恒久🌾+1は未接続。`reqWaterSource`は評価、`reqPlainsOrReclaimed`は未評価。 |
| `CMD_RESETTLEMENT` | **Partial / Duplicate branch conflict / Player-facing description mismatch** | 同一ID分岐が2回ある。先行分岐が実際に発火し、🔥+2を30でcapし、`resettlementFoodBonus += 2` を設定する。後段の `EmberSystem.addBonus(2)` 分岐はshadowされる。表示説明の「指定平地2×2地帯」「その地帯全体🌾+2」は実装されていない。 |
| `CMD_WORKSHOP` | **Partial / Player-facing description mismatch / Eligibility gap** | `workshopCount` 登録。表示説明の特殊ブロック系🧱コスト10%軽減は未接続。`reqDistinctPrimaryIndustries`未評価。 |

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

また現行🔥には固定30上限がなく、連携等で30超へ拡張できる。そのため🔥31以上で《移住》を使うと、先行分岐の `min(30, ember + 2)` により**回復カード使用で🔥が30へ減少する**可能性がある。

したがって現在は、

> **即時🔥処理自体にregressionがあり、継続🌾+2は未接続、後段の別実装はdead branch。**

と扱う。

---

## 4. Stage 3 大規模事業

| ID | 状態 | 現在 |
| :--- | :---: | :--- |
| `CMD_GRANARY_NETWORK` | **Planned / Partial / Player-facing description mismatch / Eligibility gap** | 永続state骨格あり。表示説明の維持費強化は未接続。`reqGranaries`未評価。 |
| `CMD_INDUSTRIAL_ROAD` | **Planned / Partial / Player-facing description mismatch / Eligibility gap** | `industrialRoadActive` とBuff、およびcanonical `roadEdges` / Trial道路消費基盤までは存在。ただしこのカード自身は道路edgeを生成せず、産出+20%も未接続。`reqIndustrySpecialBlocks`未評価。 |
| `CMD_IRRIGATION_NETWORK` | **Planned / Partial / Player-facing description mismatch / Eligibility gap** | state骨格あり。表示説明の最大8農地恒久🌾+1は未接続。`reqIrrigationDone`未評価。 |
| `CMD_INDUSTRIAL_CLUSTER` | **Planned / Partial / Player-facing description mismatch / Eligibility gap** | state骨格あり。表示説明のProject🧱コスト20%軽減は未接続。`reqLinkedDistinctIndustries`未評価。 |

### 《大防塁》について

`CMD_GREAT_RAMPART_PROJECT` は現在 `CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` に含まれる。

したがって通常Offeringへ復帰せず、現役Stage3 Projectとして扱わない。

`DeckManager.playCommandCard()` 内には同一IDの旧分岐が複数残っているが、これは現役カードの実行競合ではなく **LEGACY / RETIRED code残存**として扱う。

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

1. 《配給》: **表示40% / runtime50%**。
2. 《干拓》: 表示は対象指定、runtimeは自動選択。
3. 《農地改革》: 表示は指定連結最大4マス、runtimeは全平地系+1/Verse。Eligibilityの連結条件も非連結合計。
4. 《伐採拠点》: 表示の拠点化・周囲継続産出が未接続。
5. 《灌漑》: 水源条件は有効だが平地/干拓地条件は未評価。表示の対象マス恒久強化も未接続。
6. 《移住》: 現役同一ID分岐が重複。先行分岐が後段をshadowし、30超🔥を30へ下げ得る。継続🌾stateはconsumerなし。
7. 複数施設カード: counter/flagは存在するが、表示説明にある持続効果consumer未接続。
8. Stage3事業: flag/Buff骨格中心でProduction/Cost/Trialへの接続が未完成。
9. 《大防塁》: 現在はretired。旧重複分岐はlegacy cleanup対象。

---

## 8. Legacy分岐

`DeckManager.playCommandCard()` には現カードmasterから到達しない旧分岐が残る。

詳細は `rules/99_legacy_command_branch_audit.md` を参照する。
