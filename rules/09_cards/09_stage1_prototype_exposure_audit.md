# 09-8. Stage1 Prototype Exposure Audit

> **Status:** Measured prototype exposure / production activation remains OFF
>
> Integration target: `AoT260924`
>
> 対象:
> - `CMD_EMERGENCY_LEVY`
> - `CMD_VIGILANCE`
> - `CMD_REKINDLE_EMBER`

## 1. 目的

ID単位runtime activationと個別E2Eが成立した3枚について、
現在のOffering条件をそのまま使った場合にStage1のどこで候補化されるかを測る。

production Offering自体は変更しない。
8つのseedでFirstRunのLAND成長経路をVerse1〜14まで進め、
各Verse snapshotで対象IDだけ一時的にruntime許可して `isCardEligible()` を評価した。

総snapshot数:

- 8 seeds × 14 Verses = **112**

Trial noticeは現FirstRunではVerse10から有効
（Trial1 = Verse15, remaining <= 5）。

## 2. 修正前実測結果（監査起点）

以下は旧 `reqTrialOrLowDefense` を使用していた時点のbaseline。

| Card | Eligible | Rate | Trial notice前 | Trial notice中 | Verse |
| --- | ---: | ---: | ---: | ---: | --- |
| `CMD_EMERGENCY_LEVY` | 8 / 112 | 7.14% | 8 | 0 | Verse1のみ |
| `CMD_VIGILANCE` | 112 / 112 | 100% | 72 | 40 | Verse1〜14すべて |
| `CMD_REKINDLE_EMBER` | 0 / 112 | 0% | 0 | 0 | なし |

## 3. 緊急徴発

現条件:

- `reqWoodDeficit: true`
- legacy評価は `wood <= 30`
- `reqFood: 20`

8seedすべてでVerse1の初期🧱30ではeligible。
一度LAND成長が始まると🧱が30を超え、Verse2以降は全snapshotで候補外になった。

したがって現在の `wood <= 30` は、

> 「Run中に🧱不足へ陥ったときの状況対応」

というより、

> 「初期値30のときだけ成立しやすい開始時条件」

になっている。

### 判断

effect / payment実装はprototype可能だが、
Offering conditionはlive化前に再設計する。

絶対値30を製品仕様として固定しない。
「資材不足」を何に対する不足として扱うかを先に定義する。

## 4. 警戒

### 修正前の実測

旧条件:

- `reqTrialOrLowDefense: true`
- legacy評価:
  - Trial notice active
  - **OR**
  - current defense <= 30

この条件ではStage1の全112 snapshotで成立した。

- Trial notice前: **72 / 72**
- Trial notice中: **40 / 40**
- Verse1〜14すべて

つまりTrial前準備カードではなく、Verse1から常時抽選対象になっていた。

### prototype v1 gate

旧 `reqTrialOrLowDefense` は正本から外し、
Card Definition v1のOffering / Execution requirementを同じ意味論へ揃える。

```text
WARNING_STATE >= WATCH
```

この条件はexact Trial残りVerse数を参照しない。

FirstRunのsemantic flowでは、

- Verse7: OMEN
- Verse8: Investigation成功後にWATCH
- Verse10: TENSE
- Verse14: IMMINENT

となる。

したがって通常FirstRunでVerse8に調査を選んだ場合、
《警戒》は**その後のOfferingから**Trial準備候補になれる。

一方、この監査のLAND-only traceはVerse8 Investigationを実行しないため、
Warning timing側がTENSEへ進むVerse10から初めて成立する。
このtraceでは修正後の期待値を以下に固定する。

- **40 / 112**
- Verse10〜14
- CALM / OMENでは0

Executionでも同じ `WARNING_STATE >= WATCH` を再評価するため、
早期に取得・注入したカードをCALM / OMENで発動する経路はfail-closedになる。

効果本体
`🧱15 → 次Verseから2Verseの🛡️補正`
は従来どおりE2E対象とし、production runtime activationはOFFのまま維持する。

## 5. 残火再燃

現条件:

- `reqMystic: 10`
- `maxEmber: 5`

LAND成長だけを行う8seedでは、
Verse1〜14に🔥5以下へ落ちるsnapshotがなく、
**0 / 112** だった。

### 判断

これは必ずしも不具合ではない。

《再燃》は通常sinkではなく、
危険な🔥状態からの復帰カードというFirst Wave intentに近い。

したがって、

- 平常時のStage1 resource sink量には算入しない
- 低🔥時のrescue slot / dynamic weight候補として扱う
- 通常weightで常時混ぜる必要はない

と整理する。

なお `maxEmber: 5` はOffering条件であり、
一度取得・保留したカードを🔥6以上で発動禁止にするexecution条件ではない。

## 6. Stage1 sinkへの含意

3枚をprototypeとして整備しても、
平時sink問題は解決しない。

- 緊急徴発: 旧条件ではVerse1偏重。しかも🌾→🧱変換
- 警戒: WATCH以降に絞ったTrial前短期sinkであり、通常時の恒久sinkではない
- 再燃: 健全Runでは出現しないrescue

したがってTrial Deployment Costを決める前に必要なのは引き続き、

- 伐採拠点
- 穀倉
- 農地改革
- 牧畜場
- 干拓

などの **盤面恒久投資sinkのsemantic repair**。

3枚のprototype成功を理由に
Deploymentへ不足sinkを肩代わりさせない。

## 7. 次の境界

runtime activation:

- 完了
- ID単位opt-in可能
- production既定OFF

effect E2E:

- 3枚とも完了

Offering condition:

- `CMD_EMERGENCY_LEVY`: **要再設計**
- `CMD_VIGILANCE`: **prototype v1修正済み — WARNING_STATE >= WATCH**
- `CMD_REKINDLE_EMBER`: rescue用途として妥当、通常sinkには数えない

production activation:

- **まだ行わない**
