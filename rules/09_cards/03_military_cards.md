# 09-3. 軍事・防衛カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial
>
> Offering条件・コスト・レアリティの現在値は `game/src/data/military_cards.json` / `command_cards_data.js` を参照する。
> Trial向けカードは、発動時にフラグが立つだけでTrial Resolverがまだ参照していないものが多い。

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
| `CMD_MUD_OBSTACLE` | **Partial** | `mudObstacleActive` とBuffを登録するが、現在の `TrialTerrainEffectResolver` はこのフラグを参照せず、湿原出口倍率は基礎地形ルールのみ。 |
| `CMD_HIGH_GROUND_FORMATION` | **Partial** | 高地布陣フラグ/Buffは存在するが、Trialの高低差倍率Resolverへの接続は未確認・未完成扱い。 |
| `CMD_MILITARY_FOCUS` | **Partial** | 軍事Draw Biasを設定する実装あり。ただしDirectiveとは別系統。効果終了条件等はCard/State側で管理。 |
| `CMD_CAVALRY_SCOUTS` | **Partial** | 状態フラグを立てるが、侵攻方向候補除外やTrial再配置ロジックへの接続は未完成。現データコストは🌾30＋🧱20。 |
| `CMD_OUTPOST_SIGNAL` | **Partial** | `outpostSignalActive` を立てるが、警戒/情報解像度やTrial倍率へ未接続。 |
| `CMD_IRON_RAMPART` | **Implemented / Different** | 🧱20。`DefenseSystem.increaseMaxCapacity(25)`、さらに本営近郊1マスあたり恒久🛡️+2。旧rulesの「🛡️+10」と不一致。 |
| `CMD_BALLISTA_SET` | **Partial** | 🧱30。最大🛡️容量+40は実装。`nextTrialDamageMitigation=0.5` も立つが、現在のHQ Damage Resolverはこの値を直接参照していないため50%軽減は未接続。 |
| `CMD_GUIDED_DEFENSE` | **Partial** | 発動フラグはあるが、route cost計算へ接続されていない。 |
| `CMD_SCOUT_ENEMY` | **Partial** | 🌾5。`scoutEnemyActive` を立てる。旧rulesの2D6情報品質判定は現在発動処理にはない。 |
| `CMD_SCORCHED_RETREAT` | **Partial** | 🌾20。焦土関連状態を立てるが、現在Trial route/戦後土地産出へ完成接続していない。 |
| `CMD_CAVALRY_HOST` | **Partial** | 🌾30＋🧱20。`cavalryHostActive` を立てるがTrial機動処理へ未接続。 |
| `CMD_LOCAL_IRON_ARMAMENT` | **Partial** | 🧱15。`localIronArmamentActive` を立てるが、高地Modifierへ未接続。 |
| `CMD_STONE_STRONGPOINT` | **Partial** | 🧱20。`stoneStrongpointActive` を立てるが、地形減衰Resolverへ未接続。 |

---

## 3. Trial側で現在確実に使われるもの

現在のTrial戦闘Resolverが確実に使用するのは、カードフラグより主に以下。

- 配備した現在🛡️
- `1🛡️ = 5⚔` 換算
- 森/深い森の大軍展開制限
- 湿原出口倍率
- 砂漠出口倍率
- 高低差倍率

つまり現状、

> **盤面地形そのものはTrialへ接続済みだが、軍事カードによる上書きModifierは多くが未接続**

という段階。

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

## 6. 実装整理課題

1. 軍事カードのActiveフラグをTrial Modifier Resolverへ接続するか、不要なフラグを削除する。
2. 《鉄壁》の実値+25と旧説明+10を統一する。
3. 《弩砲》の`nextTrialDamageMitigation=0.5`をHQ Damage/Combatのどこへ適用するか決める。
4. 情報系カードを第1 Trial前の調査カテゴリへ再編する。
5. Trial専用手札を作らず、平時に準備した状態がTrialで効く原則を維持する。
