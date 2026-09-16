# AGtest260913 プロジェクト調査メモ

調査日: 2026-09-13 / 対象コミット: `bbb3bb7` / ブランチ: `AGtest260913`

この文書は調査記録であり、ゲーム仕様の正本ではない。構成・主要実行経路・専門仕様・既知差分台帳・テストを確認した。全ファイルの全行レビュー、全カードの実プレイ、画像・音声全素材の品質検査、実ブラウザー描画検証を完了したという意味ではない。

## 1. どのようなプロジェクトか

『The Age of Trials: The Last Ember』という、シングルプレイヤーの箱庭内政パズル＋カードストラテジー＋ローグライト。タイトルは旧文書・HTMLで表記揺れがある。

プレイヤーは毎Verseに提示されるカードから土地を配置・開発し、食料・資材・防衛・神秘と生存資源の残火を管理する。土地の形状、標高E、繁茂度GL、地帯化、異属性地帯間の連携、水源・ソケットが盤面形成を意味のある選択にする。

設計上は50Verseの間に3回のTrialを迎え、生き延びる。中心となる体験は「平時に作った盤面を、侵攻に対する防衛へどう生かすか」。敵軍を迎撃する経路・地点を選び、有限の現在防衛力を各戦線へ配る。

ランダムな災害で土地を一方的に永久消滅させることを難易度の主軸にせず、選択の優先順位や何を守るかを問う設計。周回による基礎能力の恒久的底上げも主軸にしない。

根拠: `rules/00_master_handover_specification.md`, `rules/01_overall_concept.md`, 各専門仕様。

## 2. リポジトリの区分

| 場所 | 実際の役割 |
| --- | --- |
| `game/` | 現在のブラウザーゲーム本体。HTML/CSSとネイティブJavaScript ES Modules |
| `rules/` | 設計意図、採用ルール、実装状態。専門文書を優先して読む |
| `scratch/` | Node/Pythonテスト、静的検査、ローカルサーバー、診断用スクリプト |
| `scratch/backup_snapshots/` | 過去時点のソース・素材一式。現役コードとは区別する |
| `archive_legacy/` | 旧ゲーム・旧UI・旧データの保管 |
| `trial of ages/` | Vite＋TypeScriptの初期テンプレート。`main.ts`はロゴ・カウンターのサンプルで、本体ではない |
| `.github/workflows/` | `AGtest*`へのpush等で`game/`をGitHub Pagesへ配置する定義 |
| `PLAYTEST.bat` | Pythonのローカルサーバーを起動しブラウザーを開く入口 |

`game/task.md`は8スロット型盤面や旧兵士戦闘など過去構成のタスクリストであり、現行進捗の根拠にしない。`rules/README.md`にも旧数値・説明が残っており、目次だけから仕様を断定しない。

調査時点で`game/src/`には120本のJSと5本のJSON、`scratch/`直下には71本の`test_*.mjs`がある。カードJSONは土地23・経済23・軍事14・神秘11件。これは定義件数であり、全効果の完成件数ではない。

## 3. 起動と責務分担

実ブラウザーの入口は`game/index.html`。`app.js`がモジュールを集約し、HTMLのbootstrapが`GameEngine`と`UIController`を生成する。

```text
index.html
  → app.js（集約export）
  → GameEngine.createGame({ GameStateClass: BrowserGameState })
      → BrowserGameState → PlatformNeutralGameState → 既存GameState
      → 各ゲームシステム
  → UIController
  → attachTrialActionTray
      → attachTrialRouteBoardSelection
  → ui.init()
```

| 領域 | 主な責務・実装 |
| --- | --- |
| 状態と進行 | `core/game_engine.js`, `v2_unity_ready_main.js`, `core/turn_lifecycle_service.js` |
| 土地配置・地帯・連携 | `systems/grid_engine.js`, `core/placement_geometry.js`, `core/merge_rules.js`, `core/lake_rules.js` |
| 経済・残火・防衛 | `production_calculator.js`, `maintenance_fallback_system.js`, `ember_system.js`, `defense_system.js` |
| カード | `deck_manager.js`, `card_cycle_system.js`, `data/*cards*.json`, 生成JS master |
| イベント・記録 | `global_event_system.js`, `chronicle_system.js`, `core/game_fact.js` |
| Undo・復元 | `transaction_manager.js`, `state_serializer.js`, `hydrate_game_state.js`, `history_snapshot_service.js`, `history_restore_service.js` |
| 乱数・判定 | `gameplay_random_service.js`, `world_initialization_service.js`, `core/check_system/` |
| Trial | `trial/domain/`, `trial/flow/`, `trial/systems/`, `trial/presentation/` |
| 表示・操作 | `ui/`, `ui/advisor/`, `ui/layout_config.js`, `ui/layout_state_manager.js` |
| 音・文言 | `audio/`, `i18n.js` |

