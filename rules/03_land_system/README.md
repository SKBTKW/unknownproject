# 03. 土地システム (Land System) — 正本インデックス

> **Status:** Mixed current / planned / legacy
>
> 本ディレクトリは、土地配置・地形・地帯化・連携・土地改良・特殊ブロックに関する正本をまとめる。
>
> 重要: すべての文書が同じ実装成熟度ではない。各文書のStatusを確認すること。

---

## サブ仕様書一覧

### 1. [`01_land_base.md`](./01_land_base.md)

**Status: Current implementation ledger**

現在実装されている、

- 土地カードと地形マトリクスの責務分離
- 開発コスト
- E / GL隣接制約
- 湿原
- 干拓地
- ソケット
- 湖 / オアシス
- 灌漑

を定義する。

通常土地カードの実産出は `LAND_CARDS_MASTER` を優先し、地形型・特殊地形・ソケットは `land_system.js` を参照する。

土地データの複数SSOT問題は既知のリファクタリング課題。

---

### 2. [`02_outpost_system.md`](./02_outpost_system.md)

**Status: Planned / not implemented as a full system**

前哨塔は、

> 高地・山岳 → Trial前の観測情報

へ変換する構想として採用。

ただし、盤面配置・城市化・3タイプ分岐・建設費等の旧詳細仕様は現行確定事項ではない。

`CMD_OUTPOST_SIGNAL` は存在するがOutpost本体は未完成。

---

### 3. [`03_merge_system.md`](./03_merge_system.md)

**Status: Mostly current**

プレイヤー向け用語:

- MERGE → **地帯化**
- LINK → **連携**

現在実装されている主な内容:

- 4セル地帯
- 2×2 / L / T系shape
- 地帯産出1.2倍
- 湿原・水源セルの除外
- 草原+干拓地の`PLAINS`互換
- 異なる完成地帯間の連携

一部の地帯固有戦術・特殊報酬は未実装のため、本文中の実装状態を確認する。

---

### 4. [`04_exploration_system.md`](./04_exploration_system.md)

**Status: Legacy / removal direction**

旧「配置済み土地を独立操作で2D6探索する」仕組み。

`game` に残存コードはあるが、現行設計では専用探索を廃止し、

- カード
- イベント
- 調査 / 情報

へ吸収する方向。

新規仕様の根拠として使用しない。

---

### 5. [`05_special_blocks.md`](./05_special_blocks.md)

**Status: Mixed**

特殊ブロック / 土地改良の実装状態を管理する。

現在完成度が高いもの:

- 湿原 → 干拓地
- 干拓地の人工地形化
- 草原+干拓地のPLAINS地帯

Partial:

- 穀物庫
- 製材所
- 鉱山
- 市場
- 工房
- 国家事業
- その他施設カード

Planned:

- 前哨塔盤面配置
- 前哨塔によるTrial情報精度向上

---

## 土地システムの現在フロー

```text
Offering
↓
土地カードを選ぶ
↓
開発
↓
配置制約を満たして盤面形成
↓
地帯化
↓
異なる地帯を連携
↓
資源・地勢条件に応じて土地改良 / 施設カードが候補化
↓
Trialで盤面そのものを利用
```

本作では、

> **土地を置くことが最終目的ではなく、土地の形が後の選択肢を決める**

ことを土地システムの中心思想とする。

---

## 現在の正本関係

| 領域 | 正本 |
| :--- | :--- |
| 通常土地カードのshape / Stage / rarity / yield | `rules/09_cards/01_land_cards.md` / `LAND_CARDS_MASTER` |
| 地形型・E/GL・特殊地形 | `01_land_base.md` / `land_system.js` |
| 実際の配置合法性 | `GridEngine.canPlaceShape()` |
| 実際の総産出 | `ProductionCalculator` |
| 地帯化 / 連携 | `03_merge_system.md` / `merge_rules.js` / `GridEngine` |
| 独立探索 | Legacy |
| 干拓 | `05_special_blocks.md` + economy card |
| 前哨塔 | Planned |

---

## 旧「新機能実装予定案」の扱い

以下は現行採用仕様ではなく、将来候補へ降格する。

- Territory Milestone（盤面50% / 80% / 100%埋めボーナス）
- Gradation Harmony（E/GL連続配置への追加ボーナス）

採用する場合は、現在のTrial・Offering・地帯化との役割重複を確認してから再設計する。
