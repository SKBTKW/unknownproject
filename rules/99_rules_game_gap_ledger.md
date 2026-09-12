# 99. Rules ↔ Game 齟齬台帳

> **Status:** Audit Ledger / Non-Authority
>
> 本文書は、`rules/` と `game/` の間で確認済みの齟齬・未接続・Legacy残存・内部実装不一致を一元管理するための台帳である。
> **本文書そのものをゲームルールの正本にはしない。**
> 正しいルールは各専門文書を参照する。
>
> 目的は、
>
> - rulesが現行設計でgameが古い
> - gameが現行挙動でrulesが古い
> - 部分実装
> - Legacy残存
> - game内部のデータ重複 / 不一致
>
> を混同せず追跡すること。

---

## 1. 分類

| ラベル | 意味 |
| :--- | :--- |
| **RULES_AHEAD** | rulesが現行設計。gameが古い / 未接続。 |
| **GAME_AHEAD** | gameが現行実態。rulesが古かったためrulesを更新済み、または更新対象。 |
| **PARTIAL** | データ・フラグ・UI・一部処理のみ存在し、最終効果まで接続されていない。 |
| **LEGACY** | 現行設計から外れた旧コード / 旧UIが残っている。 |
| **INTERNAL_CONFLICT** | game内部の複数データ源・処理系が互いに一致していない。 |
| **UNRESOLVED** | どちらを正とするか未決定。 |

---

## 2. Run / Verse / Stage

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| Stage 1→2 | **RULES_AHEAD** | 第1 Trial完了後に5×5→7×7 | `currentTurn >= trialSchedule.trial1` で自動拡張 | Trial完了結果と未接続 |
| Stage 2→3 | **RULES_AHEAD** | 第2 Trial完了後に7×7→9×9 | `currentTurn >= trialSchedule.trial2` で自動拡張 | Trial完了結果と未接続 |
| 50 Verse完走 | **RULES_AHEAD** | Verse 50終了時、🔥>0なら完走 | `nextTurn()` に50 Verse終端なし | Verse 51以降へ進行可能 |
| Verse表記 | **PARTIAL** | プレイヤー向けはVerse | 内部識別子・多くの状態名は`turn` | 互換名として許容中 |

参照: `01_overall_concept.md`, `05_trials_and_defense.md`

---

## 3. Trial通常ラン統合

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| Trial自動起動 | **RULES_AHEAD** | 通常ラン中に3回発生 | 通常Verse Lifecycleから`TrialController`を起動する配線なし | dev Previewが主入口 |
| Trial Scenario生成 | **PARTIAL** | 実盤面・脅威・侵入方向からTrialを構成 | `TrialController`は完成scenarioを受け取るだけ | dev scenarioは手書き |
| 敵戦略制圧力算出 | **PARTIAL** | 人類の発展規模等から決定 | `InterceptionPowerResolver`は与えられたsuppressionを戦闘尺度へ変換するだけ | 元値生成なし |
| route生成 | **PARTIAL** | 実盤面上の侵攻routeを使用 | routeはscenario入力として与える | 通常盤面からの生成未接続 |
| SKIP route | **PARTIAL** | 見送った戦線も最終的に解決 | SKIPがあるとCompletion安全ゲートで停止 | 進軍 / 損害処理未完成 |
| Trial完了→Stage | **RULES_AHEAD** | Trial結果を受けて次Stageへ | Stage遷移は予定Verse依存 | 未接続 |

Trial内部の迎撃計画・基礎戦闘・進軍・HQ Damage・Completionは実装済み部分が多い。

参照: `05_trials_and_defense.md`

---

## 4. Trial接近 / Alert / UI

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| 正確な残りVerse表示 | **LEGACY** | 原則表示しない | `TopHeaderComponent` が残り1〜5を数値表示 | 削除 / 置換対象 |
| 第1 Trial前固定異変 | **RULES_AHEAD** | 必ず脅威認識イベントを発生 | 強制トリガーなし | 未実装 |
| 調査・情報カテゴリ解禁 | **RULES_AHEAD** | 固定異変後に解禁 | 独立カテゴリとして未完成 | 未実装 |
| 警戒状態Presentation | **RULES_AHEAD** | 画面・音・Advisor・環境変化で表現 | 専用進行未接続 | 未実装 |
| 亜人襲撃 / 斥候イベント | **PARTIAL** | 第1 Trial以後の脅威表現に利用可能 | 定義あり、`effects: []` | 効果未実装 |

