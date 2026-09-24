# 10. グローバルイベント / Trial接近シーケンス仕様

> **Labels:** [CURRENT] [PARTIAL]

> **Status:** Active Rule + Implementation Notes
>
> 通常のGlobal Eventと、Trial接近を知らせる進行シーケンスを分離して扱う。

## 1. 通常Global Event

Global Eventは、長期計画を無作為に無効化するためではなく、数Verseの間だけカード・資源・盤面の価値を変え、優先順位を揺らすために使う。

現在の `game/` では以下の責務分離を採用している。

- `GlobalEventDirector`: 発生判定
- `GlobalEventSelector`: 条件適合イベントのWeight抽選
- `GlobalEventManager`: 発動・継続・終了管理

前回イベントからの経過Verseに応じた初期テスト発生率は次の通り。

| 経過Verse | 発生率 |
| :---: | :---: |
| 0〜2 | 0% |
| 3 | 5% |
| 4 | 10% |
| 5 | 20% |
| 6 | 35% |
| 7以上 | 50% |

発生後は最低3Verseの平穏期間を置く。数値は内部調整値であり、プレイヤーへ表示する必要はない。

候補化ではStage、盤面、資源、履歴、発見済み資源、Trialとの内部距離、イベント固有Cooldown等を参照する。条件不適合イベントは候補から除外し、その後Weight抽選する。

## 2. 現在の実装イベント

`game/src/data/global_events.js` には以下の8種が存在する。

| ID | 名称 | 実装状態 |
| :--- | :--- | :--- |
| `EVENT_COLD_WAVE` | 寒波 | **Implemented / Partial chain** — 平地🌾倍率0.75は産出計算へ接続済み。終了後の`FOOD_CRISIS`イベントWeight補正は現イベントID/categoryに対応先がなく、実効先を確認できない。 |
| `EVENT_DROUGHT` | 旱魃 | **Implemented** — 平地🌾倍率0.60は産出計算へ接続済み。 |
| `EVENT_NEW_GENERATION` | 新たな世代 | **Implemented** — `OFFERING_WEIGHT_TAG_BOOST(POPULATION)` はCard Coreの共通Weight Policyへ `tagMultipliers` として接続済み。 |
| `EVENT_CRAFTSMAN_BOOM` | 職人たちの活況 | **Implemented** — `OFFERING_WEIGHT_TAG_BOOST(CONSTRUCTION)` はCard Coreの共通Weight Policyへ接続済み。 |
| `EVENT_BOUNTIFUL_SEASON` | 豊穣の季節 | **Implemented / Partial chain** — 平地🌾倍率1.25は産出計算へ接続済み。終了後の`EVENT_NEW_GENERATION` Weight補正はSelector側で参照され、`NEXT_GLOBAL_EVENT`寿命は次の成功したGlobal Event発火時に1回消費される。 |
| `EVENT_RECOVERY_MOMENTUM` | 復興の機運 | **Implemented** — 発生条件は `HAS_HISTORY → RunHistoryReadModel → Chronicle` で直近Trialの被害を参照し、`OFFERING_WEIGHT_TAG_BOOST(RECOVERY)` もOffering抽選へ接続済み。 |
| `EVENT_DEMIHUMAN_RAID` | 亜人襲撃 | **Partial / Boundary locked** — `HAS_HISTORY(TRIAL_SURVIVED)` により少なくとも1回のTrial突破後のみ候補化。現時点では通常Trial lifecycleを再利用せず、`effects: []` のまま専用Minor Raid encounter port待ち。 |
| `EVENT_DEMIHUMAN_SCOUTS` | 亜人の斥候 | **Partial / History-gated** — `HAS_HISTORY(TRIAL_SURVIVED)` により少なくとも1回のTrial突破後のみ候補化。Captured Scout選択イベントへの導線はあるが、追加効果は未実装。 |

《寒波》《旱魃》《豊穣の季節》の `PRODUCTION_MULTIPLIER` は `ProductionCalculator` が `globalEventManager.applyProductionEffects()` を呼ぶため実効する。

`OFFERING_WEIGHT_TAG_BOOST` は `GlobalEventManager.applyOfferingWeightEffects()` が汎用 `tagMultipliers` を構築し、Card Coreの `offering_weight_policy` が

`baseWeight × Directive × Draw Bias × GE Tag Multiplier`

として評価する。GE側はカードIDや抽選ロジックを持たず、Card Core側もイベントID分岐を持たない。通常抽選とfallback抽選は同じWeight Policyを利用する。

## 3. Trial接近は通常Global Eventと分離する

Trial接近を通常Global Eventのランダム抽選だけに依存させない。

特に第1 Trial前は、初見プレイヤー向けに次の流れを保証する。

