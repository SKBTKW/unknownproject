# 09-4. 神秘・奇跡カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial / Retired
>
> 現在値は `game/src/data/mystic_cards.json` / `command_cards_data.js` を参照する。

---

## 1. 現役カード台帳

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_MEDITATION` | **Implemented / Different** | 無料。即時✨+3、次Verse向けLAND Draw Biasを1Verse設定。旧「土地を置かなかった場合」条件は検査しない。 |
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

## 7. 現在の重要未接続

1. Fill the Void / Manifest Miracle / Leyline Resonance — 支払い側consumerなし。
2. Voice Beneath Earth / Revelation Choice / Two Futures — Offering側consumerなし。
3. Transmute Golden — 通常Actionからtargetが渡らない。
4. Mystic Focus — Biasは実装済みだがcategory分類とテーマ分類が一致しない。
5. Rekindle Ember — Hold維持費免除回数が説明より長くなり得る。
6. Voice Beneath Earth / Revelation Choice / Two Futures / Leyline Resonance — state寿命/解除も未完成。
7. Omen Dream — **現役Partialではなくretired。**
