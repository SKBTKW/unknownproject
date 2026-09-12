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
| `CMD_VOICE_BENEATH_EARTH` | **Partial** | ✨5。`voiceBeneathEarthTurns=1` を立てるが、通常のOffering生成はこの状態を参照せず、次Offeringを発見資源タグへ連動させる完成処理は未接続。 |
| `CMD_OMEN_DREAM` | **Partial** | ✨5。`omenDreamActive` を立てるが、侵攻方向等の情報解像度システムへ未接続。第1 Trial前の調査カテゴリ再編候補。 |
| `CMD_REKINDLE_EMBER` | **Implemented** | ✨10。即時🔥+3。次Verseから3Verse、保留維持費免除状態を設定する。 |
| `CMD_MYSTIC_FOCUS` | **Implemented** | ✨10、UNIQUE。次Verseから3Verse、`MYSTIC` category Draw Biasを設定。通常Offering生成は `activeDrawBias` を読み、対象カテゴリへ現行×2.0を適用する。 |
| `CMD_MANIFEST_MIRACLE` | **Partial** | ✨10。`manifestMiracleTurns=3` と `startsNextTurn` を設定し、GameState側に開始待ち・Verse減算の生命周期も実装済み。ただし一般コマンド支払い処理はこの状態を参照しないため、「不足コストを✨で補填」の実効効果は未接続。食料維持費不足補填とは別システム。 |
| `CMD_TRANSMUTE_GOLDEN` | **Partial / Broken path** | ✨20、UNIQUE。`targetTile` が渡れば対象socketを聖なる光脈へ変える分岐は存在する。しかし通常の `GameEngine.playCommandCard()` は `DeckManager.playCommandCard(..., null, ...)` と明示的に `targetTile=null` を渡すため、通常Action経路では対象指定分岐へ入れず、フォールバックの✨+10が実行される。 |
| `CMD_REVELATION_CHOICE` | **Partial** | ✨15。`revelationChoiceTurns=1` を立てるが、通常Offering生成はこの状態を参照せず、次Offering1枠のカテゴリ指定UI/抽選へ未接続。 |
| `CMD_LEYLINE_RESONANCE` | **Partial** | ✨8。`leylineResonanceActive` を立てるが、一般コマンド支払い処理はこの状態を参照せず、補填可能量拡大の実効効果は未接続。 |
| `CMD_TWO_FUTURES` | **Partial** | ✨20、UNIQUE。`twoFuturesTurns=1` を立てるが、通常Offering生成はこの状態を参照せず、次Verseに2組のOfferingを生成・選択するフローは未接続。 |

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

一方、以下の状態については通常Offering生成からの参照が確認できない。

- `voiceBeneathEarthTurns`
- `revelationChoiceTurns`
- `twoFuturesTurns`

したがって、これらはカード発動時の状態登録までは存在するが、通常Offering生成の実効処理へは未接続として扱う。

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
