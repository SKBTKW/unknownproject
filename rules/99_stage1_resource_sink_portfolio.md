# Stage1 Resource Sink Portfolio Audit

> Status: Balance Audit / Non-Authority
>
> Integration target: AoT260924
>
> Purpose: Trial1までの平時資源sinkを一覧化し、Deployment Costだけを先に固定して経済を歪めないための監査メモ。

## 1. 結論

現状のStage1は、資源を使う入口そのものが存在しないわけではない。

ただし、

- Command Cardには実コストがある
- Investigationは現在無料
- 選択型Global Eventは現在資源支払いを持たない
- FARM / LOGGING_CAMP / ALTAR等のSpecial Block定義には作成費・維持費がない
- Zone Conversionには作成費・維持費のframeworkがあるが、Stage1製品バランス値は未確定
- Trial Deploymentには支払いframeworkがあるが、canonical profileは未確定

という状態。

したがって、現時点でTrial1のDeploymentだけに70〜80%負担を固定するのは早い。

先にStage1全体を、

```text
通常維持費
+ Command Card投資
+ 特殊ブロック / Zone Conversion投資
+ Investigation
+ Global Event緊急支出
+ Trial準備
+ Deployment
```

の支出ポートフォリオとして設計する。

## 2. Stage1 Command Card — 現在の実コスト

`economy_cards.json` の `minStage: 1` を現在値の正本とする。

| Card | 現在コスト | sink分類 | 現在の完成度 |
|---|---:|---|---|
| CMD_RATIONING | なし | 緊急対応 | Implementedだが説明差分あり |
| CMD_WETLAND_RECLAMATION | 🧱15 + 🔥1 | 任意投資 | Implemented |
| CMD_LOGGING_CAMP | 🔥1 | 任意投資 | Partial。恒久施設価値は未接続 |
| CMD_GRANARY | 🧱20 | 任意投資 | Partial |
| CMD_AGRICULTURAL_REFORM | 🧱20 | 任意投資 | Implemented / simplified |
| CMD_PASTORAL_FARM | 🧱15 | 任意投資 | Partial |
| CMD_ABANDONED_SETTLEMENT | 🔥1 | リスク選択 | Implemented。結果は資源獲得系 |
| CMD_EMERGENCY_LEVY | 🌾20 | 緊急変換 | Implemented。🌾→🧱変換 |

重要:

Command CardコストはDeckManagerの共通支払い境界で実際に減算される。

したがって「カードにcostが書いてあるだけ」ではなく、Stage1の現役sinkとして扱える。

ただしSpecial Block系カードの一部は、支払った後の恒久価値が未完成。
この状態でコストだけ増額すると、単なる罰金になる。

## 3. Special Block

現 `special_block_domain.js` には、

- FARM
- LOGGING_CAMP
- ALTAR

等の定義が存在する。

しかしSpecial Block definition自体には、現在

- creationCost
- maintenance
- upkeep

のcanonical payment fieldを持たない。

したがって、

> 農場などを平時の主要sinkにする

方針を採る場合は、効果値だけでなく **Special Block作成費の所有境界** を先に決める必要がある。

Command Cardのcostとして払う方式と、Board/Zone側がquoteする方式を二重化しない。

## 4. Zone Conversion

Zone Conversion Foundationは既に以下を持つ。

- creationCost
- conversion回数によるescalation
- maintenance
- paymentConfirmed境界
- 維持費不足時のDYSFUNCTIONAL化

したがって恒久施設・駐屯地等をsink化する技術基盤としては最も完成度が高い。

一方、fixtureに存在する

```text
GARRISON_TEST
作成 🧱6 + 🔥1
維持 🌾2
```

はテスト値であり、製品バランス値として採用しない。

## 5. Investigation

Stage1 Investigation Cardは現在すべて `cost: {}`。

Investigation execution serviceにも独立した資源支払い責務はない。

つまり現在は、

> Investigationは1 Verse / Offering枠を使うが、🌾🧱等は直接消費しない

状態。

調査そのものを資源sinkにするかは未決定。

情報収集を必須導線にするなら、高コスト化しすぎると「調査したプレイヤーだけ経済的に損をする」ため注意する。

## 6. Global Event

現在の選択型GE `EVENT_CAPTURED_SCOUT` は、

- EXECUTE
- INTERROGATE
- RELEASE

の公開choiceとoutcome tagを持つ。

ただしchoice definition / resolverに資源costやpaymentは存在しない。

したがってGEは現在、Stage1資源sinkとしては **未実装**。

将来、

- 食料を配る
- 資材で被害を防ぐ
- 防衛力を割く
- Emberを消費して救済する