Unity/C#への移植を意識して、純粋なロジックとDOM表示を分離している途中。Unityプロジェクトが本体として存在するわけではない。ブラウザー初期化は中立化したアダプターを使うが、旧GameStateの継承やグローバル互換経路が残る。

ゲーム本体の起動にViteビルドは必要ない。Pythonサーバーは静的ファイル配信とGitブランチ・コミット表示用メタデータを担う。確認した本体構成に、アカウント・対戦サーバー・業務DBを中心とするバックエンドはない。

## 4. 現行のゲームループ

1. 原則3枚のOfferingを生成。Stage、資源、盤面、使用済みUNIQUE、Cooldown、発動中効果等で候補を絞り、重み付き抽選する。
2. 土地の形状を回転・配置し、接続と全隣接辺の合法性を検証する。通常の土地開発は1Verseに1回。
3. 地帯化・連携・ソケット開花・水源などの派生効果を処理する。Holdは原則1枠、Mulliganは基本残火1。
4. Verse終了時に総産出を加算し、維持費と食料不足補填、残火変動、イベント継続等を処理する。
5. 年代記・スナップショットを確定し、次Verseの状態とOfferingを初期化する。

初期主要資源は残火20、食料50、資材30、現在防衛10、神秘0。残火の状態に応じ食料維持費は15/20/25。食料不足は神秘、資材の順で、完全に補填できる場合だけ自動消費する。

地帯は2×2、丘陵L字、山岳T字等。地帯土地の食料・資材・神秘産出は1.2倍で、ソケットは外加算。異属性地帯同士の連携は残火現在値・最大値を増やす。

注意: 「コマンドはコストが払える限り複数使え、土地開発権と分離する」という設計に対し、現行UIは最初の使用で`hasPickedThisTurn`を全カード共通ロックにする。`DeckManager`のコマンドAPIとUIの制約も一致しない。

## 5. Trialの到達点と未接続部分

実装にはシナリオ受け取り、侵攻routeごとの迎撃地点選択、防衛配分、計画確定、戦闘順序、撃退・突破・同値判定、敵進軍、本営残火損害、完了判定の機構がある。地形効果として森の展開制限、高低差、湿原・砂漠からの進出補正等を計算する。

ただし次は未完成または未接続。

- 通常Verseから予定時期にTrialを自動生成・起動する処理。
- 実盤面から敵戦略制圧力、侵入方向、侵攻routeを生成する本番用上流処理。
- Trial終了結果に基づくStage解禁。現状は予定Verse到達だけで5×5→7×7→9×9へ拡張する。
- 50Verse終了時のラン勝利終端。通常`advance()`は次Verseへ進む。
- `SKIP`戦線の進軍・損害解決。現在は`UNRESOLVED_SKIPPED_ROUTE`でTrial完了を止める。
- 平時カードの軍事準備flagや連携をTrialへ引き渡す正式境界。
- 防衛再建の正式コスト、調査カテゴリ解禁、初回Trial前の固定異変等。

主検証入口は`DevelopmentTrialPreviewHarness`。Trial開始時に通常状態から現在防衛・残火等をコピーする経路はある。`UIController`は通常の`EmberSystem`をTrial側へ接続できるため、試練が完全に隔離された無影響のプレビューとも言えない。開始・完了の両方向の境界を整理する必要がある。

直近のコミットは、Trial Action Trayへの配分操作移動、侵入地点マーカーによる盤面上のroute選択、初期盤面生成の決定論的境界への移行を含む。古い「Phase 2.6」記述だけで開発段階を判断しない。

## 6. ① 懸念点・リスク

