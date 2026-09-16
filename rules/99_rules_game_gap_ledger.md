# 99. Rules ↔ Game 齟齬台帳

> **Status:** Audit Ledger / Non-Authority
>
> 現在も有効な `rules/` ↔ `game/` 差分だけを索引化する。
> 正しいゲームルールは各専門正本を参照する。

## 1. 分類

| ラベル | 意味 |
| :--- | :--- |
| **RULES_AHEAD** | rulesが現行設計。gameが未接続。 |
| **GAME_AHEAD** | gameが先行し、rules側説明が古い。 |
| **PARTIAL** | 一部だけ実装・接続済み。 |
| **LEGACY / RETIRED** | 現行Gameplayから外れた旧実装。 |
| **INTERNAL_CONFLICT** | game内部で責務・値・状態が不一致。 |

---

## 2. Run / Verse / Stage

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| Stage 1→2 / 2→3 | **RULES_AHEAD** | rulesはTrial完了後。gameは予定Verse到達で自動拡張。 |
| Verse 50 Victory | **RULES_AHEAD** | 完走判定値はあるが `RunTerminationService` にVictory outcomeがなく、ラン終端へ未接続。 |
| 🔥0 Defeat | **実装済み** | `RunTerminationService` がDEFEATを確定。Verse進行も停止。 |
| 🔥0になる通常Action | **PARTIAL** | Command / Mulligan / 土地開発の支払い直後には共通termination評価がなく、敗北確定が遅延し得る。 |

参照: `01_overall_concept.md`, `99_ember_action_boundary_audit.md`

---

## 3. Trial通常ラン統合

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| Trial自動起動 | **RULES_AHEAD** | 通常Verse Lifecycleから正規起動する配線なし。 |
| Scenario生成 | **PARTIAL / 未実装** | Trialは完成scenarioを受けて解決する側。Threat / Route / Direction生成なし。 |
| SKIP route | **実装済み** | route終端まで自動解決。 |
| INTERCEPT進軍 | **GAME_AHEAD** | REPELなら停止、非REPELなら残りrouteを全進行してHQ到達。旧「1段進行」説明は古い。 |
| HQ🔥損害 | **GAME_AHEAD** | 到達routeを全て合算後 `ceil(totalSourcePower / 5)` を1回適用。 |
| Trial🔥損害→GameState | **実装済み** | `EmberSystem.applyDamage()` へwrite-throughし、🔥0ならRunTermination評価。 |
| Trial🛡️消費→GameState | **PARTIAL** | Trial-local `availableDefense` のみ減少。通常 `currentDefense` へ未commit。 |
| Settlement API | **実装済み** | Chronicle / FAILED終端 / Exit ReadyまでAPIあり。 |
| 通常UI→Settlement | **PARTIAL** | UIはCompletion結果表示まで。Settlement / Trial退出導線未接続。 |
| Trial完了→Stage | **RULES_AHEAD** | 未接続。 |
| 第3Trial→Victory | **RULES_AHEAD** | 未接続。 |
| mergeLinks→Trial | **PARTIAL** | 平時stateは存在するがTrial入力へ未接続。 |

参照: `05_trials_and_defense.md`, `99_trial_integration_boundary_audit.md`, `99_trial_settlement_ui_gap_audit.md`, `99_trial_traversal_semantics_audit.md`, `99_trial_hq_damage_aggregation_audit.md`

---

## 4. retired Trial予約カード

旧「平時に仕込み、次Trialで発火する」予約カード群は現在 `CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` で通常Offeringから排除される。

代表:

- Mud Obstacle / High Ground Formation
- Cavalry Scouts / Outpost Signal
- Ballista Set / Guided Defense / Scout Enemy
- Scorched Retreat / Cavalry Host
- Local Iron Armament / Stone Strongpoint
- Omen Dream / Great Rampart Project / Outpost

これらを現役の「Trial未接続カード」として数えない。

`nextTrialDamageMitigation` / `nextTrialMultiplier` もGameState fieldは残るがSerializer / Hydratorから除外され、非永続化境界がテスト固定されている。

分類: **LEGACY / RETIRED**

参照: `09_cards/03_military_cards.md`, `99_legacy_command_branch_audit.md`

---

## 5. Offering / Action

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| Mulligan通常UI | **INTERNAL_CONFLICT** | `GameEngine.mulligan()` は存在しない `drawOffering()` を探し、🔥と使用権だけ消費して再抽選しない経路がある。 |
| Command後の土地開発 | **RULES_AHEAD** | rulesは別権利扱い。gameはCommandで `hasPickedThisTurn=true` となり土地配置を拒否。 |
| 複数Command | **INTERNAL_CONFLICT / RULES_AHEAD** | DeckManager APIは明示拒否しないがHand UIは1枚目後に全カードlock。 |
| Draw Bias | **INTERNAL_CONFLICT** | テーマではなく `category` 完全一致。Military / Mystic Focusがテーマ全体へ掛からない。 |

参照: `04_draw_and_hand_system.md`, `99_mulligan_runtime_gap_audit.md`, `99_card_eligibility_audit.md`

---

## 6. Card Eligibility

### Land

- 山岳カード: データは `reqE2`、runtimeは `reqE2HillsOnBoard` を見るため **KEY_MISMATCH**。
- 丘陵カウンタも `terrain.id` と `terrainId` の識別子差で正常集計できない可能性がある。
- その結果、山岳カードが合法配置先なしでOfferingへ出る死に札候補。

### Economy

未対応確認済み:

- `reqMinLinks`
- `reqIndustrySpecialBlocks`
- `reqDistinctPrimaryIndustries`
- `reqGranaries`
- `reqIrrigationDone`
- `reqLinkedDistinctIndustries`
- `reqPlainsOrReclaimed`

