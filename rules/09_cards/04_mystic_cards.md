# 09-4. 神秘・奇跡カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial / Retired
>
> 現在値は `game/src/data/mystic_cards.json` / `command_cards_data.js` を参照する。

---

## 1. 現役カード台帳

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_MEDITATION` | **Implemented / Different / Player-facing description mismatch** | 無料。runtimeは条件確認なしで即時✨+3し、次Verse向け `LAND` Draw Bias×2を1回設定する。表示説明の「今Verse土地を置かなかった場合」「次手札に土地カードを保証」はどちらもruntimeと一致しない。 |
| `CMD_FILL_THE_VOID` | **Partial** | `fillTheVoidTurns=1` と減衰処理はあるが、一般コマンド支払いはこの状態を参照しない。 |
| `CMD_VOICE_BENEATH_EARTH` | **Partial / Stale state** | `voiceBeneathEarthTurns=1` を立てるがOffering側consumerと減算処理が未接続。 |
| `CMD_REKINDLE_EMBER` | **Implemented / Different** | 即時🔥+3。Hold維持費免除は実効するが、状態寿命の扱いにより最大4回免除し得る。 |
| `CMD_MYSTIC_FOCUS` | **Implemented / Internal taxonomy gap** | `MYSTIC` category Draw Bias×2。神秘テーマでも `COMMAND` categoryは対象外。 |
| `CMD_MANIFEST_MIRACLE` | **Partial** | lifecycleはあるが、コマンド不足コストを✨で補填するconsumerがない。 |
| `CMD_TRANSMUTE_GOLDEN` | **Partial / Broken path** | target対応分岐はあるが通常GameEngine Actionは `targetTile=null` を渡すため、対象指定効果へ到達しない。 |
| `CMD_REVELATION_CHOICE` | **Partial / Stale state** | state登録のみ。次Offeringカテゴリ指定UI/抽選と減算処理が未接続。 |
| `CMD_LEYLINE_RESONANCE` | **Partial / Stale state** | state登録のみ。支払い側consumerと解除処理が未接続。 |
| `CMD_TWO_FUTURES` | **Partial / Stale state** | state登録のみ。次Verse2組Offering生成と減算処理が未接続。 |

---

## 2. retired — 《予兆》

`CMD_OMEN_DREAM` は現在の `mystic_cards.json` に存在しない。

さらに `CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` に含まれ、通常Offeringへ復帰しない。

したがって、旧 `omenDreamActive` 分岐やstateがコード内に残っていても、現在の神秘カードとして扱わない。

分類: **LEGACY / RETIRED**

以前の「侵攻方向等の情報解像度へ未接続」という評価は、現役カードのPartialではなく、retired実装残存の記録へ降格する。

---

## 3. 神秘カードの設計役割

神秘は主に以下を担当する。

- 🔥危機からの復帰
- Offeringの未来操作
- 情報・予兆
- 通常資源では届かない選択肢へのアクセス
- 土地/socketの特殊変容

Trial中に突然専用カードを引いて戦う構造にはしない。

---

## 4. ✨補填の二種類

現在確実に実装されている `✨1 = 🌾6` は食料維持費不足専用のMaintenance fallback。

一方、`Fill the Void / Manifest Miracle / Leyline Resonance` が想定するコマンドカード不足コストの✨代替は別システムであり、現在完成していない。

一般コマンド支払い経路はこれらのstateを参照しない。

---

## 5. Offering操作状態

通常Offering生成は `activeDrawBias` を読むため、Mystic Focusは実効する。

ただしBiasはテーマではなく `category` 文字列の完全一致。

《瞑想》も同じ `activeDrawBias` 機構を使う。

現runtimeの《瞑想》は、

```text
activeDrawBias = {
  targetCategory: "LAND",
  type: "TURNS",
  remainingTurns: 1,
  startsNextTurn: true
}
```

を設定する。

Offering抽選側はBias対象カテゴリのweightを×2するだけなので、土地カードの**確定枠・保証枠**ではない。

さらに発動時に「このVerseで土地を置かなかったか」を確認する条件もない。

したがって現在の表示説明

> 今Verse土地を置かない場合、✨+3 ＆ 次Verse土地カード保証

に対し、実runtimeは

> 条件なし即時✨+3 ＆ 次VerseLAND weight×2

である。

一方、

- `voiceBeneathEarthTurns`
- `revelationChoiceTurns`
- `twoFuturesTurns`

はOffering側consumerがなく、専用state減算も確認できない。

表示Buffだけ満了し、専用stateが残留する可能性がある。

---

## 6. 《黄金秘境への変容》

通常 `GameEngine.playCommandCard()` は `targetTile=null` を渡す。

そのため対象socket変容分岐へ到達できず、現在の通常Action経路ではフォールバック側へ流れる。

対象指定効果は **Partial / Broken path** とする。

---

## 7. 現在の重要未接続 / 不一致

1. Meditation — **表示説明とruntimeが二重に不一致**。「土地を置かない」条件なし／土地保証ではなくweight×2。
2. Fill the Void / Manifest Miracle / Leyline Resonance — 支払い側consumerなし。
3. Voice Beneath Earth / Revelation Choice / Two Futures — Offering側consumerなし。
4. Transmute Golden — 通常Actionからtargetが渡らない。
5. Mystic Focus — Biasは実装済みだがcategory分類とテーマ分類が一致しない。
6. Rekindle Ember — Hold維持費免除回数が説明より長くなり得る。
7. Voice Beneath Earth / Revelation Choice / Two Futures / Leyline Resonance — state寿命/解除も未完成。
8. Omen Dream — **現役Partialではなくretired。**
