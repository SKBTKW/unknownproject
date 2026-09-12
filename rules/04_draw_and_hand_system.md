# 04. Offering ＆ Hold ＆ Card Cycle 正本仕様

> 本文書は平時のカード提示・選択・保留・再提示制御の正本である。
> 旧来のカテゴリ説明、将来案、Trial専用カード構想を現在実装と混同しない。

---

## 1. 基本構造

各 Verse の開始時、Offering に原則 **3枚**のカードを提示する。

カードは大きく以下の実装カテゴリへ分かれる。

- `LAND` — 盤面へ開発する土地カード
- `COMMAND` — 資源消費、恒久効果、期間効果、建設、盤面変換等を行うコマンドカード

経済・軍事・神秘・制度・開拓等の意味づけは、`category`だけでなく `tags`、出現条件、効果内容によって表現する。

旧来の「6大カテゴリ」はデザイン上の分類語として参照可能だが、現在の抽選ロジック上のSSOTではない。

---

## 2. Offering生成の基本原則

Offering は「全カードから完全ランダムに3枚」ではない。

現在の抽選は大きく2段階。

1. **Eligibility Gate** — 現在出せないカードを候補から除外
2. **Weighted Draw** — 残った候補を重み付き抽選

同一Offering内では同一カードを重複提示しない。

---

## 3. Eligibility Gate

カードごとに現在のGameStateを参照し、条件を満たさないカードを物理的に候補から除外する。

代表例：

- 現在Stage
- Card Cycle cooldown
- UNIQUE消費済み
- Hold中の同一カード
- 同一効果のBuffが現在発動中
- 同一建設Projectが進行中
- Draw Biasがすでに発動中
- 丘陵・森・湿原・砂漠・山岳等の盤面条件
- 地帯化状態
- 水源・発見済みsocket resource
- 🌾 / 🧱 / ✨ / 🔥 の現在量
- 🛡️の現在または最大値
- Trial接近状態
- 空きマス数
- 特定地形の連結数

したがって、カードプールはVerseごとに動的に変化する。

---

## 4. Weight抽選

Eligibilityを通過した候補へ重みを付けて抽選する。

現行の基本構造は以下。

```text
最終Weight
= カード基礎Weight
× Directive補正
× Draw Bias補正
```

Draw Bias対象カテゴリの場合、現行実装では `×2.0` を使用する。

Global EventによるOffering補正用hookも存在する。

---

## 5. Card Cycle（再提示Cooldown）

Offeringへ提示されたカードは、即座に再提示可能にはならない。

状態は残りターン減算方式ではなく、絶対再提示Verseとして保持する。

```text
availableTurn = currentTurn + cooldown + 1
```

内部識別子は当面 `turn` を使用する。

### 現行Cooldown

| 種別 | Cooldown |
| :--- | :--- |
| 基本LAND | 1固定 |
| C | 1固定 |
| UC | 2〜4 |
| R | 6〜8 |
| UR | 14〜16 |
| UNIQUE | 選択時消費 |

UC / R / UR は基準値に `-1 / 0 / +1` のjitterを持つ。

基準値：

- UC = 3
- R = 7
- UR = 15

### Holdとの関係

HoldとCooldownは別管理。

Hold中でも内部時間は進むが、同一カードがOfferingへ重複提示されることはない。

---

## 6. UNIQUE

`cyclePolicy = UNIQUE` のカードは、選択された時点で消費対象となり、以後通常Offeringへ再登場しない。

選択には以下を含む。

- 土地として開発
- コマンドとして発動
- Holdへ格納

旧セーブ互換用の `usedUniqueCards` と現行の `consumedUniqueCards` が存在するが、今後の正本概念は「選択済みUNIQUEは再提示しない」とする。

---

## 7. 候補不足時のフォールバック

厳密なEligibilityとCooldownによって3枚を確保できない場合、Offering生成は制約を段階的に緩和する。

基本方針：

1. 通常条件で抽選
2. 必要に応じてCooldown制約を緩和
3. 最終手段として基本土地のCooldownを緩和

目的は、プレイヤー操作不能になる「Offering候補0枚」を防ぐこと。

UNIQUE消費済み等、本質的に復活させるべきでない制約は通常の不足救済とは分けて扱う。

---

## 8. Hold

Holdは **1枠**を基本とする。

### 基本ルール

