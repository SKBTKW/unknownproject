# 03. 土地システム (Land System) — 正本インデックス

> **Status:** Design authority + implementation ledgers
>
> 本ディレクトリは、土地配置・地形・資源ソケット・地帯化・連携・土地改良・特殊ブロックに関する正本をまとめる。
>
> **最重要:** `00_land_foundation_and_resource_sockets.md` は、土地・E/GL・基礎産出・資源ソケット・水源の基礎設計正本である。現在の `game/` に未接続・未実装の項目があっても、それだけを理由に削除・Legacy降格・実装値への置換を行わない。実装との差異は監査層で扱う。

---

## サブ仕様書一覧

### 0. [`00_land_foundation_and_resource_sockets.md`](./00_land_foundation_and_resource_sockets.md)

**Status: Foundational design authority / protected source of truth**

土地システム全体の土台となる基礎仕様。

主に以下を保持する。

- E / GL と土地基礎産出モデル
- 地形ごとの確定基礎値
- 気候・高度の隣接制約
- 資源ソケットのカテゴリ・個別資源・持続産出
- 地形ごとの資源候補と相対Weight
- 湖 / オアシス等の水源ルール
- 湿原・干拓地の基礎意味論
- Stage拡張時の土地・ソケット関連仕様
- 土地表現・2.5D資源ブロック構成の基礎情報

このファイルは `AGtest260911` の `rules/03_land_system/01_land_base.md` を内容欠落なく復元したもの。

`game/` の現在値や実装成熟度と食い違う場合は、まず差異を `RULES_AHEAD / PARTIAL / INTERNAL_CONFLICT` 等として監査し、基礎設計データを実装へ合わせて削らない。

---

### 1. [`01_land_base.md`](./01_land_base.md)

**Status: Current implementation ledger**

現在の `game/` における土地配置・地形・ソケット周辺の実装状況を確認するための台帳。

- 土地カードと地形マトリクスの現在の責務
- 開発コスト
- 現在の配置判定
- 湿原 / 干拓地
- 現在のソケット / 水源処理
- 現在の灌漑処理

を記録する。

**このファイルは `00_land_foundation_and_resource_sockets.md` を置換しない。**

両者が異なる場合、`01_land_base.md` の現在実装記述を理由に `00` の設計情報を削除しない。

---

### 2. [`02_outpost_system.md`](./02_outpost_system.md)

前哨塔 / 拠点に関する仕様・実装状況を扱う。

---

### 3. [`03_merge_system.md`](./03_merge_system.md)

地帯化・連携を扱う。

プレイヤー向け用語:

- MERGE → **地帯化**
- LINK → **連携**

---

### 4. [`04_exploration_system.md`](./04_exploration_system.md)

土地探索・2D6探索に関する仕様・実装差分を扱う。

`00_land_foundation_and_resource_sockets.md` 内の資源ソケット・探索関連基礎情報と矛盾する場合、実装未接続を理由に基礎仕様を削除せず、別途差分として扱う。

---

### 5. [`05_special_blocks.md`](./05_special_blocks.md)

特殊ブロック / 土地改良に関する仕様・実装状況を扱う。

---

## 土地システムの基本フロー

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
資源・地勢条件に応じて土地改良 / 施設へ接続
↓
Trialで盤面そのものを利用
```

本作では、

> **土地を置くことが最終目的ではなく、土地の形と中身が後の選択肢を決める**

ことを土地システムの中心思想とする。

---

## 正本と実装台帳の関係

| 領域 | 設計正本 / 基礎情報 | 実装確認先 |
| :--- | :--- | :--- |
| E / GL・土地基礎産出・資源ソケット・水源 | `00_land_foundation_and_resource_sockets.md` | `01_land_base.md` / `land_system.js` / card data |
| 通常土地カードshape / Stage / rarity | `rules/09_cards/01_land_cards.md` | `LAND_CARDS_MASTER` |
| 配置合法性 | `00_land_foundation_and_resource_sockets.md` ほか土地正本 | `GridEngine.canPlaceShape()` |
| 総産出 | 土地・地帯・資源正本 | `ProductionCalculator` / `DefenseSystem` |
| 地帯化 / 連携 | `03_merge_system.md` | `merge_rules.js` / `GridEngine` |
| 土地探索 | `04_exploration_system.md` + `00` の資源発見基礎情報 | `DeckManager` / `CheckSystem` |
| 干拓 / 特殊ブロック | `05_special_blocks.md` | economy card / terrain conversion runtime |
| 前哨塔 | `02_outpost_system.md` | Trial / investigation関連runtime |

---

## 保護原則

`rules/03_land_system` では、次を厳守する。

1. **未実装 = 廃止ではない。**
2. **現在のコードから未到達 = Legacyではない。**
3. 設計正本を実装へ合わせて削除・圧縮しない。
4. 廃止・置換は、明示的な仕様決定または後発の確定正本がある場合だけ行う。
5. `game/` との差異は正本本文の削除ではなく、監査ファイルで分類する。
6. 特に `00_land_foundation_and_resource_sockets.md` の資源ソケット・E/GL・水源情報は、2.5D表現を含む他システムの基礎データとして保護する。
