# 99-A. Trial通常ラン統合境界 監査メモ

> **Status:** Audit Appendix / Non-Authority
>
> 本文書は `rules/` のゲームルール正本ではない。
> `game/` の現実装を読み、通常ラン `GameState` と `TrialState` の間で「何が既に接続され、何が未接続か」を監査した記録である。
>
> 正しいTrialルールは `05_trials_and_defense.md` を参照する。

---

## 1. 結論

現Trialは、通常ランから完全に独立しているわけでも、完全に統合されているわけでもない。

現在は、

> **通常GameState → Trial の入口は一部コピー、Trial → 通常GameState の出口は🔥がwrite-throughし、結果Settlement APIまで存在する半統合状態**

である。

ただし、Settlement APIは通常UIのTrial完了操作へ自動接続されていない。

---

## 2. Trial開始時に現在そのまま取得可能な情報

通常GameState側には以下が既に存在する。

| 情報 | 現在の取得元 | Trial側の器 | 状態 |
| :--- | :--- | :--- | :---: |
| Verse | `state.turn` | scenario外 | **取得可能** |
| Stage | `state.stage` | scenario外 | **取得可能** |
| 盤面セル | `state.grid` | `cellResolver` | **接続可能 / Preview接続済み** |
| 現在🛡️ | `state.currentDefense` | `availableDefense` | **Previewでコピー済み** |
| 🔥 | `state.ember` / `EmberSystem.current` | `ember` | **Previewでコピー済み** |
| max🔥 | `state.maxEmber` | `maxEmber` | **Previewでコピー済み** |
| ✨ | `state.mystic` | `mystic` | **器あり / 現Previewでは明示受け渡しなし** |
| 連携数 | `mergeLinks` / `getMergeLinkCount()` | 専用fieldなし | **GameStateには存在 / Trial未接続** |

`TrialState` は `availableDefense`, `ember`, `maxEmber`, `mystic` を保持できる。

---

## 3. 平時stateは存在するがTrialへ渡されていないもの

以下は、カード等の発動によって通常GameState上へ登録されるが、現在の `TrialController.startScenario()` / `TrialState` へ受け渡す正規境界がない。

代表例:

- `nextTrialDamageMitigation`
- `scoutEnemyActive`
- `outpostSignalActive`
- `omenDreamActive`
- `cavalryScoutsActive` 系
- `guidedDefenseActive` 系
- 高地 / 泥濘 / 騎馬 / 武装等の軍事準備flag
- 連携状態 `mergeLinks`
- その他「次のTrial」向け準備効果

したがって、これらは現状、

> **通常GameStateへ状態登録するところまで実装され、Trial開始時の入力へ変換する処理が未接続**

と分類する。

### `nextTrialDamageMitigation` の注意

- `GameState` に初期値 `1.0` を持つ。
- 《弩砲》で `0.5` を設定する。
- Save/Restore対象でもある。
- しかし現Trial HQ Damage Resolverへ渡されない。

よって、**永続化まで実装されたwrite-only gameplay state** になっている。

### `nextTrialMultiplier` の注意

- `GameState` に初期値 `1.0` がある。
- 旧 `LGD_DESPERATE_PACT` 分岐で `1.5` を設定するコードが残る。
- Save/Restore対象でもある。
- 現Trialは参照しない。
- 現行カードmasterに `LGD_DESPERATE_PACT` は存在しない。

現時点では **Legacy / Dormant candidate** として扱う。

---

## 4. そもそも本番生成ロジックが存在しない入力

`TrialState` は以下の情報を受ける器を持つが、通常ランから本番scenarioを組み立てる生成処理は確認できない。

| 入力 | Trial側 | 通常ラン生成 |
| :--- | :--- | :---: |
| 敵戦略制圧力 | `enemySuppression` | **未実装** |
| 侵攻route | `routes` | **未実装** |
| 侵入方向 | route座標列に内包可能 | **未実装** |
| route別制圧力 | route data | **未実装** |
| commander | `scenario.commander` | **本番組立未実装** |
| forces | `scenario.forces` | **本番組立未実装** |
| environment | `scenario.environment` | **本番組立未実装** |

現 `game/src/trial/` は、これらを**生成する側ではなく受け取って解決する側**である。

---

## 5. Trial内での🛡️消費

迎撃計画をActivateすると、

```text
TrialState.human.availableDefense -= totalDefenseAllocated
```

が実行される。

この処理はTrial-localであり、通常GameStateの `currentDefense` を減少させない。

したがって現状、

> **Trialで🛡️を使っても、本編GameState上の現在🛡️には消費結果がコミットされない。**

---

## 6. Trial内での🔥損害

本営到達時の🔥損害は挙動が異なる。

`TrialController` に通常GameStateの `EmberSystem` が注入されている場合、

```text
emberSystem.applyDamage(emberDamage)
```

が呼ばれる。

したがって、

> **🔥損害だけはTrial-localではなく、本編GameStateへ直接コミットし得る。**

現在は、🛡️と🔥で永続化境界が一致していない。

---

## 7. Development Trial Preview のstate leak

`UIController.startTrialInterceptionPreview()` は、通常GameStateの `emberSystem` を `TrialController` へ注入する。

一方、`DevelopmentTrialPreviewHarness.stop()` は通常GameStateの資源スナップショットを復元しない。

