# Active Action Hard Failure Audit

> **Labels:** [AUDIT] [REFERENCE]

> **Status:** Audit Ledger / Non-Authority
>
> 現在の通常プレイで、単なる「未接続」より優先して扱うべき、資源損失・Action失敗・壊れた通常経路を整理する。
>
> 本文書は修正優先順位のための監査であり、ルール正本ではない。

## 1. 対象基準

ここには次の条件を満たすものだけを載せる。

- 現役Gameplayから通常到達できる
- プレイヤーが実際にActionできる
- 資源を支払う / 権利を消費する / 状態を壊す
- 表示上は成功しても主要効果が発火しない、または逆効果が起きる

単に将来機能が未完成なだけのものやretiredコード残存は含めない。

---

## 2. Mulligan — 🔥と権利を消費して再抽選しない

通常UIは `GameEngine.mulligan()` を呼ぶ。

現在の処理:

```text
🔥 -1
hasMulliganedThisTurn = true
↓
DeckManager.drawOffering() を探す
↓
現DeckManagerに drawOffering() は存在しない
```

`DeckManager` 側の正しい再生成APIは `generateOfferingCards()` であり、DeckManager自身の `mulligan()` はこれを使う。

したがって通常GameEngine経路では、

> **🔥1とMulligan権を消費したのにOfferingが変わらない**

経路が成立する。

分類: **INTERNAL_CONFLICT / active broken action path**

---

## 3. 《秘境》 — ✨20を払い、✨10だけ戻って変容しない

現役 `CMD_TRANSMUTE_GOLDEN` のコストは✨20。

`DeckManager.playCommandCard()` は効果分岐より先にコストを支払う。

一方、通常 `GameEngine.playCommandCard()` は、

```text
DeckManager.playCommandCard(cardObj, null, offeringIdx, reserveIdx)
```

と呼び、`targetTile` を常に `null` にする。

結果:

```text
✨20支払い
→ targetなし
→ fallbackで✨10返却
→ 聖なる光脈への変容なし
```

実質結果:

> **✨10を失うだけ。**

表示説明の「指定土地1マスを聖なる光脈へ永続変容」は通常Actionでは実行されない。

分類: **INTERNAL_CONFLICT / active resource-loss path**

---

## 4. 《移住》 — 同一ID重複分岐で旧実装が先に発火

`DeckManager.playCommandCard()` 内に `CMD_RESETTLEMENT` が2回存在する。

### 先行分岐

```text
ember = min(30, ember + 2)
resettlementFoodBonus += 2
```

### 後段分岐

```text
EmberSystem.addBonus(2)
```

同じ `else-if` chainなので後段は通常到達不能。

現在の🔥は連携等で30を超え得るため、たとえば🔥33で使用すると、

```text
min(30, 35) = 30
```

となり、

> **🔥+2カードを使ったのに🔥が33→30へ減る**

可能性がある。

さらに先行分岐が書く `resettlementFoodBonus` はProduction側consumerが確認できず、表示説明の継続🌾効果も未接続。

分類: **INTERNAL_CONFLICT / duplicate branch / active resource regression**

---

## 5. 《顕現》 — 同一発動ログを2回追加

`CMD_MANIFEST_MIRACLE` の発動分岐では、同じ `LOG_CMD_ACTIVATED` を連続して2回 `addLog()` する。

本来の補填レート変更consumerも未接続だが、それとは別に、

> **1回のカード使用で同一発動記録が2件残る**

というPresentation / Chronicle系の副作用がある。

分類: **INTERNAL_CONFLICT / duplicate presentation side effect**

---

## 6. 土地開発 — 🔥不足でも配置成功し得る

土地配置は、盤面変更後に配置🔥コストを支払う。

`EmberSystem.consume()` は不足時 `false` を返すが、土地配置側は戻り値を確認しない。

そのため、

```text
土地配置成功
↓
🔥 consume失敗
↓
配置rollbackなし
```

となり得る。

> **必要🔥不足でも土地を無料配置できる経路**

として扱う。

分類: **INTERNAL_CONFLICT / active affordability bypass**

---

## 7. 優先順位

現時点の修正優先度は以下。

### P0 — プレイヤー資源・盤面を直接壊す

1. 土地開発🔥不足無料配置
2. 《秘境》✨10実損
3. 《移住》30超🔥 regression
4. Mulligan 🔥消費のみ

### P1 — 表示/履歴を壊す

5. 《顕現》二重ログ

### 別系統

以下は重大だが「Action即時破損」ではないため本台帳ではP0へ含めない。

- 高コスト施設/Projectの主要consumer未接続
- Offering Eligibility gap
- Restore / Undo state gap
- Trial通常ラン統合
- retired legacy code

---

## 8. 運用

この台帳の項目は、game側で修正されたことを確認した時点で削除またはResolved化する。

「旧コードが残っている」だけではここへ追加しない。