- **ラン全体の接続不足:** 個々の機構の存在と、3Trialを通して完走できることは別。予定VerseでStageが進むことをTrial成功と取り違えない。
- **テストの登録漏れ・陳腐化:** 6層パイプラインが緑でも、Phase 2.8や新しいTray/route契約テストはそこに含まれていない。
- **データの重複:** 砂漠は`TERRAIN_MATRIX`で神秘2、通常カードで神秘5。Productionは配置カードの値を読む。旧`card_database.js`も現役masterとして使わない。
- **部分実装カード:** 穀物庫のcounter、弩砲の次Trial損害軽減flag等、状態登録と最終効果の接続を分けて読む。データ・説明があるだけで機能完成とはしない。
- **責務の集中:** `UIController`、`DeckManager`、`GridEngine`は大きい。中立化・分離の方針はあるが、旧状態クラス・DOM互換・巨大なカード分岐が残る。
- **文書の時代差:** 目次や旧タスクリストと専門仕様が異なる。湖と地帯化なども、参加判定と産出倍率対象を区別してコードを読む必要がある。

## 7. ② 対応策・今後の読み方

仕様判断は専門文書、実挙動判断は呼出経路とテストを優先する。既存の`99_rules_game_gap_ledger.md`と`99_trial_integration_boundary_audit.md`は有用だが、監査台帳自体をルール正本にしない。

今後の候補順序は、まず現在のUI構成に合ったテスト基盤と統合パイプラインの対象範囲を整え、そのうえでTrialの入力・結果反映・Stage・完走境界を段階的に接続すること。これは調査に基づく提案で、今回の調査で仕様変更や実装を開始したものではない。

カード修正時はJSONと実際にimportされる生成JSの両方、盤面修正時は地形・ソケット・地帯互換・Trial分類・見た目の責務を確認する。乱数を使う変更ではGameplay RNGとCheck RNGの復元可能性を維持する。

## 8. 実行した検証

Node v24.18.0 / Python 3.11.3。Git fetch後、対象コミットとリモートの同期を確認。

### 6層統合パイプライン

`node scratch/run_full_inspection.mjs`: **PASS（17.34秒）**。

- 静的lint: 新規違反0。既存負債としてCSS `!important` 322、Legacy DOM参照6、Legacy I18N 120を報告。違反が全く存在しないという意味ではない。
- CSS移設契約: 12/12 PASS。
- 自動仕様アサーション: 6/6 PASS。全仕様の網羅的照合ではない。
- 基本モジュール: 341/341 PASS。
- UIライフサイクル: 188 PASS / 0 FAIL。自作Mock DOMであり、実ブラウザー検証ではない。
- パイプライン登録済みの履歴復元・乱数・Trial・Advisor・経済決済等も完走。

初回はGitのsafe.directory設定へWindows形式のパスを渡したため、子プロセス内の`git show`が停止した。スラッシュ形式の同一絶対パスをプロセス限定のGit設定へ指定して再実行し、上記PASSを得た。グローバル設定や本体コードは変更していない。

### パイプライン外の追加12スクリプト

| 対象 | 結果 | 読み取れること |
| --- | --- | --- |
| `test_trial_phase28a`～`28g`（7本） | 全てexit 1 | UI初期化中、Mock DOM要素に`dataset`がなく`contextOwner`設定でTypeError。戦闘本体の成否まで到達していない |
| `test_trial_route_board_selection_contract.mjs` | exit 1 | テストの期待CSS文字列`.trial-route-list .trial-route-item`と実装の`.trial-defense-allocation-panel .trial-route-item`が異なる。操作不能の実証ではない |
| `test_trial_action_tray_contract.mjs` | exit 1 | 旧bootstrapの`new TrialActionTrayComponent(ui)`を期待。現行は`attachTrialActionTray(ui)`経由。構成変更にテストが追従していない |
| `test_trial_action_tray_runtime.mjs` | 8/8 PASS | runtime bridgeの契約 |
| `test_game_state_grid_rng_routing.mjs` | 4/4 PASS | 盤面初期化・拡張乱数経路 |
| `test_global_event_gameplay_rng.mjs` | 4/4 PASS | イベント抽選乱数経路 |

追加分は3スクリプト完走、9スクリプト失敗。失敗後の各スクリプト内の未実行アサーションは未検証。原因の切り分けまで実施し、今回の依頼範囲では修正していない。

実ブラウザー操作、スマートフォン描画、実音声、GitHub Actionsの稼働実績、50Verse通しプレイは未検証。

## 9. ③ 総括判定

内政パズル、カード循環、経済、地形と迎撃計画、履歴・乱数復元を備える開発中プロトタイプ。次の作業では「新規に仕組みを作る」前に、既存機構を通常ランへつなぐ境界と現在のテスト対象範囲を確認すべき段階にある。

この調査でゲームコード・仕様・Git履歴は変更していない。追加物は本調査メモのみ。
