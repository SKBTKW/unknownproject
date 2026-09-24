# 09-6. Stage1 非LAND Live Candidate Audit

> **Status:** Candidate audit / no runtime activation
>
> Integration target: `AoT260924`
>
> Purpose: DormantなStage1非LAND 15枚を、現在の実装意味論のままlive Offeringへ戻せるか監査する。
> Offeringカテゴリ名・Stage weight・個別weightの確定はこの文書の責務外。

## 1. 結論

Stage1非LAND 15枚を一括で復帰させてはいけない。

現在のsource JSONと実行系を照合すると、**ID単位prototypeで試験できる候補は6枚**になった。

### A — live prototype候補

| ID | 役割 | 現コスト | 判定理由 |
| --- | --- | ---: | --- |
| `CMD_EMERGENCY_LEVY` | 緊急資源変換 | 🌾20 | Declarative effectだけで説明通り `🧱+15` まで完結する |
| `CMD_VIGILANCE` | Trial前防衛準備 | 🧱15 | 2Tの`vigilanceTurns`をDefenseSystem / turn lifecycleが実際に消費する |
| `CMD_REKINDLE_EMBER` | 神秘→🔥救済 | ✨10 | v1は`🔥+3`の即時回復に単純化。保留維持費免除は分離済み |
| `CMD_GRANARY` | 盤面恒久投資 | 🧱20 | `GRANARY` Special Blockを対象指定で設置し、`FOOD_STORAGE` Capability経由で維持費-2（最大2基分）まで接続済み |
| `CMD_WETLAND_RECLAMATION` | 湿原変換 | 🧱15＋🔥1 | explicit targetの`TRANSFORM_TERRAIN` Domain Actionで湿原1マスを干拓地へ変換。湖/HQ/完成ZoneはBoard側でfail-closed |
| `CMD_AGRICULTURAL_REFORM` | 地帯恒久投資 | 🧱20 | 完成PLAINS Zoneを明示targetにし、Zone definition正本の`DOMAIN_QUOTE`で支払い。ACTIVE conversionが各memberへ🌾+1/T |

ここでの「候補」は **今すぐ通常Offeringへ有効化する** という意味ではない。
まず個別ID単位でprototype対象にできる、という意味。

カテゴリ全体の `COMMAND` / `MILITARY` / `MYSTIC` をActiveに戻してはならない。

## 2. B — 実行系はあるが、Stage1 sinkとしては主役にしない

| ID | 状態 | 理由 |
| --- | --- | --- |
| `CMD_RATIONING` | rescue候補 | 維持費半減は実装済み。ただし無料カードなのでsinkではない |
| `CMD_MEDITATION` | support候補 | ✨+3 + 次T LAND biasはDeclarativeで完結。ただし資源を増やす側 |
| `CMD_ABANDONED_SETTLEMENT` | migration待ち | 2D6実装はDeckManager legacy branchにあり、Declarative / Domain Actionへ未移行 |

この3枚は将来のOffering構成には使えるが、Deployment前の平時支出量を作る主役ではない。

## 3. C — 現状のままlive化しない

### `CMD_LOGGING_CAMP`
表示は「森1マスを伐採拠点化し、周辺森林から持続産出」。
現Declarative effectは `🧱+8` とBuff追加だけで、Special Block化も周辺持続産出も行わない。
現在の説明と実効果が一致しない。

### `CMD_PASTORAL_FARM`
表示は「平地1マスを牧畜場化し持続産出」。
現source definitionにDeclarative effectがなく、legacy挙動も施設化意味論を満たさない。
Special Block境界確定後に作り直す。

### `CMD_MILITARY_FOCUS`
`MILITARY` biasを張るが、現在のCardRuntimePolicyではMILITARYカテゴリ自体がDormant。
単独復帰させるとbiasの行き先が成立しない。

### `CMD_FILL_THE_VOID`
現effectは `fillTheVoidTurns = 1` のflag設定まで。
説明が要求する「COMMAND不足資源を✨3:1で補填」の支払い境界を明示的に再接続してから復帰する。

### `CMD_VOICE_BENEATH_EARTH`
現effectは `voiceBeneathEarthTurns = 1` のflag設定まで。
「発見済み資源に関連するタグ群からOffering 1枠」の生成責務が現Offering Category Foundationと未接続。

### `CMD_MYSTIC_FOCUS`
MYSTICカテゴリbiasを張るが、MYSTICカテゴリは現在Dormant。
Offering taxonomy確定前に復帰させない。

## 4. sinkとして見た意味

A候補6枚でも、Stage1平時sinkはまだ不足する。

- `CMD_EMERGENCY_LEVY`: 🌾20 → 🧱15 の変換であり、純消費は小さい
- `CMD_VIGILANCE`: 🧱15 の明確なTrial準備sink
- `CMD_REKINDLE_EMBER`: ✨10を使うが `maxEmber: 5` の救済条件なので通常Runで常用しない
- `CMD_GRANARY`: 🧱20を恒久施設へ変える本命sink候補。ただしproduction既定OFFのままprototypeで検証する
- `CMD_WETLAND_RECLAMATION`: 🧱15＋🔥1を盤面価値へ変える土地投資sink。production既定OFFのままprototypeで検証する
- `CMD_AGRICULTURAL_REFORM`: 🧱20を完成PLAINS Zoneの局所恒久🌾へ変える地帯投資sink。production既定OFFのままprototypeで検証する

したがって、これらをprototype可能にしても、

> Verse1〜14の平時投資が十分に増えた

とは判定しない。

主要sinkを作るには、施設・土地改良系を現在のBoard / Special Block / Zone Conversion境界に合わせて再実装する必要がある。

特に、

- 農地改革
- 伐採拠点
- 穀物庫
- 牧畜場

は「資源を払って盤面の恒久価値へ変える」役として有望だが、**Legacy挙動をそのまま復帰させず作り直す**。

## 5. Offeringへの戻し方

カテゴリtaxonomyは未確定なので、次のprototypeでもカテゴリ丸ごとActive化しない。

禁止:

```text
COMMAND をActive
MILITARY をActive
MYSTIC をActive
```

推奨:

```text
明示したcard IDのみprototype許可
↓
Offeringに出た実プレイを監査
↓
具体化したカード群からoffering.categoryを決める
↓
Stage別category weightを決める
```

これによりLegacyカードの枚数比でOffering率が勝手に決まることを防ぐ。

## 6. 次の実装順

ID単位のruntime activation boundaryは実装済み。

- `GameEngine.cardRuntimeActivationProvider` から `activeCardIds` を明示注入できる
- 既定値は空配列
- `LAND / INVESTIGATION` の既存active categoryは維持
- `COMMAND / MILITARY / MYSTIC` をカテゴリ単位で復帰させるAPIは持たない
- production bootstrapはproviderを注入していないため、製品既定ではA候補3枚もDormantのまま

次の順序:

1. A候補3枚をprototype環境で個別ID単位に有効化して、Offering / play / cost / effectを検証する
2. 通常製品Offeringへの投入はtaxonomy / weight決定までOFFに保つ
3. 施設/土地改良系をBoard-owned actionへ移行
4. 実際に平時支出が発生するStage1 traceを再計測
5. Verse14/15残高帯を決める
6. 最後にTrial Deployment canonical profileを決める

Deployment Costを先に固定してこの不足分を埋めない。