参照: `10_global_events.md`

---

## 5. Resources / Ember / Defense

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| 食料維持費 | **GAME_AHEAD** | 現在15 / 20 / 25へ同期済み | Ember状態に応じ15 / 20 / 25 | 一致 |
| 旺盛補正 | **GAME_AHEAD** | Production×1.10、✨+2へ同期済み | 実装済み | 一致 |
| 食料不足補填 | **GAME_AHEAD** | ✨1=🌾6、🧱5=🌾1へ同期済み | 実装済み | 一致 |
| 土地開発🔥コスト | **GAME_AHEAD** | 0〜5:0 / 6〜15:1 / 16〜30:2 / 31+:3へ同期済み | 実装済み | 旧rulesの一律🔥1は修正済み |
| 🛡️ current / max | **GAME_AHEAD** | 分離を正本化済み | `currentDefense` / `maxDefense` | 一致 |
| 防衛再建コスト | **PARTIAL** | 具体値未確定 | APIあり、cost resolver未注入 | `REBUILD_COST_UNDEFINED` |

参照: `02_resources_and_ember.md`, `05_trials_and_defense.md`

---

## 6. Land / Terrain / Production

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| 通常土地の実産出SSOT | **GAME_AHEAD** | `LAND_CARDS_MASTER`優先へ同期済み | 配置カードobjectを`cell.terrain`へ保持しProductionCalculatorが読む | 一致 |
| 砂漠産出 | **INTERNAL_CONFLICT** | 通常配置は✨5/Tとして記録 | `LAND_CARDS_MASTER`は✨5、`TERRAIN_MATRIX.GL0_DESERT`は✨2 | game内部重複不一致 |
| 地形データ重複 | **INTERNAL_CONFLICT** | カードruntimeと地形parameterを役割分離して記録 | `land_system.js` と land card data に重複値 | 統合余地あり |
| 干拓地 | **GAME_AHEAD** | E1/GL1、🌾4🧱1へ同期済み | 実装済み | 一致 |
| standalone探索 | **LEGACY** | 現行中核から廃止 | `executeExploration()` 等が残存 | 整理対象 |
| `CMD_LAND_EXPLORATION` | **LEGACY** | standalone探索は廃止 | 旧分岐が残存 | 整理対象 |

参照: `03_land_system/01_land_base.md`, `03_land_system/04_exploration_system.md`, `09_cards/01_land_cards.md`

---

## 7. Zone / Link

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| 2×2地帯化 | **GAME_AHEAD** | 実装値へ同期済み | 実装済み | 一致 |
| 丘陵L字 | **GAME_AHEAD** | 隠匿鉱床まで同期済み | 実装済み | Trial専用戦術は未接続 |
| 山岳T字 | **GAME_AHEAD** | 主峰砦まで同期済み | 実装済み | Trial専用戦術は未接続 |
| 地帯1.2倍 | **GAME_AHEAD** | 土地産出×1.2、socketは外加算へ修正済み | ProductionCalculator実装と一致 | 一致 |
| 連携🔥効果 | **GAME_AHEAD** | 1連携につき現在🔥+1 / max🔥+1へ同期済み | 実装済み | 一致 |
| 連携→Trial多方面能力 | **PARTIAL** | 上位設計あり | Trial Planningへ制約未接続 | 未実装 |
| 専用地帯グラフィック | **PARTIAL** | Presentation候補 | 一括専用sprite置換は未確認 | 未接続 |
| 中央穴埋めボーナス | **PARTIAL** | 旧/先行仕様に存在 | 実装確認なし | 現行正本から除外済み |

参照: `03_land_system/03_merge_system.md`

---

## 8. Outpost / Special Blocks

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| Outpost本体 | **RULES_AHEAD** | 採用構想 / Planned | 独立Outpost建設systemなし | 未実装 |
| 城市化 / 3タイプ | **PARTIAL** | 旧確定扱いをPlannedへ降格済み | 実装なし | 未実装 |
| `CMD_OUTPOST_SIGNAL` | **PARTIAL** | 情報系効果を想定 | flagのみ | Trial情報へ未接続 |
| 干拓地 | **GAME_AHEAD** | 特殊改良地形として同期済み | 実装済み | 一致 |
| 経済施設群 | **PARTIAL** | カードごとの意図を保持 | counter / flagのみのもの多数 | Production等へ未接続 |

