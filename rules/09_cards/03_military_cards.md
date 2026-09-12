# 09-3. 軍事・防衛カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial
>
> Offering条件・コスト・レアリティの現在値は `game/src/data/military_cards.json` / `command_cards_data.js` を参照する。
> Trial向けカードは、発動時にフラグが立ってもTrial側へ状態が渡らず、最終Resolverが参照していないものが多い。

---

## 1. 状態ラベル

- **Implemented**: 現在のDefenseSystem等へ実効接続済み。
- **Partial**: カード発動・状態登録はあるが、Trial効果の最終Resolver接続が未完成。
- **Planned**: データ/設計のみ。

---

## 2. カード台帳

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_VIGILANCE` | **Implemented / Different** | 🧱15。次Verseから2Verse、最大🛡️計算へ**+3**。旧説明の「すべての🛡️獲得ごとに+3」ではない。 |
| `CMD_MUD_OBSTACLE` | **Partial** | `mudObstacleActive` とBuffを登録するが、`TrialTerrainEffectResolver` はこのフラグを参照せず、TrialControllerも通常GameStateのカードflagをTrialStateへ取り込まない。湿原出口倍率は基礎地形ルールのみ。 |
| `CMD_HIGH_GROUND_FORMATION` | **Partial** | 高地布陣フラグ/Buffは存在するが、`TrialTerrainEffectResolver` の高低差計算は標高のみを参照し、このフラグを参照しない。Trial側未接続を確認済み。 |
| `CMD_MILITARY_FOCUS` | **Partial** | 軍事Draw Biasを設定する実装あり。ただしDirectiveとは別系統。効果終了条件等はCard/State側で管理。 |
| `CMD_CAVALRY_SCOUTS` | **Partial** | 状態フラグを立てるが、通常盤面からの侵攻方向/route生成自体が未接続であり、このフラグを消費するTrial経路もない。現データコストは🌾30＋🧱20。 |
| `CMD_OUTPOST_SIGNAL` | **Partial** | `outpostSignalActive` を立てるが、警戒/情報解像度やTrial Scenario生成へ未接続。 |
| `CMD_IRON_RAMPART` | **Implemented / Different** | 🧱20。`DefenseSystem.increaseMaxCapacity(25)`、さらに本営近郊1マスあたり恒久🛡️+2。旧rulesの「🛡️+10」と不一致。 |
| `CMD_BALLISTA_SET` | **Partial** | 🧱30。最大🛡️容量+40は実装。`nextTrialDamageMitigation=0.5` も立つが、`TrialHqDamageResolver` はこの値を受け取らず、残存敵制圧力と変換率だけから🔥損害を計算する。50%軽減は未接続確定。 |
| `CMD_GUIDED_DEFENSE` | **Partial** | 発動フラグはあるが、通常盤面からのroute生成/移動コスト計算が未接続で、このフラグを消費する経路もない。 |
| `CMD_SCOUT_ENEMY` | **Partial** | 🌾5。`scoutEnemyActive` を立てる。旧rulesの2D6情報品質判定は現在発動処理にはなく、Trial Scenario/情報状態への接続もない。 |
| `CMD_SCORCHED_RETREAT` | **Partial** | 🌾20。焦土関連状態を立てるが、TrialController/TrialStateはこの状態を取り込まず、Trial route/戦後土地産出へ完成接続していない。 |
| `CMD_CAVALRY_HOST` | **Partial** | 🌾30＋🧱20。`cavalryHostActive` を立てるが、TrialController/TrialStateはこの状態を取り込まず、Trial機動処理へ未接続。 |
| `CMD_LOCAL_IRON_ARMAMENT` | **Partial** | 🧱15。`localIronArmamentActive` を立てるが、`TrialTerrainEffectResolver` の高地Modifierは標高のみで計算し、このフラグを参照しない。 |
| `CMD_STONE_STRONGPOINT` | **Partial** | 🧱20。`stoneStrongpointActive` を立てるが、`TrialTerrainEffectResolver` の地形減衰計算は地形IDのみを参照し、このフラグを参照しない。 |

---

## 3. Trial側で現在確実に使われるもの

現在のTrial戦闘Resolverが確実に使用するのは、カードフラグより主に以下。

- 配備した現在🛡️
- `1🛡️ = 5⚔` 換算
- 森/深い森の大軍展開制限
- 湿原出口倍率
- 砂漠出口倍率
- 高低差倍率

`TrialController.startScenario()` は完成済みScenarioから独立`TrialState`を生成し、通常GameState上の軍事カードflag群をコピーしない。

したがって現状は、

> **盤面地形そのものはTrialへ接続済みだが、通常GameStateに保存された軍事カード準備状態はTrialへ渡っていない**

という状態。

さらに、Trial内部の資源状態と通常GameStateのコミット境界も統一されていない。

- `startTrialInterceptionPreview()` は通常GameState由来の `availableDefense` と🔥をScenarioへコピーする。
- 迎撃計画を発動すると、消費した🛡️はTrial-local `state.human.availableDefense` からのみ減少する。
- 現 `TrialController` は通常GameStateの `currentDefense` を減少させない。
- 一方、本営到達時の🔥損害は `emberSystem.applyDamage()` が注入されていれば通常GameState側へ直接反映される。

したがって現在は、

> **🛡️はTrial-local、🔥損害はGameStateへ直接コミットし得る**

という非対称な半接続状態である。

軍事カードの「次のTrial」効果を完成させる際は、個別フラグを直接Trialへ継ぎ足す前に、通常GameStateからTrial開始時状態を構成し、Trial終了結果を一括でGameStateへ反映する境界を定義する必要がある。

---

## 4. 🛡️最大値と現在値

軍事カードの「🛡️を増やす」という表現は、必ず最大値と現在値を区別する。

`DefenseSystem.increaseMaxCapacity()` は最大容量を増加させる。現在🛡️が自動的に同量回復するとは限らない。

このためカード説明では、

- 最大🛡️容量+X
- 現在🛡️回復+X

を別表現にする。

---

## 5. 警戒/情報カードとの関係

`reqTrialNotice` / `reqTrialWithin` など、内部では正確なTrial距離を参照する条件がまだ存在する。

これはプレイヤーへ「残りN Verse」を見せることを意味しない。現在の設計では、警戒状態・予兆・調査進行を通じて提示する。

`CMD_SCOUT_ENEMY`、`CMD_OUTPOST_SIGNAL`、`CMD_CAVALRY_SCOUTS` は将来の調査・情報カテゴリ再編対象でもある。

---

## 6. 実装差分として確認済みの点

1. 軍事カードのActiveフラグは通常GameStateには立つが、現TrialControllerはそれらをTrialStateへ取り込まない。
2. `TrialTerrainEffectResolver` は地形ID・標高を基礎として処理し、Mud / High Ground Formation / Local Iron Armament / Stone Strongpoint等のカードflagを参照しない。
3. 《弩砲》の`nextTrialDamageMitigation=0.5`は`TrialHqDamageResolver`へ渡らず、50%軽減は未接続。
4. route生成自体が通常ランへ未接続のため、Guided Defense / Cavalry Scouts等のroute系効果も消費先がない。
5. Trial専用手札は存在せず、現状のTrial戦闘は盤面地形と配備🛡️中心で動く。
6. `TrialController` の🛡️消費はTrial-localであり、通常GameStateの `currentDefense` へコミットされない。
7. Trial本営損害は、`emberSystem` 注入時には通常GameStateの🔥へ直接反映されるため、🛡️と🔥で永続化境界が一致していない。
8. Trial完了時のpayloadは生成されるが、Stage遷移・Chronicle・次Trial状態・カードの「次Trial」フラグ消費までを一括処理する結果コミッタは確認できない。