- Offeringから1枚をHoldへ退避できる。
- Hold中の同一カードはOfferingへ出ない。
- Holdにカードが存在するVerse終了時、原則 `🔥 -1` の維持費が発生する。
- 一時効果によって維持費が免除される場合がある。
- 当該VerseにHoldへ入れたカードを即破棄して擬似ディスカード手段にすることはできない。
- Holdから使用した土地をUndoした場合は、可能な限り元のHoldへ復元する。

### 1 Verseあたりの預け入れ

OfferingからHoldへの新規預け入れは原則1回まで。

---

## 9. Mulligan

Offering全体を引き直すMulliganを持つ。

現行基本コスト：

- `🔥 -1`

基本制約：

- 1 Verseにつき最大1回
- すでに通常選択を確定した後は不可
- 🔥不足時は不可

Mulligan後も通常のEligibility / Weight / Card Cycle規則を用いてOfferingを再生成する。

---

## 10. 土地カードの選択と開発

通常の土地開発は1 Verseに1回を基本とする。

現在の実装では `hasPickedThisTurn` が土地開発の主要な排他フラグになっている。

土地開発時：

- 配置可否を検証
- shape / anchor / rotationを解決
- 盤面へ配置
- 必要ならHoldを消費
- UNIQUEなら消費登録
- 地帯化判定等の派生処理

を行う。

土地の詳細な配置・地帯化規則は `03_land_system/` を優先する。

---

## 11. コマンドカード

コマンドカードは、カードごとに指定された🌾 / 🧱 / ✨ / 🔥等のコストを支払って発動する。

### 設計上の正本

**コストを支払える限り、複数のコマンドカードを同一Verse中に使用可能とする。**

### 現在のgame実装

`DeckManager.playCommandCard()` 自体には `hasPickedThisTurn` の事前拒否がないため、API単体では2枚目以降のCommand呼び出しを拒否しない。

しかし通常の `HandCardsComponent` は `state.hasPickedThisTurn` を全カード共通の `isLocked` として扱う。

1枚目のCommand発動時に `playCommandCard()` が `hasPickedThisTurn = true` を設定するため、通常UIではその直後に残りのOfferingカードがすべてlockedとなり、2枚目のCommandも通常操作では発動できない。

同様に土地開発側も `hasPickedThisTurn === true` を `ALREADY_PICKED` として拒否する。

したがって現gameは、

```text
DeckManager API: 複数Commandを明示的には拒否しない
Hand UI: 1枚目使用後に全カードをlockする
Land action: 1枚目Command後の土地開発を拒否する
```

という**内部不一致**を持つ。

通常プレイヤー操作として観測される挙動は、実質「土地またはCommandのいずれか1枚を使うと、そのVerseの残りカード操作がlockedされる」である。

この挙動は設計上の正本とは一致しないため、rules側で新仕様として追認しない。

---

## 12. 発動中効果と再提示

現在アクティブなBuffと同一カードは原則Offeringから除外する。

同様に、建設中Projectや既存Draw Biasと重複するカードも候補から除外する。

目的は、現在使えない・重複して意味のないカードを死に札として提示しない。

---

## 13. Investigation / Informationカテゴリ

第1 Trial前の危機認識と情報収集を自然に接続するため、**調査・情報系カード群**を導入する方針。

基本構造：

1. 世界の異変を環境演出で示す
2. 亜人に関係するイベントが発生する
3. そのイベントを契機として調査・情報カードをOffering候補へ解禁する
4. プレイヤーが敵の方向・規模・特徴等を調べる
5. Trialへ移行する

### 現在の実装状態

この解禁カテゴリは設計方針として採用しているが、現行 `DeckManager` の独立カテゴリ / unlock gateとしてはまだ完成していない。

したがって、現在実装済みのOfferingカテゴリとして扱わない。

---

## 14. Trial専用カードについて

Trial専用カードを通常手札とは別に生成・保持する構造は基本方針として採用しない。

旧仕様に存在した以下の考え方は廃止方向とする。

- 捨て札からTrial専用タクティクスカードを生成
- Trial開始時に専用戦術手札を構築
- Trial中だけ使えるカードを通常カード循環から作る

Trialでは、平時に形成した盤面・制度・準備状態そのものを使用する。

> **どの戦場を選ぶか = どの戦術を使うか**

---

## 15. UI表現とゲームルールの分離

カードサイズ、ピクセル値、popover位置、font-size等のPresentation値は、ゲームルールの正本には固定しない。

本文書で固定するのは、

- Offering枚数
- Holdの意味
- 再提示規則
- 選択制約
- コスト
- Eligibility
- Weight
- Card Cycle

等のゲーム上の挙動とする。

Presentation詳細は実装側UI設定を正本とし、必要なら専用UI仕様へ分離する。

