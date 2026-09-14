# 09-4. 神秘・奇跡カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial / Retired
>
> 現在値は `game/src/data/mystic_cards.json` / `command_cards_data.js` を参照する。

---

## 1. 現役カード台帳

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_MEDITATION` | **Implemented / Different / Player-facing description mismatch** | 無料。runtimeは条件確認なしで即時✨+3し、次Verse向け `LAND` Draw Bias×2を1回設定する。表示説明の「今Verse土地を置かなかった場合」「次手札に土地カードを保証」はどちらもruntimeと一致しない。 |
| `CMD_FILL_THE_VOID` | **Partial / Player-facing description mismatch** | `fillTheVoidTurns=1` は立つが、一般Command支払い側が参照しない。表示説明の「不足🌾/🧱を✨3で補填」は実効しない。 |
| `CMD_VOICE_BENEATH_EARTH` | **Partial / Stale state / Player-facing description mismatch** | `voiceBeneathEarthTurns=1` を立てるがOffering側consumerと減算処理が未接続。表示説明の「次Offering 1枠を発見資源タグから抽選」は実効しない。 |
| `CMD_REKINDLE_EMBER` | **Implemented / Different** | 即時🔥+3。Hold維持費免除は実効するが、状態寿命の扱いにより最大4回免除し得る。 |
| `CMD_MYSTIC_FOCUS` | **Implemented / Internal taxonomy gap** | `MYSTIC` category Draw Bias×2。神秘テーマでも `COMMAND` categoryは対象外。現神秘10枚中 `MYSTIC` categoryは再燃・神秘重視・秘境の3枚のみ。 |
| `CMD_MANIFEST_MIRACLE` | **Partial / Player-facing description mismatch / Duplicate log** | `manifestMiracleTurns=3` は立つがCommand不足コスト補填consumerなし。さらに発動時に同じ `LOG_CMD_ACTIVATED` を2回追加する。 |
| `CMD_TRANSMUTE_GOLDEN` | **Broken active path / Player-facing description mismatch** | 通常 `GameEngine.playCommandCard()` が `targetTile=null` 固定。✨20を先払いした後、targetなしフォールバックで✨10だけ戻すため、通常Actionでは**実質✨10を失い、土地/socket変容は起きない**。 |
| `CMD_REVELATION_CHOICE` | **Partial / Stale state / Player-facing description mismatch** | `revelationChoiceTurns=1` 登録のみ。表示説明の「次Offering 1枚のカテゴリ指定」はUI/抽選consumer未接続。 |
| `CMD_LEYLINE_RESONANCE` | **Partial / Stale state / Player-facing description mismatch** | `leylineResonanceActive=true` 登録のみ。表示説明の次回✨補填拡張は支払い側consumerなし。解除処理も未接続。 |
| `CMD_TWO_FUTURES` | **Partial / Stale state / Player-facing description mismatch** | `twoFuturesTurns=1` 登録のみ。表示説明の「次Verseに3枚Offeringを2組生成し片方採用」は生成/UI consumer未接続。 |

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

一方、`Fill the Void / Manifest Miracle / Leyline Resonance` が想定するCommandカード不足コストの✨代替は別システムであり、現在完成していない。

一般Command支払い経路はこれらのstateを参照しない。

したがって、これら3枚は現在、**カードを使ってstate/Buffは立つが、表示されている補填効果そのものは発火しない**。

---

## 5. Offering操作状態

通常Offering生成は `activeDrawBias` を読むため、Mystic Focusは実効する。

ただしBiasはテーマではなく `category` 文字列の完全一致。

現 `mystic_cards.json` の10枚中、`category:"MYSTIC"` は以下3枚のみ。

- `CMD_REKINDLE_EMBER`
- `CMD_MYSTIC_FOCUS`
- `CMD_TRANSMUTE_GOLDEN`

残り7枚は設計上神秘カードでも `category:"COMMAND"` なのでMystic Focusの×2対象にならない。

《瞑想》も `activeDrawBias` 機構を使うが、LANDを保証するのではなくweightを×2するだけ。

一方、

- `voiceBeneathEarthTurns`
- `revelationChoiceTurns`
- `twoFuturesTurns`

はOffering側consumerがなく、専用state減算も確認できない。

表示Buffだけ満了し、専用stateが残留する可能性がある。

---

## 6. 《秘境》通常Actionの実際

カードデータ上のコストは `✨20`。

`DeckManager.playCommandCard()` は効果分岐へ入る前にコストを支払う。

通常 `GameEngine.playCommandCard()` は、

```text
DeckManager.playCommandCard(cardObj, null, offeringIdx, reserveIdx)
```

と呼び、`targetTile` を常に `null` とする。

そのため通常Actionは対象変容分岐に入らず、以下になる。

```text
✨20 支払い
→ targetTile == null
→ fallback: ✨+10
→ 聖なる光脈への変容なし
```

結果:

> **通常UIから《秘境》を使うと、対象効果なしで実質✨-10。**

これは単なる未接続UIではなく、現役カードの資源損失を伴う壊れた通常経路として扱う。

分類: **INTERNAL_CONFLICT / active broken action path**

---

## 7. 《顕現》ログ二重追加

`CMD_MANIFEST_MIRACLE` の発動分岐では同じ `LOG_CMD_ACTIVATED` が連続して2回 `addLog()` される。

効果consumer未接続とは別に、通常発動時のChronicle/ログ表示へ同一発動記録が重複する。

分類: **INTERNAL_CONFLICT / duplicate presentation side effect**

---

## 8. 現在の重要未接続 / 不一致

1. Meditation — 条件なし✨+3 / 土地保証ではなくLAND weight×2。
2. Transmute Golden — **通常Actionで✨20を払い、✨10だけ戻って変容しない。**
3. Fill the Void / Manifest Miracle / Leyline Resonance — 支払い側consumerなし。
4. Voice Beneath Earth / Revelation Choice / Two Futures — Offering側consumerなし。
5. Manifest Miracle — 同一発動ログを2回追加。
6. Mystic Focus — 設計上神秘10枚のうち `MYSTIC` category 3枚しかBias対象にならない。
7. Rekindle Ember — Hold維持費免除回数が説明より長くなり得る。
8. Voice / Revelation / Two Futures / Leyline — state寿命/解除も未完成。
9. Omen Dream — **現役Partialではなくretired。**
