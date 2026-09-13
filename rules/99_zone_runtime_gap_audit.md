# Zone Runtime Gap Audit

> **Status:** Audit Ledger / Non-Authority
>
> 地帯化・接続グループ・Production・Defense・盤面表示のruntime差分を記録する。正本は `03_land_system/03_merge_system.md` と `02_resources_and_ember.md`。

## 1. 真の地帯

`merge_rules.js` が真の地帯として扱うのは `2x2 / L_SHAPE / T_SHAPE`。1×2 / 1×3接続グループは正本上の地帯ではない。

## 2. 1×2 / 1×3

`GridEngine.checkConnectionBonus()` は1×2 / 1×3にも `mergeGroupId` と `mergeType` を付与し、即時資源ボーナスを与える。

ただし `ProductionCalculator.calculateTotalProduction()` は真の地帯判定を使わず、`mergeGroupId` があるgroupを一律1.20倍する。

そのため現runtimeでは、正本上は地帯ではない1×2 / 1×3まで 🌾🧱✨ が1.20倍され得る。

分類: **INTERNAL_CONFLICT**

## 3. 防衛

`DefenseSystem.calculateMaxDefense()` は各cellの防衛値とsocket防衛値を直接加算し、地帯倍率を参照しない。

したがって真の4セル地帯でも、実 `maxDefense` は1.20倍されない。

一方 `ProductionCalculator.getResourceBreakdown()` はgroupの `defenseTiles` を1.20倍してから、最終 `defense.total` だけDefenseSystem値を使う。

結果として同じbreakdown内で、地帯化後の `defense.tiles` と `defense.total` が異なる前提で計算され得る。

分類: **INTERNAL_CONFLICT / RULES-GAME GAP**

## 4. 盤面表示

`BoardGridComponent.getPrimaryYieldInfo()` は `cell.merged === true` のgroupだけ `yieldMultiplier` を表示へ反映する。

そのため現在は、

- 1×2 / 1×3: Board表示は×1.0だが、🌾🧱✨の実Productionは×1.20になり得る
- 真の4セル地帯: Board表示では🛡️にも×1.20を掛けるが、実maxDefenseは×1.0

というPresentationと実値の不一致がある。

さらに真の地帯表示では、各cellの `getCellViewData()` から取得したmodifier込みの値をgroup合算した後に `yieldMultiplier` を掛ける。

現 `calculateCellYieldBreakdown()` が返す主なmodifierには、

- 本営近郊 +1
- 湖 / オアシス灌漑
- 恒久平地強化
- 恒久近郊防衛

等が含まれる。

一方、実 `calculateTotalProduction()` は地帯1.20倍を土地の基礎産出groupへ先に適用し、本営近郊・灌漑・恒久平地強化等を別経路で後から加算する。

したがって真の地帯では、Board表示がこれらのmodifierまで1.20倍へ巻き込み、実Productionより大きく見せる場合がある。

分類: **INTERNAL_CONFLICT — Presentation modifier order vs runtime settlement order**

## 5. 原因

`mergeGroupId` が旧接続グループと真の地帯の双方に使われ、consumerごとに `mergeGroupId / cell.merged / yieldMultiplier / isTrueMergedCell()` のどれを地帯判定に使うか統一されていない。

さらにPresentation側とProduction側で、地帯倍率を適用する対象と順序も統一されていない。

本監査ではgameを変更しない。正本上は4セルの真の地帯のみを地帯化として扱う。