したがって現実装では、開発Preview中にHQ Damageを解決した場合、

> **Previewで受けた🔥損害が通常GameStateへ残る可能性がある。**

これは **INTERNAL_CONFLICT / dev integration leak** と分類する。

---

## 8. Trial完了・Settlementの現在地

`TrialController.completeTrial()` は、必要なら集約HQ Damageを先に解決し、その後Trial phaseを `RESULT` へ進め、`trialCompleted=true` と `result` を保存して `TRIAL_COMPLETED` GameFactをemitする。

さらに現在は `TrialController.settleTrialResult()` → `TrialResultSettlementService` が存在し、明示的に呼べば以下まで処理できる。

- `SURVIVED` / `FAILED` の結果検証
- `FAILED` 時の `RunTerminationService` 終端確認
- `ChronicleSystem` への `TRIAL_RESULT` 記録
- `TRIAL_RESULT_SETTLED` GameFact emit
- `TRIAL_EXIT_READY` GameFact emit

ただし通常UI側の `UIController.completeTrial()` は `trialController.completeTrial()` までしか呼ばず、その後 `settleTrialResult()` を自動実行しない。

したがって現在は、

> **Settlement API自体は実装済みだが、通常UIのTrial完了フローには未接続。**

と分類する。

またSettlement APIを明示呼び出しした場合でも、以下は未反映。

- Trialで消費した現在🛡️
- 「次のTrialまで / 次Trialで1回」系stateの消費・解除
- Trial番号 / 次Trial状態更新
- Stage遷移
- 第3Trial後のVictory / Run Complete

---

## 9. SKIP route とHQ到達集約

現在は `TrialSkippedRouteResolutionService` が存在し、`SKIP` を選択したrouteを迎撃なしでroute終端まで解決し、`skippedRouteResults` と `routeProgress` に `REACHED_END` を記録する。

HQ損害はrouteごとに個別変換せず、`TrialHqArrivalAggregationService` が、

- SKIP routeの到達制圧力
- INTERCEPT突破後にroute終端へ到達した残存制圧力

を集約してから損害変換へ渡す。

またINTERCEPT routeでは、

- `stopped=true` かつ `reachedRouteEnd=false` は正規の撃退・ゼロ到達
- `stopped=false` なのに `reachedRouteEnd=false` は未完了として `INCOMPLETE_DAMAGE`

となり、未完了進軍のままCompletionを通過できない。

したがって、以前の「SKIP routeが存在するとCompletion安全ゲートで停止する」という分類は現在は古い。

---

## 10. 現在の入口 / 出口マトリクス

```text
通常GameState
  │
  ├─ 盤面 ───────────────→ cellResolver            [接続可能]
  ├─ currentDefense ──────→ availableDefense        [コピー済み]
  ├─ ember / maxEmber ────→ Trial ember             [コピー済み]
  ├─ mystic ──────────────→ Trial mystic            [器あり / 未接続]
  ├─ military/intel flags ─X→                       [未接続]
  ├─ mergeLinks ──────────X→                       [未接続]
  │
  ├─ threat ──────────────?                         [生成処理なし]
  ├─ invasion direction ──?                         [生成処理なし]
  └─ routes ──────────────?                         [生成処理なし]

                    TrialController
                         │
                         ├─ 🛡️消費 ───→ Trial-local only
                         ├─ 🔥損害 ────→ GameState EmberSystemへ直接反映し得る
                         ├─ SKIP ──────→ route終端到達として解決・HQ集約対象
                         ├─ Completion → RESULT / result payload
                         └─ Settlement API
                              ├─ FAILED終端 / Chronicle / Exit Ready [明示呼出時]
                              └─ 通常UI completeTrial()からは未接続
```

---

## 11. 齟齬分類

| 項目 | 分類 |
| :--- | :---: |
| 通常run→Trial scenario組立 | **PARTIAL / 未実装** |
| 軍事・偵察準備stateのTrial受け渡し | **PARTIAL** |
| 連携→Trial能力 | **PARTIAL** |
| SKIP route解決 | **実装済み** |
| 未完了INTERCEPT traversalのCompletion阻止 | **実装済み** |
| 🛡️消費の通常GameState反映 | **PARTIAL / 未実装** |
| 🔥損害の通常GameState反映 | **実装済みだが他資源境界と非対称** |
| Trial Settlement API | **実装済み** |
| 通常UI完了→Settlement | **PARTIAL / 未接続** |
| Settlement→Chronicle | **API内実装済み / 通常UI未接続** |
| FAILED Trial→RunTermination | **API内実装済み / 通常UI未接続** |
| Trial完了→Stage | **RULES_AHEAD** |
| Trial完了→Run Victory | **RULES_AHEAD** |
| Trial完了→one-shot state消費 | **PARTIAL / 未実装** |
| Dev Preview終了時の資源復元 | **INTERNAL_CONFLICT / leak candidate** |
| `nextTrialDamageMitigation` | **PARTIAL / write-only** |
| `nextTrialMultiplier` | **LEGACY / dormant candidate** |

---

## 12. 監査上の注意

この文書は、通常ランTrial統合の新しい設計案を決めるものではない。

ここで確定しているのは現在の接続境界だけであり、統合方法・具体的な脅威式・route生成アルゴリズムは別途設計対象とする。
