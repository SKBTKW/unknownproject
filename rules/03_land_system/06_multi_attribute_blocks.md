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
- 配置済みBlock数は `placementGroupId` をcanonical identityとして数える。
- Multi-Attributeの複数セルをBlock数へセル単位で加算しない。
- live `placedBlockCount`、`GameState.countPlacedBlocks()` fallback、`PLACED_BLOCKS_AT_MOST` 条件評価は同じBlock identityを使用する。
- 土地配置🔥コストとSave時の `placedBlockCount` fallbackも同じcanonical Block countを使用し、counter欠落時にセル数や0へ退行しない。

### 2.1 Cell定義とterrain正本

Multi-Attributeカードのcell定義は、原則として**座標＋terrainIdだけ**を保持する。

```js
cells: [
  { r: 0, c: 0, terrainId: "GL1_PLAINS" },
  { r: 0, c: 1, terrainId: "E2_HILL" }
]
```

`E / GL / nameKey / category / zoneCategory / trialTerrainCategory / base terrain yields` は
`LAND_SYSTEM_DATA.terrains` をcanonical terrain semanticとして解決する。

カード側へ同じ値を複製して二重管理しない。

cell mapはshapeのactive cellを**完全かつ一意に**覆わなければならない。

禁止例:

- active cellのattribute欠落
- 同一 `r/c` の重複
- shape外座標
- terrainId欠落
- `LAND_SYSTEM_DATA.terrains` に存在しないterrainId

不正なattribute mapはOffering適格外とし、配置時も `INVALID_ATTRIBUTE_MAP` で拒否する。
coverageは正しいがterrainIdが未知の場合は `UNKNOWN_ATTRIBUTE_TERRAIN` で拒否する。
Production Contractも不完全なattribute ownershipでは `UNRESOLVED` として扱う。

cell固有の追加フラグはoverlayとして保持できるが、terrain正本と同名のfieldが存在する場合はcanonical terrain側を優先する。

これにより、地形正本変更時にMulti-Attributeカードだけ `E/GL` やTrial terrainが古い値のまま残る状態を禁止する。

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

### 6.1 迎撃Block identity

迎撃計画では、

```text
placementGroupIdあり
→ placement:<placementGroupId>

placementGroupIdなし
→ cell:<r>:<c>
```

をBlock identityとして扱う。

Multi-Attribute Blockの別セルを別ルートから選んでも、同一 `placementGroupId` なら `BLOCK_ALREADY_PLANNED` とする。

また、Trial draftの再検証時は保存済み `interceptBlockId` だけを信用しない。live boardの `cellResolver` からBlock identityを再導出し、旧形式・復元draftで `interceptBlockId` が欠落していても同一Block二重利用を禁止する。

### 6.2 Trial terrain

Block identityとterrain判定を混同しない。

例:

```text
同じplacementGroupId
[丘陵][山岳]

丘陵cell
→ 迎撃可能

山岳cell
→ 山岳の迎撃制約
```

Trial側は代表地形やカード名ではなく、選択された実cellの `terrainId / E / GL` をBattle Contextへ渡す。

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

Production契約が `RESOLVED` でないカードを、通常・Cooldown緩和・最終fallbackのすべてでOfferingから除外する。

さらに全LAND共通ポリシーとして、**現在盤面上に合法配置先が1つも存在しないカードはOffering候補にしない**。

合法配置先判定は初期向きだけではなく、プレイヤーが通常操作で到達可能な4方向すべてについて、

```text
shape
+ anchor
+ attributeCells
```

を同じtransformで回転して評価する。

したがって「初期横向きでは配置不能だが、90°回転すれば合法」のカードはOffering対象に残す。一方、全回転で合法配置先ゼロなら、通常抽選・Cooldown緩和・最終fallbackのすべてから除外する。

Multi-Attributeカードでは各回転後の `attributeCells` を含めて `canPlaceShape` を評価し、代表terrainだけで配置可能性を推測しない。

現行データでは `productionContract.status = "UNRESOLVED"` を用いる。単なるboolean解禁フラグには戻さない。

---

## 9. Production

### 9.1 数値仕様は未確定

現カード3種の具体的な産出値・採用scopeは未確定である。

以下を担当判断だけで確定しない。

- 全セルへ同じcard-level yieldを複製
- マス数倍
- 代表セルだけをCell Production源とする
- 各terrain基礎産出の自動合算

したがって現カードは `productionContract.status = "UNRESOLVED"` のままとし、Live Offeringへ出さない。

さらにLive配置境界でも二重防衛する。

```text
GameState.canPlaceShape()
GameState.placeShape()
```

は、真のMulti-AttributeかつProduction Contractが未解決の場合、

```text
MULTI_ATTRIBUTE_PRODUCTION_UNRESOLVED
```

で拒否する。

これにより、旧Save・デバッグ注入・直接APIなどOfferingを経由しない経路でも未確定カードを実戦投入できない。

一方、`GridEngine` 直呼びはPlacement構造・回転・Zone等の低レベル診断に必要なため、Production Gateを持たせない。Live gameplay境界と低レベルDomain検証境界を分離する。

通常LAND、および明示的なcell mapを持っていてもterrainIdが全セル同一のhomogeneous cardはこのGate対象外とする。

