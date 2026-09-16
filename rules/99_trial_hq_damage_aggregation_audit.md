# Trial HQ Damage Aggregation Audit

> **Status:** Audit Ledger / Non-Authority
>
> Trial本営到達時の🔥損害について、現在のaggregate実装と既存rules記述の差分を記録する。Trialルールの正本は `05_trials_and_defense.md`。

## 1. 現在の実装経路

現在のTrial本番経路では、route終端へ到達した制圧力をrouteごとに即🔥へ変換しない。

まず `TrialHqArrivalAggregationService` が以下を集約する。

- `SKIP` routeの到達制圧力
- `INTERCEPT` routeで迎撃失敗後、HQへ到達した残存敵制圧力

撃退されたrouteは到達値0として集約対象にならない。

その後、`TrialHqResolutionService` が全routeの `totalSourcePower` を求め、`TrialHqDamageResolver.calculateDamage()` へ1回だけ渡す。

## 2. 現行換算

現行換算率は5。

```text
総HQ到達制圧力
= 全到達routeのsourcePower合計

🔥損害
= ceil(総HQ到達制圧力 / 5)
```

したがって、

```text
ceil(routeA / 5)
+ ceil(routeB / 5)
+ ...
```

ではない。

丸めはrouteごとではなく、**全routeを集約した後に1回だけ行う。**

## 3. 例

route Aの到達制圧力が2、route Bが2の場合、

routeごとに換算すると、

```text
ceil(2 / 5) + ceil(2 / 5) = 2🔥
```

となる。

しかし現在のaggregate実装では、

```text
ceil((2 + 2) / 5) = 1🔥
```

となる。

このため、換算順序は実ゲーム結果に影響する重要な仕様境界である。

## 4. `TrialHqDamageResolver.resolve()` について

`TrialHqDamageResolver` には旧来のroute単位 `resolve()` APIも残っている。

ただし現在の派生 `TrialController.resolveAggregatedHqDamage()` は、`TrialHqResolutionService` による全route集約結果を使い、`calculateDamage(totalSourcePower)` を1回だけ呼ぶ。

したがって「Resolverにroute単位APIが残っている」ことと「現在のTrial Completion経路がroute単位で🔥損害を確定する」ことを混同しない。

## 5. 分類

| 項目 | 分類 |
| :--- | :---: |
| 全route HQ到達制圧力の集約 | **実装済み** |
| 集約後の1回換算 | **実装済み** |
| routeごとの即時🔥換算 | **Legacy-compatible API残存 / 現Completion経路では使用しない** |
| rulesの単一route風説明 | **GAME_AHEAD / 要精密化** |

本監査では `game/` を変更しない。