参照: `03_land_system/02_outpost_system.md`, `03_land_system/05_special_blocks.md`, `09_cards/02_economy_cards.md`

---

## 9. Offering / Command action

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| Card Cycle | **GAME_AHEAD** | cooldown / UNIQUE / fallbackへ同期済み | 実装済み | 一致 |
| Hold中のcooldown経過 | **GAME_AHEAD** | 独立進行へ同期済み | 実装済み | 一致 |
| Command使用と土地開発権 | **RULES_AHEAD** | Commandは通常の土地開発権を消費しない方針 | Command使用後`hasPickedThisTurn=true`となり土地配置が拒否される | 明確な齟齬 |
| 複数Command使用 | **INTERNAL_CONFLICT / RULES_AHEAD** | コストを払える限り複数Command使用可 | `DeckManager.playCommandCard()`は2枚目を事前拒否しないが、`HandCardsComponent`は1枚目使用後に全カードをlocked | 通常UIでは複数Command不可 |

参照: `04_draw_and_hand_system.md`

---

## 10. Economy Cards

詳細は `09_cards/02_economy_cards.md` を正本とし、この台帳では代表的齟齬だけ記録する。

| カード / 項目 | 分類 | 現game差分 |
| :--- | :---: | :--- |
| Rationing | **GAME_AHEAD** | 旧40%軽減ではなく現在50%軽減 |
| Logging Camp | **PARTIAL** | 即時🧱+8のみ。継続産出未接続 |
| Granary | **PARTIAL** | `granaryCount`のみ。維持費軽減未接続 |
| Agricultural Reform | **GAME_AHEAD / Different** | 指定区域ではなく全平地系へ恒久+1/T |
| Pastoral Farm | **PARTIAL** | 即時🌾+2中心。持続施設効果未接続 |
| Emergency Levy | **GAME_AHEAD / Different** | 旧次Verse維持費+5ペナルティなし |
| Stage2施設群 | **PARTIAL** | counter / immediate reward止まり多数 |
| Stage3国家事業 | **PARTIAL** | card data / flagは存在、最終効果未接続多数 |

---

## 11. Military Cards

詳細は `09_cards/03_military_cards.md`。

| カード / 項目 | 分類 | 現game差分 |
| :--- | :---: | :--- |
| Vigilance | **GAME_AHEAD / Different** | 現在は最大🛡️計算へ+3。旧「取得ごと+3」ではない |
| Mud Obstacle | **PARTIAL** | flagはあるがTrial Terrain Resolver未参照 |
| High Ground Formation | **PARTIAL** | flagはあるが高低差Resolver未接続 |
| Outpost Signal | **PARTIAL** | flagのみ |
| Iron Rampart | **GAME_AHEAD / Different** | 最大🛡️容量+25 + 本営近郊恒久+2/マス |
| Ballista Set | **PARTIAL** | max🛡️+40は有効、50%HQ損害軽減は未接続 |
| Guided Defense | **PARTIAL** | route cost未接続 |
| Scout Enemy | **PARTIAL** | flagのみ。旧2D6情報品質なし |
| その他Trial軍事カード | **PARTIAL** | flag登録止まり多数 |

---

## 12. Mystic Cards

詳細は `09_cards/04_mystic_cards.md`。

| カード / 項目 | 分類 | 現game差分 |
| :--- | :---: | :--- |
| Meditation | **GAME_AHEAD / Different** | 即時✨+3 + LAND bias。旧「土地を置かなかった場合」条件なし |
| Fill the Void | **PARTIAL** | command cost補填未接続 |
| Voice Beneath Earth | **PARTIAL** | Offering resource-tag操作未接続 |
| Omen Dream | **PARTIAL** | Trial情報へ未接続 |
| Manifest Miracle | **PARTIAL** | command cost✨代替未接続 |
| Transmute Golden | **PARTIAL / Broken path** | `targetTile`が通常action pathから渡らず、fallback✨+10が発生し得る |
| Revelation Choice | **PARTIAL** | category選択Offering未接続 |
| Leyline Resonance | **PARTIAL** | 補填拡張未接続 |
| Two Futures | **PARTIAL** | Offering二択生成未接続 |

