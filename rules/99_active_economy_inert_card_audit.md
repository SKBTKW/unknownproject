# Active Economy Inert Card Audit

> **Labels:** [AUDIT] [REFERENCE]

> **Status:** Audit Ledger / Non-Authority
>
> 現在の通常Offeringから到達でき、コストを支払って発動できる一方、主要なプレイヤー向け効果のconsumerが確認できない経済カードを整理する。
>
> 即時資源を得るカードや、一部でも主要効果が実効するカードはこの台帳から分離する。

## 1. 判定基準

本台帳で **Inert** とするのは、現HEADで以下を満たすもの。

- 現役カードデータに存在する
- 通常 `playCommandCard()` から発動可能
- コストを支払う
- 発動分岐は `count / flag + Buff + log` を主に行う
- Production / Maintenance / Command cost / Trial 等に主要consumerを確認できない

Buff表示が残ること自体は主要効果とは数えない。

---

## 2. Stage 1

### 《穀物庫》 `CMD_GRANARY`

コスト: **🧱20**

発動:

```text
granaryCount += 1
Buff
log
```

`MaintenanceFallbackSystem.resolveFoodMaintenanceCost()` は `granaryCount` を参照しない。

表示説明の「食料維持費×0.90」は現runtimeで実効しない。

分類: **ACTIVE / INERT PRIMARY EFFECT**

---

## 3. Stage 2

### 《製材所》 `CMD_SAWMILL`

コスト: **🧱25**

発動は `sawmillCount += 1` とBuff/logのみ。
`ProductionCalculator` に製材所倍率consumerなし。

### 《鉱山》 `CMD_MINE`

コスト: **🧱25**

発動は `mineCount += 1` とBuff/logのみ。
鉱物socket産出×1.5 consumerを確認できない。

### 《厩舎》 `CMD_STABLE`

コスト: **🧱20**

発動は `stableCount += 1` とBuff/logのみ。
`DeckManager` 全体で `stableCount` はwriter以外に出現せず、表示説明の騎馬カードWeight上昇 / 🧱-5を実行しない。

### 《石灰窯》 `CMD_LIME_KILN`

コスト: **🌾10 + 🧱15**

発動は `limeKilnCount += 1` とBuff/logのみ。
Command支払いはcard masterのraw costをそのまま減算し、石灰窯20%軽減を参照しない。

### 《市場》 `CMD_MARKET`

コスト: **🧱25**

発動は `marketCount += 1` とBuff/logのみ。
`marketCount` はDeckManager内でwriter以外に出現せず、Production側にもLINK資源カテゴリ産出consumerを確認できない。

### 《集積倉庫》 `CMD_DEPOT`

コスト: **🧱30**

発動は `depotCount += 1` とBuff/logのみ。
Projectカード🧱コスト15%軽減consumerを確認できない。

### 《灌漑》 `CMD_IRRIGATION`

コスト: **🧱20**

発動は `irrigationCount += 1` とBuff/logのみ。
表示説明の対象農業マス🌾+1/Tを適用するconsumerを確認できない。

### 《工房》 `CMD_WORKSHOP`

コスト: **🧱30**

発動は `workshopCount += 1` とBuff/logのみ。
特殊ブロック系カード🧱コスト10%軽減consumerを確認できない。

---

## 4. Stage 3

### 《大穀倉網》 `CMD_GRANARY_NETWORK`

コスト: **🧱50**

発動は `granaryNetworkActive=true` とPermanent Buff/logのみ。
Maintenanceはこのflagを参照しない。

### 《産業街道》 `CMD_INDUSTRIAL_ROAD`

コスト: **🧱45**

発動は `industrialRoadActive=true` とPermanent Buff/logのみ。
道路graph / edge / 産業拠点産出+20% / Trial route利用consumerは確認できない。

### 《大規模灌漑網》 `CMD_IRRIGATION_NETWORK`

コスト: **🧱50**

発動は `irrigationNetworkActive=true` とBuff/logのみ。
最大8農地への恒久🌾+1 consumerを確認できない。

### 《産業集積》 `CMD_INDUSTRIAL_CLUSTER`

コスト: **🧱60**

発動は `industrialClusterActive=true` とBuff/logのみ。
Project🧱コスト20%軽減consumerを確認できない。

---

## 5. この台帳へ入れないカード

- 《伐採拠点》: 即時🧱+8は実効するためPartial。
- 《牧畜場》: 即時🌾+2が実効する。
- 《採石場》: 即時🧱+10が実効する。
- 《移住》: 🔥処理自体が発火するが壊れているため `99_active_action_hard_failure_audit.md` で別管理。
- 《大防塁》: 現在CardCycleでretired。

---

## 6. 実プレイ上の意味

これらは単なる「将来拡張用flag」ではない。

現在のカードデータではOfferingへ出現し、プレイヤーがコストを支払って選択できる。

したがって実プレイでは、

> **カード説明を信じて高コストを支払っても、主要効果が発火せず、Buff表示と内部count/flagだけが残る**

状態になり得る。

特にStage 2以降では🧱20〜60級の投資であるため、バランス評価以前に実装完成度上の優先修正対象とする。

---

## 7. 修正優先の考え方

P0のAction破損（無料土地配置、秘境、移住、Mulligan）より一段下だが、通常Offeringへ残すなら早期に解消すべき。

選択肢はgame側で、

1. 主要consumerを接続する
2. 実装完了までOfferingからretireする
3. 一時的に説明と効果を実装済み部分だけへ縮小する

のいずれか。

本監査自体はどれを採用するか決定しない。
