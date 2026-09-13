# Trial Settlement UI Gap Audit

> **Status:** Audit Ledger / Non-Authority
>
> Trial結果確定後の `Settlement` / Chronicle / Trial退出境界について、現在の `game/` 実装と通常UI導線の差分を記録する。Trialルールの正本は `05_trials_and_defense.md`。

## 1. Domain / Controller側

現在の `TrialController` には `settleTrialResult()` が存在し、`TrialResultSettlementService` を通じて以下を処理できる。

- `SURVIVED` / `FAILED` の結果検証
- `FAILED` 時の `RunTerminationService` 終端確認
- `ChronicleSystem` への `TRIAL_RESULT` 記録
- `TRIAL_RESULT_SETTLED` GameFact emit
- `TRIAL_EXIT_READY` GameFact emit
- `resultSettlement.canExitTrial = true`

また `TrialLifecycleReadService` は、

- `resultReady`
- `settlementConsumed`
- `canExitTrial`
- `runTerminated`
- `runOutcome`

を読み出せる。

したがって、SettlementのDomain/API自体は存在する。

---

## 2. 通常Trial UI側

`TrialDefenseAllocationComponent` はTrial完了後に結果バナーを表示する。

表示内容は主に以下。

- `SURVIVED` / `FAILED`
- 残り🔥
- 解決戦闘数
- 総🔥損害

しかし結果表示後に、

- `settleTrialResult()` を呼ぶボタン
- `canExitTrial` を読む処理
- Settlement後にTrialを終了する操作

は確認できない。

`btnTrialCompleteTrial` が呼ぶのは `UIController.completeTrial()` であり、これは `trialController.completeTrial()` のみを実行する。

したがって通常UIフローは現在、

```text
Battle / Traversal
  ↓
Aggregated HQ Damage
  ↓
completeTrial()
  ↓
RESULT / 結果バナー表示
  ↓
[ここでUI導線が停止]
```

となる。

一方、Domainには別途、

```text
settleTrialResult()
  ↓
Chronicle
  ↓
RunTermination確認
  ↓
TRIAL_EXIT_READY
```

が存在する。

---

## 3. 分類

| 項目 | 分類 |
| :--- | :---: |
| Trial Completion | **実装済み / UI接続済み** |
| Trial結果表示 | **実装済み / UI接続済み** |
| Trial Settlement API | **実装済み** |
| Settlement → Chronicle | **実装済みAPI** |
| FAILED → RunTermination | **実装済みAPI** |
| 通常UI → Settlement呼び出し | **PARTIAL / 未接続** |
| Settlement後のTrial退出UI | **PARTIAL / 未接続** |
| Settlement → Stage遷移 | **RULES_AHEAD / 未接続** |
| Settlement → 第3Trial Victory | **RULES_AHEAD / 未接続** |

---

## 4. 注意

「Settlement Serviceが存在する」ことと「通常プレイヤーがSettlementまで到達できる」ことを混同しない。

現状は、

> **Domain/APIはCompletionより先へ進んでいるが、通常UIはCompletion結果表示で止まる。**

という状態である。

本監査では `game/` を変更しない。
