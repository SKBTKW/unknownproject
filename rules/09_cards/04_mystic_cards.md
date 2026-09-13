# 09-4. 神秘・奇跡カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial
>
> Offering条件・コスト・レアリティの現在値は `game/src/data/mystic_cards.json` / `command_cards_data.js` を参照する。
> 神秘カードは「未来・情報・Offering操作」を担う設計が多いが、その一部は現在フラグ登録・生命周期管理までで最終効果が未接続。

---

## 1. カード台帳

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_MEDITATION` | **Implemented / Different** | 無料。即時✨+3、次Verse向けLAND Draw Biasを1Verse設定。旧説明の「今Verse土地を置かなかった場合」は条件として検査せず、カード使用自体が選択済み状態を立てる。 |
| `CMD_FILL_THE_VOID` | **Partial** | 無料、✨5以上で候補化。`fillTheVoidTurns=1` を立て、Verse経過時にカウンタを減算する処理も存在する。しかし一般コマンド支払い処理はこの値を参照せず、🌾/🧱/✨/🔥不足を通常どおり即時拒否するため、不足資源補填の実効効果は未接続。 |
| `CMD_VOICE_BENEATH_EARTH` | **Partial / Stale state** | ✨5。`voiceBeneathEarthTurns=1` を立てるが、通常Offering生成はこの状態を参照せず、次Offeringを発見資源タグへ連動させる完成処理は未接続。さらにGameStateのVerse経過処理にこのカウンタの減算が確認できず、専用stateが1のまま残留し得る。 |
| `CMD_OMEN_DREAM` | **Partial / Stale state** | ✨5。`omenDreamActive=true` を立てるが、侵攻方向等の情報解像度システムへ未接続。明示解除処理も確認できず、stateが残留し得る。第1 Trial前の調査カテゴリ再編候補。 |
| `CMD_REKINDLE_EMBER` | **Implemented / Different** | ✨10。即時🔥+3。`reserveFeeWaivedTurns=3` と開始待ちflagを設定する。ただし減算処理はHoldカードが存在するVerseにしか入らない。さらに `startsNextTurn=true` の最初の該当Verseも維持費自体は免除しつつカウンタ3を減らさないため、その後さらに3回免除できる。実挙動は「次Verseから連続3Verse」ではなく、Hold状況によって状態が長く残り、**最大4回のHold維持費を免除し得る**。 |
| `CMD_MYSTIC_FOCUS` | **Implemented / Internal taxonomy gap** | ✨10、UNIQUE。次Verseから3Verse、`MYSTIC` category Draw Biasを設定。通常Offering生成は `activeDrawBias` を読み、`category:"MYSTIC"` のWeightへ現行×2.0を適用する。ただし神秘テーマのカードでも `category:"COMMAND"` のものはBias対象外。 |
| `CMD_MANIFEST_MIRACLE` | **Partial** | ✨10。`manifestMiracleTurns=3` と `startsNextTurn` を設定し、GameState側に開始待ち・Verse減算の生命周期も実装済み。ただし一般コマンド支払い処理はこの状態を参照しないため、「不足コストを✨で補填」の実効効果は未接続。食料維持費不足補填とは別システム。 |
| `CMD_TRANSMUTE_GOLDEN` | **Partial / Broken path** | ✨20、UNIQUE。`targetTile` が渡れば対象socketを聖なる光脈へ変える分岐は存在する。しかし通常の `GameEngine.playCommandCard()` は `DeckManager.playCommandCard(..., null, ...)` と明示的に `targetTile=null` を渡すため、通常Action経路では対象指定分岐へ入れず、フォールバックの✨+10が実行される。 |
| `CMD_REVELATION_CHOICE` | **Partial / Stale state** | ✨15。`revelationChoiceTurns=1` を立てるが、通常Offering生成はこの状態を参照せず、次Offering1枠のカテゴリ指定UI/抽選へ未接続。GameStateのVerse経過処理に専用カウンタ減算が確認できず、stateが残留し得る。 |
| `CMD_LEYLINE_RESONANCE` | **Partial / Stale state** | ✨8。`leylineResonanceActive=true` を立てるが、一般コマンド支払い処理はこの状態を参照せず、補填可能量拡大の実効効果は未接続。明示解除処理も確認できず、stateが残留し得る。 |
| `CMD_TWO_FUTURES` | **Partial / Stale state** | ✨20、UNIQUE。`twoFuturesTurns=1` を立てるが、通常Offering生成はこの状態を参照せず、次Verseに2組のOfferingを生成・選択するフローは未接続。GameStateのVerse経過処理に専用カウンタ減算が確認できず、stateが残留し得る。 |

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

現在の `DeckManager.playCommandCard()` はカードの通常コストを先に検査し、不足時は `NOT_ENOUGH_FOOD` / `NOT_ENOUGH_MATERIAL` / `NOT_ENOUGH_MYSTIC` / `NOT_ENOUGH_EMBER` を返す。この検査・支払い経路は `fillTheVoidTurns`、`manifestMiracleTurns`、`leylineResonanceActive` を参照しない。

したがって、これらのカードは「状態を立てる部分」と、一部では「期間を減算する部分」まで存在していても、**コマンドコスト代替の最終消費者が未接続**である。

rulesではMaintenance fallbackと同じ万能変換として扱わない。

---

## 5. Offering操作状態の現在地

通常Offering生成は、現時点で `activeDrawBias` を明示的に読み、対象カテゴリのWeightへ補正を掛ける。

ただしBias判定はテーマ別カード群ではなく、カードデータの `category` 文字列そのものを比較する。現データでは神秘テーマのカードでも多数が `category:"COMMAND"` であり、`CMD_MYSTIC_FOCUS` の `targetCategory:"MYSTIC"` による×2対象には入らない。

一方、以下の状態については通常Offering生成からの参照が確認できない。

- `voiceBeneathEarthTurns`
- `revelationChoiceTurns`
- `twoFuturesTurns`

さらにこれらの専用stateカウンタは、現在のGameState Verse経過処理で減算されることも確認できない。

したがって、

> **表示Buffは満了しても、専用stateだけが残り続ける可能性がある。**

と扱う。

この状態で将来consumerだけを接続すると、過去Verseで使用したカードstateが後から誤って消費される危険がある。

---

## 6. 《黄金秘境への変容》の不整合

カード効果分岐は、対象土地が渡された場合にsocketを特殊資源へ変換する。

しかし現在の `GameEngine.playCommandCard()` は通常発動時、

```text
DeckManager.playCommandCard(cardObj, null, offeringIdx, reserveIdx)
```

として明示的に `targetTile = null` を渡す。

したがって通常Action経路では対象指定分岐へ到達できず、現在の実挙動はフォールバックの✨+10になる。

これはrulesをフォールバック挙動へ合わせず、**対象指定効果はPartial / 通常Action経路はBroken**として記録する。

---

## 7. 実装監査上の未接続一覧

以下は新しい設計案ではなく、現在確認済みの実装境界である。

1. `Fill the Void / Manifest Miracle / Leyline Resonance` — 状態登録に対するコマンド支払い側の消費処理がない。
2. `Voice Beneath Earth / Revelation Choice / Two Futures` — 状態登録に対する通常Offering生成側の消費処理がない。
3. `Omen Dream` — 状態登録に対するTrial情報解像度側の消費処理がない。
4. `Transmute Golden` — target対応分岐は存在するが、通常GameEngine Action APIからtargetが渡らない。
5. `Mystic Focus` — Draw Bias自体は実装済みだが、`MYSTIC`カテゴリ指定と神秘テーマカードの`COMMAND`分類が混在しており、テーマ上の神秘カード全体には掛からない。
6. `Rekindle Ember` — Hold維持費免除自体は実効するが、Holdが存在するVerseでしかstate寿命処理へ入らず、開始待ちVerseも免除回数を消費しないため最大4回免除し得る。
7. `Voice Beneath Earth / Revelation Choice / Two Futures / Omen Dream / Leyline Resonance` — 最終consumer未接続に加え、専用stateの寿命/解除も未完成で残留し得る。