```text
平穏な開拓
→ 環境・生物の異変
→ 亜人の存在を認識する出来事
→ 調査・情報カテゴリ解禁
→ 情報収集
→ 警戒状態の深化
→ 第1 Trial
```

この流れは通常Global Eventとは別の進行制御シーケンスとして扱う。

## 4. 正確な残りVerse数を見せない

内部ではTrial予定Verseや距離を保持してよいが、プレイヤー向けには原則として「あと5Verse」等の正確なカウントダウンを表示しない。

接近は主に次の要素で表現する。

- 空や照明の変化
- 風、雷鳴
- カラスや獣の声
- Advisorの断定を避けた短い警告
- 調査結果
- Offeringの変化

目的は、システムから日程を知らされるのではなく、世界の変化から危機を察知させること。

### 現在のgameとの齟齬

`TopHeaderComponent` には旧仕様の `trialCountdownBadge` が残っている。

現実装は、

```text
turnsLeft = nextTrialTurn - currentTurn
```

を計算し、`1〜5` の場合に正確な残りVerse数を画面へ表示する。

これは**現採用デザインではないLegacy UI**とする。

さらに、旧Trial予定Verseは表示だけではなく、現在の `DeckManager.isCardEligible()` の一部条件にも直接使用されている。

現実装には次の条件が残る。

- `reqTrialNotice`: `notice.active` または `nextTrialTurn - currentTurn <= 5`
- `reqTrialWithin: N`: `nextTrialTurn - currentTurn <= N`
- `reqTrialOrLowDefense`: Trial notice または低防衛

現行カードデータでは、たとえば以下がこの旧schedule couplingを利用する。

- `CMD_MUD_OBSTACLE`
- `CMD_HIGH_GROUND_FORMATION`
- `CMD_CAVALRY_SCOUTS`
- `CMD_GUIDED_DEFENSE`
- `CMD_SCOUT_ENEMY`
- `CMD_SCORCHED_RETREAT`
- `CMD_LOCAL_IRON_ARMAMENT`
- `CMD_OMEN_DREAM`
- `CMD_VIGILANCE`

したがって現在の `nextTrialTurn` は、**Legacy countdown表示だけの値ではなく、Offering Eligibilityにも実効的に影響している。**

内部Trial距離をEligibilityへ利用すること自体は現行ルールと必ずしも矛盾しない。しかし現在は、第1 Trial前の固定異変・脅威認識・調査カテゴリ解禁が未実装のまま、rawな予定Verseとの差分だけでカード候補化が進む。

特に `CMD_OMEN_DREAM` は `reqTrialWithin: 10` を持つため、現状では予定Verseへの接近だけで候補化条件を満たし得る。これは「異変認識後に調査・情報手段を解禁する」という現在の接近シーケンスとは未統合である。

## 5. 警戒状態

Trial接近時は、数値カウントダウンではなく**警戒状態**として表現する。

警戒状態は単一ゲージである必要はなく、画面・音・Advisor・調査結果・Offering変化を組み合わせた世界状態として扱う。

内部的なTrial距離はカードEligibility等へ使用してよいが、その値を直接プレイヤーへ露出させない。

ただし現在のgameでは、そのEligibilityが警戒・脅威認識状態ではなく `nextTrialTurn - currentTurn` の旧scheduleへ直接結合している部分がある。これは実装上の未統合として扱う。

## 6. 第1 Trial前の固定異変

初回プレイでは、第1 Trial前に必ず一度、敵対勢力の存在を認識できる出来事を発生させる。

この出来事はランダム抽選によって欠落してはならない。

必要条件:

1. それ以前の環境異変と意味的につながる
2. 亜人または未知の敵対勢力の存在を認識させる
3. Trialの日付そのものは教えない
4. 発生を契機に**調査・情報カテゴリ**をOffering候補へ解禁する
5. プレイヤーへ備える理由を与える

## 7. 調査・情報カテゴリ

調査カードはゲーム開始時から常時出現させない。異変認識前に敵軍調査カード等が出ると、物語上の発見を先取りするためである。

第1 Trial前の固定異変を契機として解禁する。

調査情報は原則として嘘を含まない。情報量・解像度が上昇する構造とする。

- 低解像度: 複数方向に異変
- 中解像度: 主な侵入方向、規模傾向
- 高解像度: 主要route、敵規模、地形との関係

誤情報を見抜くのではなく、限られた準備期間でどこまで確度を上げるかを問う。

### 実装状態

- 設計方針: **採用済み**
- Offeringの調査カテゴリ解禁状態: **未実装**
- 第1 Trial前固定異変の強制トリガー: **未実装**
- 警戒状態のPresentation: **未実装**
- 正確な残りVerseカウントダウン: **旧UIが現存 / Legacy**
- `nextTrialTurn` を直接参照するカードEligibility: **現役実装 / 警戒・調査解禁状態とは未統合**

