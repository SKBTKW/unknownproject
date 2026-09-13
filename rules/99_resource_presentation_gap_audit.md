# Resource Presentation Gap Audit

> **Status:** Audit Ledger / Non-Authority
>
> `02_resources_and_ember.md` の正本値と、HUD / Tooltip / breakdown表示のruntime差分を記録する。ゲームルールの正本ではない。

## 1. 🔥旺盛補正の正本

現在の採用ルールおよび通常Engineの実Productionは、

- `🔥 >= 24` → 🌾 / 🧱 / ✨ Production ×1.10
- さらに ✨+2固定加算

を使用する。

通常Engineでは `BuffSystem` が存在し、`ProductionCalculator.calculateTotalProduction()` は `buffSystem.getProductionMultipliers()` / `getFlatMysticBonus()` を使用するため、実Verse決済はこの値へ接続されている。

---

## 2. `getResourceBreakdown()` の旧表示値

`ProductionCalculator.getResourceBreakdown()` は表示用fieldとして `emberPct` / `emberMystic` を別計算している。

現在の計算は、

```text
🔥 >= 20 → emberPct = 20, emberMystic = 2
🔥 >= 12 → emberPct = 10, emberMystic = 1
```

となっており、現正本および通常Production決済の

```text
🔥 >= 24 → +10%, ✨+2
```

と一致しない。

分類: **INTERNAL_CONFLICT — settlement values vs breakdown presentation values**

---

## 3. プレイヤー向けTooltipへの露出

`TooltipSystem.renderDataPanelBreakdown()` は `state.getResourceBreakdown()` を参照し、`bd.food.emberPct` を

> `🔥残り火加護: +X%`

として表示する。

したがって現UIでは、たとえば、

- 🔥20〜23: 実Productionには旺盛×1.10がないのに、Tooltipは+20%と表示し得る
- 🔥24以上: 実Productionは+10%なのに、Tooltipは+20%と表示する
- 🔥12〜19: 実Productionの正本上は標準状態なのに、Tooltipは+10%と表示し得る

という誤表示が発生する。

TopHeader本体の `+産出` 数値は `calculateTotalProduction()` を直接使用するため、**ヘッダー総量は実決済寄り、詳細Tooltipの内訳説明だけ旧値**という内部不一致になる。

---

## 4. 🛡️表示との関係

地帯化後の🛡️内訳についても、`getResourceBreakdown()` の `defense.tiles` は地帯groupへ1.20倍を掛ける一方、最終 `defense.total/max/current` は `DefenseSystem` を使う。

このため同じ詳細Tooltip内で、内訳と最終🛡️値が異なる計算モデルを持つ場合がある。

詳細は `99_zone_runtime_gap_audit.md` を参照する。

---

## 5. 現在の結論

現在の資源HUDは単一のPresentation SSOTを使っていない。

- TopHeader総産出 → `calculateTotalProduction()`
- Tooltip内訳 → `getResourceBreakdown()`
- 単一セル表示 → `calculateCellYieldBreakdown()`

で計算経路が分かれ、一部に旧値・異なる倍率適用順が残る。

本監査ではgameを変更しない。正本値は `02_resources_and_ember.md` を維持する。