意味差確認済み:

- `reqConnectedPlainsOrReclaimed` → 実際は盤面全体合計
- `reqForestNearby` → 実際は盤面全体の森数
- `reqLoggingCamp` → 森1マスでも成立し得る

retiredカードだけが使う条件は現役Eligibility問題から除外する。

参照: `99_card_eligibility_audit.md`

---

## 7. Resource / Land Action

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| 土地開発🔥不足 | **INTERNAL_CONFLICT** | 配置後に `consume()`し、失敗戻り値を確認しないため、必要🔥不足でも土地配置が成功し得る。 |
| Command🔥0 | **PARTIAL** | affordabilityは検査するが、支払いで🔥0になった直後のtermination評価なし。 |
| Mulligan🔥0 | **PARTIAL** | 同上。 |
| 旺盛補正Tooltip | **INTERNAL_CONFLICT** | 実決済は🔥24以上×1.10＋✨2。詳細Tooltipは旧閾値/旧倍率を表示。 |

参照: `02_resources_and_ember.md`, `99_ember_action_boundary_audit.md`, `99_resource_presentation_gap_audit.md`

---

## 8. 地帯 / Production / 表示

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| 真の地帯 | 正本 | 2×2 / L / T。 |
| 1×2 / 1×3接続group | **INTERNAL_CONFLICT** | 真の地帯ではないが `mergeGroupId` が付く。 |
| 🌾🧱✨ Production | **INTERNAL_CONFLICT** | ProductionCalculatorが `mergeGroupId` だけ見て1×2 / 1×3にも×1.20を掛ける。 |
| 🛡️ Production | **INTERNAL_CONFLICT** | DefenseSystemは地帯×1.20を掛けない。 |
| Board表示 | **INTERNAL_CONFLICT** | 真の地帯表示は🛡️にも×1.20を表示し、局所modifier込み合計を倍率へ巻き込むため実決済とズレる。 |
| 単セル産出表示 | **PARTIAL** | Global Event / 旺盛補正等の全体倍率を完全には反映しない。 |

参照: `03_land_system/03_merge_system.md`, `99_zone_production_presentation_audit.md`

---

## 9. Economy / Project

主な現役Partial:

- Granary / Sawmill / Mine / Stable / Lime Kiln / Market / Depot / Irrigation / Workshop: counterやflagまでで主要consumer未接続のものが多い。
- Industrial Road: flagはあるが道路グラフ / edge / 移動コスト / Trial route誘導システムなし。
- Stage3 Project群: Eligibility未対応条件を含む。
- Great Rampart Projectは現在 **RETIRED**。旧重複分岐はlegacy cleanup対象。

参照: `09_cards/02_economy_cards.md`

---

## 10. Mystic

現役未接続:

- Fill the Void / Manifest Miracle / Leyline Resonance → Command支払い側consumerなし。
- Voice Beneath Earth / Revelation Choice / Two Futures → Offering側consumerなし。
- Transmute Golden → 通常Actionがtargetを渡さない。
- Voice / Revelation / Two Futures / Leyline → state寿命・解除も不完全。
- Rekindle Ember → Hold維持費免除が最大4回になり得る。

Omen Dreamは現在 **RETIRED**。

参照: `09_cards/04_mystic_cards.md`

---

## 11. Global Event

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| Production multiplier系 | **実装済み** | Production側hook接続済み。 |
| Offering Weight Tag Boost系 | **PARTIAL** | GlobalEventManager側hookはあるがDeckManagerが呼ばない。 |
| `NEXT_GLOBAL_EVENT` expiry | **PARTIAL** | 次イベント時の明示消費が確認できない。 |
| 一部targetTag | **PARTIAL** | 現イベント群と一致せず実効対象なしのものがある。 |

参照: `10_global_events.md`

---

## 12. Persistence / Undo

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| History Restore | **INTERNAL_CONFLICT** | Buff表示は保存されても効果判定用fieldがSerializer対象外のカードがある。 |
| Rationing | **INTERNAL_CONFLICT** | `foodCostHalvedTurns` がSerializer対象外で、Restore後に表示と実効果が分裂し得る。 |
| Land Undo | **INTERNAL_CONFLICT** | `activeDrawBias` / BuffSystemを土地Undo snapshotが保持せず、条件解除されたFocusを復元できない場合がある。 |
| RunTermination | **実装済みPersistence** | `isGameOver` / `runTermination` はwrapperで保存。 |
| retired nextTrial modifier | **LEGACY** | Serializer / Hydratorから意図的に除外済み。 |

参照: `99_state_persistence_gap_audit.md`, `99_land_undo_state_gap_audit.md`

---

## 13. Alert / Trial接近

| 項目 | 分類 | 現在 |
| :--- | :---: | :--- |
| 正確な残りVerse表示 | **LEGACY** | 現設計は環境・警戒表現優先だが旧数値表示が残る。 |
| 第1Trial前固定異変 | **RULES_AHEAD** | 強制トリガー未接続。 |
| 調査カテゴリ解禁 | **RULES_AHEAD** | 正規進行未接続。 |
| 環境Presentation | **RULES_AHEAD** | 音・画面変化等の警戒表現未完成。 |

参照: `10_global_events.md`

---

## 14. 監査運用

現在の優先順位は、

1. **現役Gameplayの壊れた経路**
2. **rulesとgameの意味差**
3. **Restore / Undo / UI表示の境界崩れ**
4. **retired / legacy codeの整理**

とする。

retiredコードが残っているだけの項目を、現役Gameplayの未完成機能より高く扱わない。
