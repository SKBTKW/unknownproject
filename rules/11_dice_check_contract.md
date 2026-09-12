# The Age of Trials — Flexible Dice Check Contract

> **Status:** Core implemented / extensibility partially planned
>
> この文書は探索専用仕様ではなく、ゲーム全体で再利用するダイス判定境界を定義する。

## 1. Design principle

判定は独立した層で構成する。

```text
DiceSpec
→ DiceRoll
→ ResolutionRule
→ OutcomeTable
→ caller-specific effect
```

演出は別レイヤーとする。

> **ダイス機構は汎用。結果の意味はcallerまたはcheck definitionが所有する。**

---

## 2. 現在実装されている境界

`game/src/core/check_system/` に以下が存在する。

- `CheckSystem`
- `RandomSource`
- `DicePool`
- `CheckResolver`
- `CheckModifier`
- `TargetBuilder`
- `CHECK_DEFINITIONS`
- definition validator

`CheckSystem.resolve()` は登録済みcheckIdを解決し、`resolveDefinition()` はcaller提供のdefinitionを同じCheckSystem RNG上で解決する。

DOMや演出はCheckSystemの責務に含めない。

---

## 3. DiceSpec

DiceSpecは何個・何面を振り、何を保持するかだけを表す。

```js
{
  count: 2,
  sides: 6,
  keep: "all"
}
```

DicePoolのkeep契約は以下を扱える。

```text
all
highest_N
lowest_N
```

2D6へハードコードしない。

---

## 4. DiceRoll

raw rollは事実データを保持する。

```js
{
  rolled: [2, 6, 4, 1, 5],
  kept: [6, 5, 4],
  dropped: [2, 1]
}
```

この層は資源獲得・Trialダメージ・情報公開などを知らない。

---

## 5. ResolutionRule — 現在の実装境界

### Implemented

現在 `resolveDefinition()` が正式に受け付けるResolutionRuleは、

```text
sum
```

のみ。

### Planned extensibility

以下は設計上の拡張候補であり、現在実装済みとは扱わない。

```text
highest
lowest
success_count
```

DicePoolの`keep highest_N / lowest_N`と、ResolutionRuleの`highest / lowest`は別責務である。

---

## 6. OutcomeTable

解決値を任意のsemantic resultへ対応させる。

例：

```js
[
  { max: 4, id: "low" },
  { min: 5, max: 7, id: "medium" },
  { min: 8, id: "discovery" }
]
```

Outcome IDは意味ラベルのみ。実効果はcallerが所有する。

validatorは不正DiceSpec、Outcomeの穴・重複等をfail-fastで拒否する。

---

## 7. 現在の主要check definitions

現在 `CHECK_DEFINITIONS` には少なくとも以下がある。

- `standard_2d6`
- `trial_intercept`
- `oracle_check` — 3D6 keep highest 2
- `harsh_check`

これらはCheckSystemの共通RNG streamを使用する。

《放棄された集落》も `standard_2d6` をcallerとして利用する。

---

## 8. PresentationHint

Presentationは判定ルールから分離する。

ルール層は「2個の3DダイスをDOMで横並びにする」等の具体的UI命令を持たない。

既存2D6演出品質を維持しつつ、将来別DiceSpecへ拡張できる構造を保つ。

---

## 9. RNG ownership

player-facing checkはCheckSystem RNGを使う。

world/content generationはGameplayRandomServiceを使う。

```text
runSeed
├ CheckSystem RNG
│  └ dice / checks
│
└ GameplayRandomService
   └ Offering / sockets / events / world selection / gameplay IDs
```

一方を消費しても他方の将来結果をずらしてはならない。

---

## 10. Restore / determinism

CheckSystemは `getState()` / `setState()` によりRNG状態を独立保存・復元する。

原則：

> **同じ復元状態 + 同じ後続判断 = 同じ後続結果**

Undo/Restoreを隠れたreroll手段にしない。

既に生成済みのOffering・socket等は再抽選せず履歴状態そのものを戻す。

---

## 11. caller例

汎用CheckSystemは探索Subsystemではない。

現在・将来caller候補：

```text
abandoned settlement
ambush
cavalry charge
reconnaissance
future Trial tactical checks
oracle / prophecy
emergency actions
```

独立土地探索は現行設計ではLegacy整理対象であり、CheckSystem自体を削除する理由にはならない。

---

## 12. Regression requirements

最低限維持する契約：

```text
2D6 all
3D6 highest_2
same seed => same roll sequence
getState/setState => exact resume
invalid DiceSpec => fail fast
invalid OutcomeTable => fail fast
GameplayRandom consumption does not shift CheckSystem
CheckSystem consumption does not shift GameplayRandom
```

将来 `highest / lowest / success_count` ResolutionRuleを追加する場合は、その時点で個別回帰テストを追加する。

---

## 13. Non-goals

現時点では以下を確定しない。

- あらゆる物理ダイス形状の専用UI
- Trialの最終ダイス戦術仕様
- `highest / lowest / success_count` ResolutionRuleの即時実装
- explorationをgeneric dice ruleのownerにすること
- world randomnessをCheckSystemへ統合すること
