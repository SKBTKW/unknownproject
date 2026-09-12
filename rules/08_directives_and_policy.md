# 08. 文明方針 (Directives) — Dormant / 再設計待ち

> **Status:** Dormant implementation / Not current gameplay authority
>
> 文明方針システムはコード上の基盤と旧データを保持しているが、現行gameでは効果が停止されている。
> 本文書に記載する数値を現在のゲームルールとして扱ってはならない。

---

## 1. 現在の実装状態

`DirectiveSystem` には以下4方針の定義が存在する。

- `DEVELOPMENT` — 開拓
- `PRODUCTION` — 増産
- `MILITARY` — 軍備
- `PRAYER` — 祈祷

ただし現行実装では、

- `getCategoryWeightMultiplier()` は常に `1.0`
- `getResourceMultiplier()` は常に `1.0`
- `getExploreBonus()` は常に `0`
- 初期解禁は `DEVELOPMENT` のみ

となっており、方針による実際のOffering補正・資源倍率は停止されている。

したがって、現在プレイ上有効な4方針システムは存在しないものとして扱う。

---

## 2. 残存している実装骨格

効果停止中でも、以下の骨格は残っている。

- 初期方針: `DEVELOPMENT`
- 方針変更回数 `changeCount`
- 変更コスト
  - 初回変更: `🔥0`
  - 2回目以降: 変更回数に応じて `🔥1, 2, 3...`
- 変更後3Verse相当のロック
- 解禁済み方針リスト

ただし、現状では `DEVELOPMENT` 以外が解禁されていないため、通常プレイで方針変更機能は成立していない。

### Dormant UI shell

`game/index.html` には現在も `directiveModal` / `directiveOptions` のDOMが残っている。

さらに `legacy_ui_bridge.js` は、

- `window.toggleDirectiveModal`
- `window.closeDirectiveModal`
- `window.selectDirective`

を `UIController` へ中継している。

しかし現 `UIController.toggleDirectiveModal()` はmodalを開く処理を実行しておらず、実質的に空の互換メソッドになっている。

また `UIController.selectDirective(id)` は `dirSys.setDirective(id)` を呼ぶが、現 `DirectiveSystem` が提供する変更APIは `changeDirective(targetDirectiveId)` であり、`setDirective()` は定義されていない。

したがってDirective UIは、

> **DOM / legacy bridge / controller methodの殻は残るが、通常操作として成立していないDormant UI**

であり、さらにcontrollerとsystem間にAPI名の内部不一致が残っている。

---

## 3. 旧4方針データ

コードには以下の旧パラメータが残っている。

| 方針 | 旧データ |
| :--- | :--- |
| 開拓 | LAND Offering Weight ×3.0 |
| 増産 | 🌾×1.3 / 🧱×1.3 / 🛡️×0.8 |
| 軍備 | MILITARY Weight ×1.5 / 🛡️×1.3 / 🧱×1.3 / 🌾×0.8 |
| 祈祷 | MYSTIC Weight ×1.5 / ✨×1.4 / 🛡️×1.4 / 🌾×0.8 |

これらは現在の実効値ではなく、**Legacy parameter** とする。

再有効化する場合も、そのまま復活させず現在のOffering・Trial・Role設計に合わせて再評価する。

---

## 4. 旧rulesから外す仕様

以下は現行正本から外す。

- 本営クリックから4方針を自由に変更できる確定UI
- スキルツリーから方針を解禁する確定構造
- ロールごとの方針アンロック割引
- 軍備方針の迎撃戦術1.5倍・本営🛡️+15
- 祈祷方針の即時✨+30 / 🛡️+20
- 祈祷方針の各種コスト半減
- Stage進行に応じた「開拓→増産/軍備」への固定成長ストーリー

これらは旧設計案であり、現行実装・現在の設計思想を拘束しない。

---

## 5. 再設計時の原則

文明方針を再導入する場合は、単なる強力な全体倍率スイッチではなく、

> **同じ盤面でも、今後どの方向へ文明を寄せるかを宣言する中期的な意思決定**

として設計する。

優先する原則:

- 盤面形成を無視するほど強い全体倍率を避ける。
- Roleと機能を重複させすぎない。
- Offeringの直接操作はCard Cycle / Eligibility / Draw Biasとの責務衝突を避ける。
- Trial中の直接倍率より、平時の準備方針へ影響させる。
- 変更頻度を低くし、短期バフではなく中期方針として扱う。

---

## 6. Role・カードとの責務分離

### Role

ラン全体のプレイスタイルを決める恒常的な選択。

### Directive

再導入する場合、数Verse〜Stage単位で変えられる中期政策。

### Command Card

その場の具体的な政策・命令・事件への対応。

この3層を同一効果で重複させない。

---

## 7. 実装側の整理候補

現時点では `DirectiveSystem` を削除する必要はない。

ただし以下は明示的なDormantコードとして扱う。

- `DIRECTIVES` 内の旧倍率値
- `unlockedDirectives = ["DEVELOPMENT"]`
- 方針変更API
- `directiveModal` DOM / legacy bridge
- `UIController.selectDirective()` と `DirectiveSystem.changeDirective()` のAPI不一致

再実装時にはrulesを先に確定し、gameと同時更新する。
