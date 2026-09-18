# Resettlement Runtime Gap Audit

> **Labels:** [AUDIT] [REFERENCE]

> **Status:** Audit Ledger / Non-Authority
>
> 現役経済カード `CMD_RESETTLEMENT`（移住）のruntime分岐競合を記録する。

## 1. 同一ID分岐が2回存在する

`DeckManager.playCommandCard()` の同じ `else-if` チェーン内に `CMD_RESETTLEMENT` が2回存在する。

先行分岐:

```text
ember = min(30, ember + 2)
resettlementFoodBonus += 2
PERMANENT Buff
```

後段分岐:

```text
EmberSystem.addBonus(2)
CARD_EFFECT Buff
```

同じIDなので通常実行では先行分岐が必ず一致し、後段分岐は到達不能。

分類: **INTERNAL_CONFLICT / active duplicate branch**

## 2. 継続🌾効果

先行分岐は `resettlementFoodBonus += 2` を設定する。

しかし現 `ProductionCalculator` は `resettlementFoodBonus` を参照しない。

したがって継続🌾+2はstate登録のみで実Productionへ未接続。

分類: **PARTIAL / write-only active state**

## 3. 🔥30 capによる逆損失

先行分岐は、

```text
Math.min(30, currentEmber + 2)
```

を使用する。

一方、現行🔥システムには30の絶対上限はない。

- 連携成立で `maxEmber` はリンク数だけ拡張される。
- `EmberSystem.expandMaxCapacity()` に30上限はない。
- 地帯成立等で使われる `EmberSystem.addBonus()` はovercapを許容する。

したがって、現在🔥が30を超えている状態は成立し得る。

例:

```text
現在🔥 = 33
《移住》使用
→ min(30, 33 + 2)
→ 🔥 = 30
```

本来+2効果のカード使用で🔥が3減少する。

分類: **INTERNAL_CONFLICT / active resource regression**

## 4. 現在の実効挙動

現通常経路では、

> **《移住》は先行分岐だけが実行され、🔥+2は30cap付き、継続🌾stateは未消費、後段のEmberSystem版はdead branch。**

と扱う。

本監査では `game/` を変更しない。
