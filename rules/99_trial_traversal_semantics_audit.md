# Trial Traversal Semantics Audit

> **Status:** Audit Ledger / Non-Authority
>
> Trial戦闘後のroute進軍について、`rules/05_trials_and_defense.md` の記述と現runtimeの差分を記録する。Trialルール正本は `05_trials_and_defense.md`。

## 1. 現rules記述

現 `05_trials_and_defense.md` には、迎撃に失敗した場合、

> `TrialEnemyAdvanceService` では1戦闘解決につきroute上を1段進行する

という説明が残っている。

## 2. 現runtime

現在の `TrialEnemyAdvanceService.advanceAfterBattle()` は、迎撃結果を以下の二値に整理している。

### REPEL

- `stopped = true`
- `advanced = false`
- 迎撃地点で停止
- `reachedRouteEnd = false`

### REPEL以外

`BREAKTHROUGH`だけでなく、REPELでない結果は同じ進軍意味を持つ。

- 残りroute距離 `remainingDistance` を計算
- `toIndex = route.cells.length - 1`
- `reachedRouteEnd = true`
- 生存敵はそのrouteの残り全区間を進み、本営まで到達

実装コメントでも、

> 同じroute上に2回目の意図的迎撃は存在しないため、迎撃で止められなかった生存敵は残りrouteをすべて進む

という責務になっている。

したがって現runtimeは、

```text
迎撃成功(REPEL)
→ その地点で停止

迎撃失敗(REPEL以外)
→ そのrouteの残りを全部進行
→ HQ到達
```

である。

## 3. HQ Damageとの関係

route終端へ到達したINTERCEPT routeの残存制圧力は、SKIP routeの到達制圧力と合わせて `TrialHqArrivalAggregationService` で集約される。

その後、集約値を1回だけ🔥損害へ変換する。

したがって、旧来の

```text
突破
→ 1セル進む
→ 次の何らかの処理
```

という逐次route進行モデルではない。

## 4. 分類

| 項目 | 分類 |
| :--- | :---: |
| 現rulesの「1戦闘につき1段進行」 | **GAME_AHEAD / rules stale** |
| REPEL時の停止 | **実装済み** |
| REPEL以外のHQまで全進行 | **実装済み** |
| SKIP routeのHQ到達 | **実装済み** |
| 全route到達制圧力の集約 | **実装済み** |

## 5. 注意

この監査は「突破後に何マス進ませるべきか」という新設計を提案するものではない。

現時点で確定しているのは、**現在のgame実装が1マス進軍モデルではなく、迎撃で止まらなければroute終端まで進むモデルへ変わっている**という実装事実である。

本監査では `game/` を変更しない。