等を入れるなら、Runごとの支出varianceが大きくなるためDeployment balanceへ直接影響する。

## 7. Trial Deployment

Deployment Economyは、

- 🌾 / 🧱 atomic payment
- currentDefense write-through
- origin→target distance
- Board semantic modifier
- GameEngine attach seam

まで実装済み。

canonical profileは未確定。

FirstRunのprobeでは、重配備・遠距離で75〜80%負担を作れることは確認済みだが、これは製品値ではない。

## 8. 支出カテゴリ案

Stage1のsinkを次の3分類で管理する。

### 必須支出

ゲーム進行上ほぼ避けられないもの。

- 通常維持費
- 最低限のTrial Deployment
- FirstRunで必須にする場合のInvestigation最低コスト

### 任意投資

払うことで盤面・生産・Trial準備が強くなるもの。

- 農場
- 伐採所
- 穀物庫
- 農地改革
- 牧畜場
- 駐屯地 / Zone Conversion
- 将来の道路・前哨塔

### 緊急支出 / リスク支出

Run状態・GE・不足によって発生するもの。

- Emergency Levy
- Global Event choices
- 災害回避
- 被害軽減
- 一時的な軍事動員

## 9. 初見Stage1の目標

「Verse1〜14はひたすら貯め、Verse15で75〜80%徴収」にはしない。

目標は、

```text
生産
↓
平時投資で資源が動く
↓
異変後は調査・防衛準備へ支出
↓
Trial直前にも備蓄は残る
↓
Deploymentで最後に大きく削る
```

とする。

初見ではTrial終了までに **総獲得資源の70〜80%程度が何らかの意思決定を通じて盤面・情報・防衛へ変換される** 体験を狙う。

ただし70〜80%をDeployment単体の固定税として実装しない。

## 10. 次に確定が必要なもの

Deployment canonical profileを決める前に、最低限以下を決める。

1. FARM / LOGGING_CAMP / ALTAR等の作成費をどの境界が所有するか
2. Stage1 Command CardのPartial施設効果をどこまで完成させるか
3. Investigationを無料のままにするか
4. Stage1 GEに資源支払いchoiceを入れるか
5. Zone Conversion / Garrisonの製品作成費・維持費
6. Verse14時点で残したい🌾 / 🧱 / 🛡️帯
7. その残高に対するDeploymentの最終負担率

この順序で決めれば、後からsinkを追加してTrial1経済が破綻するリスクを下げられる。


## 11. 2026-09-24 AoT260924 現行Stage1実測と逆算

HQ基礎産出 5/5/5/1 反映後の Full Inspection 実測では、Verse15の無追加sink baselineは次の帯。

| Strategy | 🌾 | 🧱 | 🛡️ |
|---|---:|---:|---:|
| GROWTH | 329〜580 | 227〜411 | 21〜35 |
| FIRST_LEGAL | 164〜437 | 215〜326 | 17〜27 |

したがって、旧監査で使っていた `🌾413〜678 / 🧱334〜467` を現行balance判断には使わない。

初見Stage1全体で「Trial終了までに70〜80%程度の資源を意思決定へ変換する」目標を置く場合、
Deploymentだけで70〜80%を徴収する必要はない。

逆算例:

| 累計消費目標 | Trial前sink | Deployment時の残存備蓄消費 |
|---|---:|---:|
| 70% | 50.0% | 40% |
| 75% | 54.5% | 45% |
| 80% | 60.0% | 50% |

式:

```text
totalSpend = 1 - (1 - preTrialSpend) × (1 - deploymentSpend)
```

したがって現時点の設計仮説は、

> Verse1〜14で baseline備蓄の50〜60%相当が
> Command Card / Special Block / Zone Conversion / GE / その他準備へ流れ、
> Trial Deploymentで残りの40〜50%を使う。

とする。

これは製品コスト値ではなく、各sinkへ予算を割り振るためのbudget envelope。

### FIRST_LEGAL最小ケースの例

baseline `🌾164 / 🧱215` で累計75%帯を使うと、

```text
Trial前sink 約54.5%
→ Trial直前 約 🌾75 / 🧱98

Deploymentでその45%
→ Trial後 約 🌾41 / 🧱54
```

程度になる。

このケースはかなり厳しいため、個別sink値を決める際はFIRST_LEGAL下限を必ず監視する。

### 次のbalance作業

各sinkへこの50〜60%枠を割り振る。

候補:

- Command Card投資
- FARM / LOGGING_CAMP / ALTAR等のSpecial Block
- Zone Conversion / Garrison
- GE選択肢
- Investigation
- Trial前軍事準備

個別コスト合計がこの枠を大きく超える場合は、Deployment負担を下げるか、平時生産を再調整する。
