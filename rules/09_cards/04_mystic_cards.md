# 09-4. 神秘・奇跡カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial
>
> Offering条件・コスト・レアリティの現在値は `game/src/data/mystic_cards.json` / `command_cards_data.js` を参照する。
> 神秘カードは「未来・情報・Offering操作」を担う設計が多いが、その一部は現在フラグ登録までで最終効果が未接続。

---

## 1. カード台帳

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_MEDITATION` | **Implemented / Different** | 無料。即時✨+3、次Verse向けLAND Draw Biasを1Verse設定。旧説明の「今Verse土地を置かなかった場合」は条件として検査せず、カード使用自体が選択済み状態を立てる。 |
| `CMD_FILL_THE_VOID` | **Partial** | 無料、✨5以上で候補化。`fillTheVoidTurns=1` を立てるが、現在の一般コマンド支払いresolverへ不足資源補填として完成接続していない。 |
| `CMD_VOICE_BENEATH_EARTH` | **Partial** | ✨5。`voiceBeneathEarthTurns=1` を立てるが、次Offeringを発見資源タグへ連動させる完成処理は未接続。 |
| `CMD_OMEN_DREAM` | **Partial** | ✨5。`omenDreamActive` を立てる。侵攻方向等の情報解像度システムへ未接続。第1 Trial前の調査カテゴリ再編候補。 |
| `CMD_REKINDLE_EMBER` | **Implemented** | ✨10。即時🔥+3。次Verseから3Verse、保留維持費免除状態を設定する。 |
| `CMD_MYSTIC_FOCUS` | **Implemented** | ✨10、UNIQUE。次Verseから3Verse、`MYSTIC` category Draw Biasを設定。 |
| `CMD_MANIFEST_MIRACLE` | **Partial** | ✨10。3Verseの状態を立てるが、「一般コマンド不足資源を✨1:1で補填」の完成支払いresolverは未接続。食料維持費不足補填とは別システム。 |
| `CMD_TRANSMUTE_GOLDEN` | **Partial / Broken path** | ✨20、UNIQUE。`targetTile` が渡ればsocketを聖なる光脈へ変える分岐はある。しかし通常の `GameEngine.playCommandCard()` はtargetを渡さないため、現経路ではフォールバックの✨+10が実行され得る。 |
| `CMD_REVELATION_CHOICE` | **Partial** | ✨15。`revelationChoiceTurns=1` を立てるが、次Offering1枠のカテゴリ指定UI/抽選へ未接続。 |
| `CMD_LEYLINE_RESONANCE` | **Partial** | ✨8。`leylineResonanceActive` を立てるが、補填可能量拡大resolverへ未接続。 |
| `CMD_TWO_FUTURES` | **Partial** | ✨20、UNIQUE。`twoFuturesTurns=1` を立てるが、次Verseに2組のOfferingを生成・選択するフローは未接続。 |

---

## 2. 神秘カードの設計役割

神秘は単なる高額な数値バフではなく、主に以下を担当する。

- 🔥危機からの復帰
- Offeringの未来操作
- 情報・予兆
- 通常資源では届かない選択肢へのアクセス
- 土地/socketの特殊変容

この方向性は維持する。

一方、Trial中に突然専用カードを引いて戦う構造にはしない。情報・奇跡・準備は原則として平時に成立させ、Trialではその準備状態を使用する。

---

## 3. 調査・情報カテゴリとの統合候補

以下は最新の警戒フェイズ設計と強く関係する。

- `CMD_OMEN_DREAM`
- `CMD_VOICE_BENEATH_EARTH`
- `CMD_REVELATION_CHOICE`

特に《予兆》は「内部の残りTrial距離を直接知らせるカード」ではなく、

> **異変を認識した後、敵の方向・規模・性質の情報解像度を上げる手段**

として再設計する余地がある。

---

## 4. ✨補填の二種類を混同しない

現在確実に実装されている `✨1 = 🌾6` は**食料維持費不足専用のMaintenance fallback**。

一方、《資材》《顕現》《地脈共鳴》が想定する「コマンドカードの不足コストを✨で代替」は別システムであり、現在完成していない。

rulesではこの二つを同じ万能変換として扱わない。

---

## 5. 《黄金秘境への変容》の不整合

カード効果分岐は、対象土地が渡された場合にsocketを特殊資源へ変換する。

しかし現在のGameEngine facadeはコマンド発動時にtargetTileを引き渡していない。

そのため現状は、

> **カード設計は対象指定型だが、通常発動経路は対象を指定できない**

という実装不整合。

これはrulesをフォールバック挙動へ合わせず、game側修正候補とする。

---

## 6. 実装整理課題

1. `Fill the Void / Manifest Miracle / Leyline Resonance` 用の共通コスト代替Resolverを作るか決定する。
2. 情報カードを警戒・調査システムへ接続する。
3. Offering操作カードをDeckManager/CardCycleSystemへ正式接続する。
4. target指定型コマンドの共通Action APIを設ける。
5. フラグだけ存在して消費されないカード状態を棚卸しする。