---

## 13. Roles / Directives

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| Leader Role具体効果 | **RULES_AHEAD** | 方向性のみ正本、具体値TBD | 旧固定ロール効果は現行正本として未接続 | 実装未完成 |
| Directive | **LEGACY / DORMANT** | Dormant扱い | 旧データは残るが倍率getterはneutral値 | 実効停止中 |
| Advisor性能差 | **一致** | 見た目・性別と性能を分離 | 現UI基盤に性能差なし | 問題なし |

参照: `06_leader_roles.md`, `08_directives_and_policy.md`

---

## 14. Dice / Check

| 項目 | 分類 | rules | 現game | 状態 |
| :--- | :---: | :--- | :--- | :--- |
| 2D6基盤 | **GAME_AHEAD** | CheckSystemへ同期済み | 実装済み | 一致 |
| `ResolutionRule=sum` | **一致** | Implemented | 実装済み | 一致 |
| highest / lowest / success_count | **PARTIAL** | Planned extensibility | `resolveDefinition()`はsum以外拒否 | 未実装 |
| standalone探索2D6 | **LEGACY** | 廃止 | 旧実行経路が残る | 整理対象 |

参照: `11_dice_check_contract.md`

---

## 15. game内部の主な重複 / 技術的齟齬

以下はrulesとgameの差分というより、game内部で確認済みの不一致。

1. **土地産出データの二重化**
   - `land_system.js`
   - `land_cards_data.js`
   - 通常配置では後者が実産出へ優先される。

2. **砂漠産出値の不一致**
   - Terrain Matrix: ✨2
   - 通常土地カード: ✨5

3. **Command選択フラグの責務不一致**
   - `DeckManager.playCommandCard()` は1枚目使用後に `hasPickedThisTurn = true` を設定する。
   - 同メソッド自体は次のCommand呼び出しでこのフラグを拒否しない。
   - `HandCardsComponent` は同フラグを全カード共通lockとして扱う。
   - そのためAPIと通常UIで「複数Command可能か」の挙動が一致しない。

4. **古い探索系コード残存**
   - `executeExploration()`
   - `CMD_LAND_EXPLORATION`
   - `cell.searched`
   - legacy check definition / UI参照の可能性

5. **カード効果の巨大分岐**
   - `DeckManager.playCommandCard()` に多数の部分実装効果が集中し、flagだけ立つ効果と本実装済み効果が混在する。

6. **Trialと通常ランの状態分離**
   - Trialは独立`TrialState`へコピーして進行するが、通常GameStateとの開始 / 完了境界が未統合。

---

## 16. 監査済みrules

現時点で実装突合を実施済み、または状態分類済みの主要文書：

- `00_master_handover_specification.md`
- `01_overall_concept.md`
- `02_resources_and_ember.md`
- `03_land_system/README.md`
- `03_land_system/01_land_base.md`
- `03_land_system/02_outpost_system.md`
- `03_land_system/03_merge_system.md`
- `03_land_system/04_exploration_system.md`
- `03_land_system/05_special_blocks.md`
- `04_draw_and_hand_system.md`
- `05_trials_and_defense.md`
- `06_leader_roles.md`
- `07_mysticism_and_desert.md`
- `08_directives_and_policy.md`
- `09_cards/README.md`
- `09_cards/01_land_cards.md`
- `09_cards/02_economy_cards.md`
- `09_cards/03_military_cards.md`
- `09_cards/04_mystic_cards.md`
- `10_global_events.md`
- `11_dice_check_contract.md`

---

## 17. この台帳の保守ルール

- 新しい設計案はここへ書かない。
- rules↔game差分だけを書く。
- 差分が解消した場合は削除せず、必要なら「Resolved」へ移して履歴を残す。
- 個別ルールの正解を変更する場合は、必ず専門文書側を先に更新する。
- gameを変更しただけでrulesが自動的に正本変更されたとは扱わない。
- 未確認事項を推測で齟齬扱いしない。
