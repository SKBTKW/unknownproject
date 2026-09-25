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
| `CMD_RATIONING` | **Implemented / v1 semantic-aligned** | このVerseの最終食料維持費を50%化。カード定義は`foodCostHalvedTurns=1`へ一本化し、旧40%系state writeを廃止。 |
| `CMD_WETLAND_RECLAMATION` | **Implemented / Investment Variant v1** | 表示名《灌漑計画》。湿原1マスを対象に A:🧱30干拓 / B:🧱70干拓＋2Verse後水源化 / C:🧱110即時水源化を選択。カードIDはセーブ互換のため維持。地形変換・遅延Development完了はBoard所有。 |
| `CMD_LOGGING_CAMP` | **Board-owned v2 foundation / Unpriced / Dormant** | GL2以上の直交連結2セルを源として、その隣の未配置グリッドへ独立`LOGGING_CAMP`を建設する。土地GLは変更しない。隣接`LOGGING_CAMP`数で産出上昇するRELATION_COUNT方針。作成費・具体産出値は未確定のため通常runtimeはfail-closed。 |
| `CMD_GRANARY` | **Implemented foundation / Dormant** | 🧱20。平地/干拓地へ`GRANARY` Special Blockを対象指定で設置。`FOOD_STORAGE` CapabilityをMaintenanceが読み、1基あたり維持費-2・最大2基分。production既定ではDormant。 |
| `CMD_AGRICULTURAL_REFORM` | **Implemented / v1 Board-owned** | 完成済みPLAINS Zone 1つを明示選択し、Zone Conversionとして各メンバー🌾+1/Verse。作成費🧱20はBoard definitionが正本、維持費なし、UNIQUE。 |
| `CMD_PASTORAL_FARM` | **Partial** | 即時🌾+2中心。表示説明の持続施設効果は未接続。 |
| `CMD_ABANDONED_SETTLEMENT` | **Implemented** | 🔥1、2D6。2–5:🌾+15 / 6–8:🧱+15 / 9–11:✨+10 / 12:🌾+20🧱+20✨+15。 |
| `CMD_EMERGENCY_LEVY` | **Implemented** | 🌾20→即時🧱+15。旧維持費+5ペナルティは現発動では設定しない。 |

### プレイヤー表示とruntimeの重要差分

現状、カード説明をそのまま操作仕様として信頼できない現役カードがある。

#### 《配給》

v1表示 / runtime:

> 今Verseの最終食料維持費を50%にする。

カード定義は `foodCostHalvedTurns=1` の単一意味へ整理済み。

#### 《灌漑計画》

追加投資型カードのモデルケース。

> A. 干拓 — 🧱30：選択した湿原を干拓地化。
>
> B. 灌漑整備 — 🧱70：選択した湿原を干拓地化し、2Verse後にその干拓地を水源化。
>
> C. 集中施工 — 🧱110：選択した湿原を水源を持つ干拓地へ即時変換。

3案は別能力ではなく、同一の土地利用目的に対する投資量・完成速度の違いとして扱う。
湿原を干拓した時点で湿原固有のTrial地形意味論を失い、`E1_RECLAIMED_LAND / STANDARD_E1`へ移行する。
水源化は既存の灌漑源契約 `providesIrrigation` を再利用する。

#### 《農地改革》

表示:

> 指定した連結農業地域の最大4マスを強化

runtime:

> `permanentPlainsFoodBonus += 1` により全平地系へ恒久加算

#### 《伐採拠点》

v2 foundation:

> GL2以上の土地セルを2マス以上直交連結させ、その連結源に隣接する未配置グリッドへ `LOGGING_CAMP` を建設する。

1x1土地を2枚並べて条件を作ってよく、同一placement blockである必要はない。
土地GLは変更しない。隣接する同種拠点数で資材産出が上昇する。
作成費と具体的な基礎/隣接ボーナス値はまだ未確定で、未価格の間はOffering/実行ともfail-closedする。

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
| `CMD_RESETTLEMENT` | **Implemented / Zone Conversion** | 完成済みPLAINS 2×2 Zoneを1つ指定し、Board-owned Zone Conversionとして🌾15/🧱10を支払う。成立時に🔥+2、以後そのZoneから固定🌾+2/T。旧`resettlementFoodBonus`と重複DeckManager分岐は廃止。 |
| `CMD_WORKSHOP` | **Partial / Player-facing description mismatch / Eligibility gap** | `workshopCount` 登録。表示説明の特殊ブロック系🧱コスト10%軽減は未接続。`reqDistinctPrimaryIndustries`未評価。 |

### 《移住》Zone Conversion

`CMD_RESETTLEMENT` はCard Coreのdeclarative Domain ActionからBoard-owned Zone Conversionへ委譲する。

正規契約:

```text
対象: 完成済み PLAINS 2×2 Zone 1つ
作成コスト: 🌾15 / 🧱10
成立時: 🔥+2
恒常産出: Zone全体で固定 🌾+2/T
```

恒常産出は `FIXED_PER_ZONE` であり、4セルそれぞれへ🌾+2を配る効果ではない。
そのためZoneのセル別breakdownへ重複加算せず、Zone Conversion集計へ1回だけ加算する。

旧 `resettlementFoodBonus` state writeと2本の `DeckManager.playCommandCard()` ID分岐は使用しない。
🔥報酬もZone Conversion `creationReward` を正本とし、固定30capは持たない。

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
2. 《灌漑計画》: Investment Variant v1として対象指定・3段階投資・遅延水源化まで接続済み。
3. 《農地改革》: v1で完成済みPLAINS Zone 1つへのZone Conversionへ移行済み。旧global `permanentPlainsFoodBonus`は新規発動では使用しない。
4. 《伐採拠点》: 表示の拠点化・周囲継続産出が未接続。
5. 《灌漑》: 水源条件は有効だが平地/干拓地条件は未評価。表示の対象マス恒久強化も未接続。
6. 《移住》: Zone Conversionへ移行済み。PLAINS 2×2対象、🔥+2、固定🌾+2/TをBoard semanticで実行。
7. 複数施設カード: counter/flagは存在するが、表示説明にある持続効果consumer未接続。
8. Stage3事業: flag/Buff骨格中心でProduction/Cost/Trialへの接続が未完成。
9. 《大防塁》: 現在はretired。旧重複分岐はlegacy cleanup対象。

---

## 8. Legacy分岐

`DeckManager.playCommandCard()` には現カードmasterから到達しない旧分岐が残る。

詳細は `rules/99_legacy_command_branch_audit.md` を参照する。