### 9.2 Ownership境界は実装済み

Production値を決める前提として、次のownershipだけを共通境界として定義する。

```text
Cell Production
  → 各cellに所有
  → Zone / HQ近郊 / 灌漑等のcell由来補正へ参加

Block Production
  → placementGroupIdに所有
  → cellへ複製しない
  → Blockにつき1回だけ集計
  → Zone倍率の対象となるcell productionへ混ぜず、Zone集計後に加算する

Hybrid
  → 上記2つを明示的に併用
```

runtime上のscope:

- `CELL`
- `BLOCK`
- `HYBRID`

これらは「初期3カードにどれを採用するか」を決めたものではない。将来の正式仕様を、terrain semanticやRendererへ押し込まず表現するための受け皿である。

### 9.3 RESOLVED条件

`CELL` または `HYBRID` では、active cell全てについて明示的なcell yield entryを要求する。

一部セルだけを記述し、残りを暗黙にterrain yieldへfallbackすることは禁止する。

`BLOCK` はblock yieldを明示する。

`HYBRID` は全cell yield + block yieldの両方を明示する。

条件を満たさないcontractはruntimeで `UNRESOLVED` として扱う。

### 9.4 灌漑・Cell由来補正

Cell Productionは、配置後の**実セル座標**で灌漑・本営近郊などのcell由来補正を受ける。

Block Productionはcellへ複製しないため、灌漑等のcell modifierを直接受けない。

```text
Cell Production
  → actual board cell
  → irrigation / vicinity 等

Block Production
  → placementGroupId
  → cell modifier対象外
```

Multi-Attribute Blockだからという理由でBlock Productionへ灌漑補正を掛けたり、各cellへBlock yieldを複製して灌漑判定することを禁止する。

### 9.5 Rotation

Cell Productionのownershipは回転前のsource cell identityを保持する。

```text
source cell identity
≠
rotated local coordinate
```

回転によって草原側に定義されたcell yieldが丘陵側へ移る状態を禁止する。

### 9.6 表示

カード面では、

- 通常土地: 従来の土地産出表示
- Production RESOLVED Multi-Attribute: contractから合計を表示
- Production UNRESOLVED Multi-Attribute: **産出「未定」**

とする。

Block ProductionはBoard semantic上でcell productionとは別フィールドとしてReadModelへ渡す。Rendererがblock yieldを各cellへ複製してはならない。

表示集約では、代表表示対象に含まれる `placementGroupId` ごとのBlock Productionを1回ずつ加算する。地帯化されている場合も、cell/Zone産出へZone倍率を適用した**後**にBlock Productionを加算し、実決済と表示の倍率差を作らない。

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
- cell production ownership/status
- placedBlockProduction（Block Production正本）

Restore後に異なるterrainIdが同一terrainへ潰れること、およびBlock ProductionがCell Productionへ変質することを禁止する。

History Restoreも独自のMulti-Attribute復元ルールを持たず、`serializeGameState → hydrateGameState` の共通境界を利用する。

Restore後も以下を一致させる。

- 各cellの `terrainId / E / GL / trialTerrainCategory`
- 共通 `placementGroupId`
- `mergeGroupId` のcellごとの差
- cell production ownership
- `placedBlockProduction`

Restore直後のTrial terrain判定も、復元された各cell semanticをそのまま参照する。

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

Board read modelは少なくとも次を区別して保持できる。

- `productionStatus`
- `productionScope`
- cell yields
- `blockProduction`
- `blockProductionPrimary`

Block Productionを地形semanticの正本や各cell yieldへ混ぜない。

### 12.1 部分地帯化されたBlockの表示境界

同じ `placementGroupId` の内部で一部セルだけがZoneへ所属した場合、Presentation上も次を分離する。

```text
Zone所属セル
  → mergeGroup単位で表示集約

未Zoneセル
  → placementGroup単位で表示集約
  → ただしZone所属済みセルを再取り込みしない
```

したがって、

```text
[草原: Zone A][丘陵: 未Zone]
```

のような状態で、丘陵側の表示集約へ草原セルの産出を再加算してはならない。

同様に、Block Productionは同一 `placementGroupId` 由来だからという理由でZone側・未Zone側の両方へ重複表示しない。Blockのcanonical display ownerを含むPresentation groupにのみ1回表示する。

2Dの内部境界線も同じ規則を使い、Zoneセルと未Zoneセルを「同じカード由来」という理由だけで視覚的に一体化しない。

---

## 13. 実装確認先

- `game/src/core/placement_geometry.js`
- `game/src/core/land_production_contract.js`
- `game/src/systems/grid_engine.js`
- `game/src/systems/production_calculator.js`
- `game/src/systems/defense_system.js`
- `game/src/presentation/land_card_presentation.js`
- `game/src/presentation/placement_preview_resolver.js`
- `game/src/systems/deck_manager.js`
- `game/src/core/state_serializer_base.js`
- `game/src/core/hydrate_game_state_base.js`
- `game/src/systems/undo_land_system.js`
- `game/src/data/land_cards.json`
- `game/src/data/land_cards_data.js`
- `game/src/core/dev/diagnose_multi_attribute_land_block.mjs`
