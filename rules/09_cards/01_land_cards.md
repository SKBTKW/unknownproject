# 09-1. 土地カード (Land Cards) — 現行実装台帳

> **Status:** Implemented / runtime-aligned
>
> 現在Offeringで使用される土地カードの実装上の正本は `game/src/data/land_cards_data.js` の `LAND_CARDS_MASTER` とする。
> `land_cards.json` は対応元データ、`game/src/data/card_database.js` は旧互換データを含むため、現在のOffering仕様の正本にはしない。

---

## 1. 基本ルール

土地カードは `category: LAND` としてOfferingへ入り、選択後に盤面へ開発する。

配置時、カード定義そのものが各セルの `terrain` として保持されるため、通常の産出はカードの `yields` を `ProductionCalculator` が参照する。

### 開発コスト

現在の土地開発🔥コストはブロック形状ではなく、累積開発ブロック数で決まる。

| 開発済みブロック数 | 🔥コスト |
| :--- | ---: |
| 0〜5 | 0 |
| 6〜15 | 1 |
| 16〜30 | 2 |
| 31以上 | 3 |

1 Verse中の土地開発は基本1回。詳細は `04_draw_and_hand_system.md` を参照。

---

## 2. Implemented — 現在Offeringへ存在する土地カード

### 湿原

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_WETLAND_1X1` | 1 | 1x1 | C | 0.20 | 🌾2 / 🛡️1 |

湿原は通常湿原同士の直接面隣接に制約があり、水源・干拓ルールを持つ。詳細は `03_land_system/` を正本とする。

### 平地

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_PLAINS_1X1` | 1 | 1x1 | C | 1.20 | 🌾4 |
| `CARD_PLAINS_1X2` | 1 | 1x2 | C | 0.13 | 🌾4 |
| `CARD_PLAINS_1X3_S` | 2 | 1x3 | R | 0.18 | 🌾4 |
| `CARD_PLAINS_1X3_L` | 2 | 3セルL | R | 0.14 | 🌾4 |
| `CARD_PLAINS_1X4_T` | 3 | 4セルT | SR | 0.05 | 🌾4 |
| `CARD_PLAINS_1X4_L` | 3 | 4セルL | R | 0.30 | 🌾4 |
| `CARD_PLAINS_2X2` | 3 | 2x2 | UR | 0.10 | 🌾4 |

### 森

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_FOREST_1X1` | 1 | 1x1 | C | 1.00 | 🌾2 / 🧱2 / 🛡️2 |
| `CARD_FOREST_1X2` | 1 | 1x2 | UC | 0.08 | 🌾2 / 🧱2 / 🛡️2 |

### 深い森

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_DEEP_FOREST_1X1` | 1 | 1x1 | R | 0.15 | 🌾1 / 🧱3 / 🛡️3 / ✨1 |
| `CARD_DEEP_FOREST_1X2` | 2 | 1x2 | R | 0.05 | 🌾1 / 🧱3 / 🛡️3 / ✨1 |

### 丘陵

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_HILL_1X1` | 1 | 1x1 | UC | 0.50 | 🌾2 / 🧱1 / 🛡️1 |
| `CARD_HILL_1X2` | 1 | 1x2 | UC | 0.05 | 🌾2 / 🧱1 / 🛡️1 |
| `CARD_HILL_1X3_L` | 2 | 3セルL | R | 0.12 | 🌾2 / 🧱1 / 🛡️1 |

### 山岳

山岳カードは `Stage >= 2` に加え、現在 `reqE2: 3` を持つため丘陵条件を要求する。

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_MOUNTAIN_1X1` | 2 | 1x1 | R | 0.20 | 🧱3 / 🛡️5 / ✨1 |
| `CARD_MOUNTAIN_1X2` | 2 | 1x2 | R | 0.15 | 🧱3 / 🛡️5 / ✨1 |
| `CARD_MOUNTAIN_1X3_S` | 2 | 1x3 | R | 0.03 | 🧱3 / 🛡️5 / ✨1 |

### 砂漠

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_DESERT_1X1` | 1 | 1x1 | R | 0.15 | ✨5 |
| `CARD_DESERT_1X2` | 2 | 1x2 | UR | 0.03 | ✨5 |

`land_system.js` の `TERRAIN_MATRIX` には砂漠✨2が残っているが、通常カード開発後の実産出はカード側の✨5。詳細は `07_mysticism_and_desert.md` を参照。

### 複合土地

| ID | Stage | 形状 | Rare | Weight | 1マス産出 |
| :--- | ---: | :--- | :---: | ---: | :--- |
| `CARD_DESERT_HILL_1X2` | 2 | 1x2 | R | 0.02 | 🧱1 / 🛡️1 / ✨2 |
| `CARD_FOREST_HILL_1X2` | 2 | 1x2 | R | 0.10 | 🌾1 / 🧱4 / 🛡️4 |
| `CARD_DEEP_HILL_1X2` | 2 | 1x2 | UR | 0.01 | 🌾1 / 🧱5 / 🛡️6 / ✨1 |

---

## 3. 地帯化・連携との関係

カードのマス数と地帯は同義ではない。

- 複数マス土地カードを1回で置いても、それだけで必ず地帯になるわけではない。
- 地帯化は盤面上の成立形状・地形互換条件を別途判定する。
- 地帯化後の持続産出1.2倍、成立報酬、連携は `03_land_system/03_merge_system.md` を正本とする。

---

## 4. 水源・ソケット

土地開発時、対象セルのhidden socketや地形条件によって資源ソケット・湖・オアシスが発見される場合がある。

現在の代表的な水源判定：

- 湿原: 通常20%、hidden socket上60%を基礎値として湖判定
- 砂漠: hidden socket上でオアシス25%基礎判定
- 草原1x1: hidden socket上で湖25%基礎判定
- 水源数による逓減・距離制約あり

詳細は `03_land_system/01_land_base.md` を正本とする。

---

## 5. Legacy / 非正本データ

`game/src/data/card_database.js` にも古い土地定義が存在するが、現在のOfferingで使用する `DeckManager` は `LAND_CARDS_MASTER` を参照する。

したがって `card_database.js` の旧値をrulesへ再転記しない。

また `TERRAIN_MATRIX` と土地カード側の `yields` が異なる地形については、実際の通常配置挙動を優先しつつ、game側のデータ統合課題として扱う。

---

## 6. 実装整理課題

1. `land_cards.json` / `land_cards_data.js` / `land_system.js` / `card_database.js` の責務を整理し、土地産出の二重定義を減らす。
2. 特に砂漠の✨2と✨5の不一致を解消する。
3. rulesへカード数値を重複保持しすぎず、実装データとの差分が出た場合は本台帳を更新する。
