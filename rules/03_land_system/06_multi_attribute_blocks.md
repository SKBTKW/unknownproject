# 06. 複数属性ブロック (Multi-Attribute Land Block)

> **Status:** [CURRENT] [PARTIAL] [REFERENCE]
>
> 1枚の土地カード・1回の配置・1つのBlock identityの内部に、異なるterrain semanticを持つ複数セルを含める土地ブロックの共通契約。

---

## 1. 定義

複数属性ブロックは、複数セルを同時配置しつつ、各セルが異なる `terrainId / E / GL` を持つ土地カードである。

例:

```text
[草原][丘陵]
 E1GL1 E2GL1
```

これは `E2_FOREST_HILL` 等の「1種類のterrainIdで構成される複合地形」とは別概念である。

```text
通常複合地形:
[森丘陵][森丘陵]
terrainId = E2_FOREST_HILL

複数属性ブロック:
[草原][丘陵]
terrainId = GL1_PLAINS / E2_HILL
```

---

## 2. Identity契約

```text
Card
  ↓
1 Placement
  ↓
1 placementGroupId
  ├ Cell A terrain semantic
  └ Cell B terrain semantic
```

- Card identity / Placement identity / Block identityは1つ。
- Cell terrain identityはセルごと。
- `placementGroupId` はZone / mergeGroupではない。
- 同じカード由来であることを理由に自動地帯化しない。
- 同じカード由来であることを理由に自動LINKしない。

---

## 3. Placement

内部辺と外部辺の責務を分離する。

### 内部辺

カード定義そのものが合法なterrain transitionを保証する。

通常のGL/E隣接拒否を、同じPlacement footprint内の未配置セル同士へ適用しない。

### 外部辺

各セル自身のsemanticを使って通常配置ルールを適用する。

- GL0 と GL2以上の直接接続禁止
- 過大なE差
- 山岳のHQ近郊制約
- その他terrain固有Placement制約

---

## 4. Rotation / Anchor

```text
geometry
+ cell attribute map
+ anchor
```

を同じtransformとして回転する。

shapeだけ回転してcell terrainの位置を残すことを禁止する。

---

## 5. Zone / LINK

- Zone判定は各cellのterrain semanticを使用する。
- 同一 `placementGroupId` 全体へmergeGroupを伝播しない。
- Zone-compatibleなセルのみZoneへ所属できる。
- 真のZone成立前にLINKしない。
- Multi-Attribute BlockそのものはZoneでもLINKでもない。

---

## 6. Trial

```text
Ownership / Block identity
→ placementGroupId単位

Terrain interaction
→ route上のcell semantic
```

同じPlaced Blockの複数セルを、独立した複数土地カードとして二重利用しない。

一方、進軍・地形効果・迎撃地形判定では実際に通過するcellのterrainを参照する。

---

## 7. Card Presentation

### カード名

`representativeTerrainId` をPresentation用代表地形として明示する。

表示名:

```text
代表地形名 + （複数）
```

例:

- `GL1_PLAINS` 代表 → **草原（複数）**
- `E2_HILL` 代表 → **丘陵（複数）**

代表地形は名称Presentation専用であり、Block全体のterrain semantic正本にはしない。

### レアリティ

真の複数属性ブロックは **R** とする。

「cell mapを持つ」だけではなく、実際に2種類以上のterrainIdを持つカードだけを複数属性ブロックとして扱う。

### shape preview

通常土地カードと同一のグリッドPresentationを使う。

ただし各active cellは自身の `terrainId` に対応する既存配置カラーを使うため、混種色で表示する。

2D / 2.5Dでterrain判定ルールを分けない。

---

## 8. Offering

通常LANDと同じweighted poolを使用する。

各カードの `weight` をそのままOffering抽選へ反映する。

`weight: 0` は抽選対象確率0として扱う。

Production契約が未確定の間は、`multiAttributeProductionReady !== true` のカードを通常・Cooldown緩和・最終fallbackのすべてでOfferingから除外する。

---

## 9. Production

**未確定。**

以下を担当判断だけで確定しない。

- 全セルへ同じcard-level yieldを複製
- マス数倍
- 代表セルのみ産出
- 各terrain基礎産出の自動合算

複数属性ブロックの本番Offering解禁はProduction契約確定後に行う。

---

## 10. 初期カード定義

現時点の実装データ:

| Card ID | 表示名 | Cells | Stage | Rarity | Weight | Live Offering |
| --- | --- | --- | ---: | --- | ---: | --- |
| `CARD_MULTI_PLAINS_HILL_1X2` | 草原（複数） | 草原 + 丘陵 | 1 | R | 0.08 | Production Gate |
| `CARD_MULTI_PLAINS_FOREST_1X2` | 草原（複数） | 草原 + 森 | 1 | R | 0.08 | Production Gate |
| `CARD_MULTI_HILL_MOUNTAIN_1X2` | 丘陵（複数） | 丘陵 + 山岳 | 2 | R | 0.05 | Production Gate |

これらは既存の `CARD_FOREST_HILL_1X2` 等とは別概念である。

---

## 11. Save / Undo / Restore

最低限以下を保持する。

- placementGroupId
- cell attribute map
- orientation
- anchor
- placement coordinates

Restore後に異なるterrainIdが同一terrainへ潰れることを禁止する。

---

## 12. Presentation境界

```text
GameState / Board semantic
        ↓
ReadModel / PlacementPreview semantic
        ↓
2D Renderer
または
2.5D Renderer
```

Renderer側でMulti-Attributeかどうかを推測しない。

Placement preview read modelは、各preview cellの `terrainId` を保持できる。

---

## 13. 実装確認先

- `game/src/core/placement_geometry.js`
- `game/src/systems/grid_engine.js`
- `game/src/presentation/land_card_presentation.js`
- `game/src/presentation/placement_preview_resolver.js`
- `game/src/systems/deck_manager.js`
- `game/src/core/state_serializer_base.js`
- `game/src/core/hydrate_game_state_base.js`
- `game/src/systems/undo_land_system.js`
- `game/src/data/land_cards.json`
- `game/src/data/land_cards_data.js`
- `game/src/core/dev/diagnose_multi_attribute_land_block.mjs`
