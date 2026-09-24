# 99-A. Trial通常ラン統合境界 監査メモ

> **Status:** Audit Appendix / Non-Authority
>
> Trial正本は `05_trials_and_defense.md`。本書は通常GameStateとTrialStateの接続状況だけを記録する。

## 1. 現在の結論

現在のTrialは、

> **入口は部分接続、戦闘〜HQ損害はかなり実装済み、通常ランへの出口はまだ部分接続**

という状態。

## 2. 通常GameState → Trial

現在確認できる主な受け渡しは以下。

- 盤面 → `cellResolver`
- `currentDefense` → `availableDefense`
- `ember / maxEmber` → Trial state
- 通常GameStateの `EmberSystem` → TrialControllerへ参照注入

一方、通常runから本番Trial scenarioを生成する正式な `ScenarioFactory / RouteGenerator / ThreatCalculator` は確認できない。

未生成の主要入力:

- 敵戦略制圧力
- 侵攻route
- 侵入方向
- route別制圧力
- commander / forces / environment の本番組立

`mergeLinks` もTrial入力へ未接続。

## 3. retired Trial予約カード

以前Trial未接続として追っていた以下の予約効果カード群は、現在 `CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` により通常Offeringへ戻らない。

Mud Obstacle / High Ground Formation / Cavalry Scouts / Outpost Signal / Ballista Set / Guided Defense / Scout Enemy / Scorched Retreat / Cavalry Host / Local Iron Armament / Omen Dream / Stone Strongpoint / Great Rampart Project / Outpost

したがって、これらは現役Trial統合要件ではなく **LEGACY / RETIRED** と扱う。

`nextTrialDamageMitigation` と `nextTrialMultiplier` もGameState初期fieldは残るが、現在のStateSerializerでは保存しない。診断テストでも非serialize境界が固定されている。

分類: **LEGACY / 非永続化**

## 4. 🛡️と🔥の境界

Deployment Economyが有効な正規Commitでは、配備した🛡️をTrial-local `state.human.availableDefense` だけでなく、GameEngine facade経由で通常GameStateの `currentDefense` にもwrite-throughする。

- Previewでは`currentDefense`を変更しない。
- Commit直前に通常GameState側の残量を再検証する。
- Commit成功時だけ`currentDefense`を減らす。
- 🌾・🧱支払いに失敗した場合、🛡️予約を内部rollbackして部分Commitを残さない。

HQ損害も従来通り `EmberSystem.applyDamage()` を通じて通常GameStateへ反映される。

したがって、Deployment Economy有効経路では🛡️・🔥とも通常GameStateへwrite-throughする。

GameEngineには明示的な`trialDeploymentEconomy`設定を受け取ってDeployment Economyをattachする接続口がある。設定なしでは従来通り未attach、RESOLVEDなcost profile / resolverを明示した場合だけ有効化される。

ただし正規Deployment Cost profileは未確定なので、製品通常ランではまだ常時有効化していない。このため「🛡️write-through経路とEngine接続口は実装済み」だが、「製品バランス込みで有効化済み」とは扱わない。

## 5. SKIP / 突破 / HQ損害

現在は以下まで実装済み。

- SKIP route → route終端まで自動解決
- REPEL → 迎撃地点で停止
- REPEL以外 → 残りrouteを全進行してHQ到達
- SKIPと突破routeの到達制圧力を全て集約
- `ceil(totalSourcePower / 5)` を1回だけ適用して🔥損害化
- 未完了battle / traversal / HQ damage状態ではCompletionを拒否

## 6. Completion / Settlement

`completeTrial()` は結果payloadを作り、TrialをRESULTへ進める。

さらに `settleTrialResult()` APIがあり、明示呼び出し時には以下を処理できる。

- SURVIVED / FAILED検証
- FAILED時のRunTermination確認
- ChronicleへのTrial結果記録
- `TRIAL_RESULT_SETTLED`
- `TRIAL_EXIT_READY`

ただし通常UIのTrial完了操作は `completeTrial()` までで、Settlementを自動実行しない。

したがって、

> **Settlement APIは実装済みだが通常UI未接続。**

## 7. 未接続の主要出口

現在も未接続:

- Trial完了→Stage遷移
- 第3Trial→Run Victory
- Settlement後の通常UI退出導線

## 8. Development Preview

開発Previewは通常GameStateのEmberSystemを注入する一方、終了時に資源snapshotを戻す処理は確認できない。

Preview中のHQ損害が通常GameStateへ残る可能性がある。

分類: **INTERNAL_CONFLICT / dev integration leak candidate**

## 9. 分類表

| 項目 | 分類 |
| :--- | :---: |
| 通常run→Trial scenario生成 | **PARTIAL / 未実装** |
| 連携→Trial | **PARTIAL** |
| 旧Trial予約カード群 | **LEGACY / RETIRED** |
| nextTrial modifier fields | **LEGACY / 非永続化** |
| SKIP解決 | **実装済み** |
| 突破後HQ到達 | **実装済み** |
| HQ損害集約 | **実装済み** |
| Trial🔥損害→通常GameState | **実装済み** |
| Trial🔥0→RunTermination | **実装済み** |
| Trial🛡️消費→通常GameState | **PARTIAL / 未実装** |
| Settlement API | **実装済み** |
| 通常UI→Settlement | **PARTIAL / 未接続** |
| Trial完了→Stage | **RULES_AHEAD** |
| 第3Trial→Victory | **RULES_AHEAD** |