旧来の「第1 Trial前は完全無風」は廃止する。

## 8. 第1 Trial後の脅威イベント

第1 Trial以後は、亜人側が人類生存圏を認識したことを平時イベントで表現してよい。

ただし目的は追加Trialを増やすことではない。本Trialより規模・操作量を抑え、「第1 Trial後は以前の平穏には戻らない」ことを示す。

現在の `EVENT_DEMIHUMAN_RAID` / `EVENT_DEMIHUMAN_SCOUTS` はこの役割のための未完成データとして扱う。

## 9. Event間の因果関係

専用イベントチェーンシステムは必須としない。既存のWeight補正で出来事の因果関係を表現できる。

現在 `EVENT_WEIGHT_MODIFIER` 自体は実装され、`GlobalEventSelector` は `state.temporaryWeightModifiers` を参照して候補Weightへ倍率を掛ける。

ただし寿命管理には実装不整合がある。

- `EffectResolver.EVENT_WEIGHT_MODIFIER` は `expiry: { type: "NEXT_GLOBAL_EVENT" }` を保存できる。
- `GlobalEventManager.triggerEvent()` は、成功したGlobal Event開始時に、それ以前から待機していた `NEXT_GLOBAL_EVENT` modifierを1回消費する。
- 消費は現在イベントの `effects` 適用前に行うため、現在イベント自身が新たに付与した `NEXT_GLOBAL_EVENT` modifierは次回イベントまで保持される。
- `TURN_COUNT` modifierの寿命管理は従来どおり `tickTurn()` が担当する。

したがって、`NEXT_GLOBAL_EVENT` は**次に成功したGlobal Event発火で一度だけ消費される寿命**として実装済み。

さらに《寒波》終了時の `targetTag: "FOOD_CRISIS"` は、現8イベントの `id` / `category` と一致する対象を確認できないため、現マスターでは実効対象なし。

《豊穣の季節》終了時の `targetTag: "EVENT_NEW_GENERATION"` はEvent IDに一致するためSelectorのWeight計算対象にはなるが、上記expiry未消費問題を持つ。

第1 Trial前の異変シーケンスのみ、導入体験として保証する。

## 10. Chronicle

主要Global Event、Trial、重要な発見はChronicleへ記録する。

プレイヤー向け表記はTurnではなく**Verse（節）**を使用する。

目的はラン終了時に、その文明がどのような時代を経て三度のTrialを生き延びたかを振り返れるようにすること。

## 11. 実装との齟齬

現 `game/` には以下が残る。

1. 通常Global Eventの発生・候補抽選・継続管理基盤は実装済み。
2. 寒波 / 旱魃 / 豊穣のProduction倍率は産出計算へ接続済み。
3. 新たな世代 / 職人活況 / 復興の機運のOffering Weight効果は、Card Core共通Weight Policyへ接続済み。
4. 亜人襲撃・斥候は `HAS_HISTORY(TRIAL_SURVIVED)` で第1 Trial後に限定済みだが、イベント固有効果は未実装。
5. `EVENT_WEIGHT_MODIFIER` の `NEXT_GLOBAL_EVENT` expiryは、次に成功したGlobal Event発火で一度だけ消費される。
6. 寒波の終了Weight補正`FOOD_CRISIS`は現イベントマスターに実効対象がない。
7. 第1 Trial前の固定異変シーケンスは未実装。
8. 調査・情報カテゴリの解禁状態は未実装。
9. 警戒状態の環境Presentationは未実装。
10. `TopHeaderComponent` の正確な5VerseカウントダウンはLegacy実装として残存。
11. `DeckManager.isCardEligible()` の一部カード条件は、警戒状態ではなく `nextTrialTurn - currentTurn` を直接参照している。
12. そのため、固定異変・脅威認識・調査解禁より先にTrial接近条件だけで候補化し得るカードがある。
13. 通常Verse進行からTrial本体を自動起動する配線は未実装。


### Demihuman Raid lifecycle boundary

`EVENT_DEMIHUMAN_RAID` は「第1 Trial後に発生し得る小規模脅威」だが、通常Trialそのものではない。

現時点では以下を禁止境界として扱う。

- GEから `TrialController.startScenario()` を直接起動しない。
- Raid解決で通常TrialのSettlement / Stage progression / Post-Trial rewardを流用しない。
- GEの `effects` / `endEffects` にTrial lifecycleを埋め込まない。
- Raid固有の戦闘値・損害値が未確定な間は、空effectを「無料/無害な襲撃」と解釈しない。

将来の実装は、通常Trial lifecycleから独立した **Minor Raid encounter port** を先に定義し、
GE側はそのPortへ要求を渡すだけとする。敵truth、route、通常Trial scheduleの所有権はGEへ移さない。
