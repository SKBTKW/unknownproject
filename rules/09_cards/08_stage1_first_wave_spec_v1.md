# 09-8. Stage1 First-Wave Card Spec v1

> **Status:** Semantic specification / Runtime activation still disabled
>
> Integration target: `AoT260924`
>
> Scope: First-Wave 9枚のうち、カテゴリの核になり得る
> **盤面投資4枚 + 状況対応3枚** の採用仕様を先に固定する。
>
> この文書は Offeringカテゴリ名・Stage別category weight・個別Offering weightを確定しない。

---

## 1. v1で固定する境界

### 1.1 盤面投資カード

対象:

- `CMD_WETLAND_RECLAMATION`
- `CMD_LOGGING_CAMP`
- `CMD_GRANARY`
- `CMD_AGRICULTURAL_REFORM`

共通契約:

1. 資源を支払った結果が **Board semantic stateとして残る**。
2. カード固有IDをProduction / Maintenance / Trial側が直接分岐しない。
3. 対象があるカードはプレイヤーが対象を選ぶ。自動走査で勝手に対象を決めない。
4. Preview / target enumeration / commitで同じ合法性判定を使う。
5. 支払い後に効果が失敗する経路を作らない。Preflight後にatomic commitする。
6. 既存LAND identity / Zone geometry / Link identityを不用意に書き換えない。

### 1.2 状況対応カード

対象:

- `CMD_RATIONING`
- `CMD_EMERGENCY_LEVY`
- `CMD_REKINDLE_EMBER`

共通契約:

1. Boardを変更しない。
2. 1回または短期間の状態対応に限定する。
3. 恒久生産を持たない。
4. 通常時より「条件を満たした時に欲しい」カードにする。
5. Offering出現条件と実行条件を同じ意味論から評価する。

---

## 2. 《配給》 `CMD_RATIONING`

### プレイヤーへの問い

> 今Verseの食料危機を凌ぐため、成長カード1枚分の行動を使うか。

### v1仕様

- cost: **なし**
- duration: **このVerseの維持費1回**
- effect: **最終食料維持費を50%にする（端数切り捨て）**
- stack: **不可**
- Board mutation: **なし**
- persistent value: **なし**

### Eligibility

通常時には候補化しない。

候補化条件は、現在VerseのTurn-end previewで

```text
foodAfterProduction < normalFoodMaintenance
```

となる、または自動fallbackを使わなければ🔥損失が発生する状態。

既存の「40%軽減」表示は採用しない。
現runtimeの `foodCostHalvedTurns` をv1意味論として正本化する。

### 実装整理

- `foodCostRationingActive`
- `foodCostRationingDiscount`

の二重legacy stateはv1契約に不要。
最終的には `foodCostHalvedTurns` 相当の単一意味へ収束する。

---

## 3. 《緊急徴発》 `CMD_EMERGENCY_LEVY`

### プレイヤーへの問い

> 食料備蓄を削って、今必要な資材へ変換するか。

### v1仕様

- cost: **🌾20**
- immediate result: **🧱+15**
- duration: **即時完結**
- stack: 該当なし
- Board mutation: **なし**
- 後続維持費ペナルティ: **なし**

既存source JSONの `🌾20 → 🧱15` をprototype基準として維持する。

### Eligibility

- 支払い後も🌾が0未満にならない。
- 「資材不足」を示す共通read modelがtrueの時だけ通常候補化する。
- `reqWoodDeficit` の名前だけを正本にせず、何を不足とみなすかはStage1 spend-path側と共有する。

### 禁止

旧仕様にあった「次維持費+5」を復活させない。

1枚のカードへ

```text
🌾→🧱変換
+
将来🌾ペナルティ
```

を同時に持たせると、選択の読みやすさが落ちるためv1では採用しない。

---

## 4. 《残火再燃》 `CMD_REKINDLE_EMBER`

### プレイヤーへの問い

> 貴重な✨を使い、🔥危機から立て直すか。

### v1仕様

- cost: **✨10**
- immediate result: **🔥+3**
- eligibility ceiling: **現在🔥5以下**
- duration: **即時完結**
- Board mutation: **なし**

### v1から外す効果

現在実装にある

```text
reserveFeeWaivedTurns = 3
```

はFirst-Wave v1から外す。

理由:

- 🔥回復とHold維持費免除で役割が2つになる。
- 危機回復カードの価値評価が難しくなる。
- Offering/Reserve economyを別カードなしで大きく触ってしまう。

Hold維持費免除を将来使う場合は、別カードまたは別の神秘効果として再検討する。

---

# 5. 盤面投資

## 5.1 《干拓》 `CMD_WETLAND_RECLAMATION`

### プレイヤーへの問い

> 湿原の地形価値を捨て、安定した生産地へ変えるか。

### v1仕様

- cost: **🧱15 + 🔥1**
- target: **プレイヤーが湿原1マスを選択**
- valid terrain: `E0_WETLAND`
- HQ: 不可
- completed Zone / true merged cell: 不可
- Lake socket: 不可
- result terrain: `E1_RECLAIMED_LAND`
- result canonical yield: Terrain Registryの `E1_RECLAIMED_LAND` を使用
- one action / one cell
- transform後は通常のZone/Link再評価対象

### Authority

Legacy `DeckManager` の盤面走査分岐をv1実行系として使わない。

必要なBoard domain actionは概念的に:

```text
TRANSFORM_TERRAIN
from: E0_WETLAND
to: E1_RECLAIMED_LAND
target: explicit cell
```

Cardは対象と支払いを要求し、
terrain identity mutationとZone/Link整合性はBoard側が所有する。

---

## 5.2 《伐採拠点》 `CMD_LOGGING_CAMP`

### プレイヤーへの問い

> 森の繁茂を削って、継続的な資材生産へ転換するか。

### v1仕様

Special Block `LOGGING_CAMP` を正本にする。

- target: GL2以上の合法森林系セル
- result: `LOGGING_CAMP` Special Block
- base terrain ecological effect: **GL -1**
- effect persists on Board
- source clusterをsemantic queryで記録/参照
- 同一セルへの重複建設不可

### Production

v1でproduction shapeを固定する:

```text
SOURCE_SIZE
```

ただし **具体的な🧱/Verse値は未確定** とする。

理由:

既存Stage1監査では🧱余剰が大きく、
ここで `+7/Verse` 等を先に固定すると経済を再び膨らませる可能性が高い。

数値は、

- HQ基礎産出5/5/5/1
- Stage1 LAND頻度
- 平時sink
- Trial Deployment

を含む再試算後に確定する。

### Cost ownership

Special Block作成費はBoard側quoteを正本にする方向。

カード側 `cost` とSpecial Block definition側で二重に値を持たない。

現 `🔥1` は製品v1の確定値とはしない。

---

## 5.3 《穀倉》 `CMD_GRANARY`

### プレイヤーへの問い

> 🧱を使い、毎Verseの食料維持を安定させるか。

### v1仕様

《穀倉》は単なる `granaryCount` flagではなく、
**Boardに配置される施設** とする方向で固定する。

想定:

- target: 平地 / 干拓地上の合法セル
- result: `GRANARY` Special Block
- cost target: **🧱20を初期チューニング基準**
- duplicate on same cell: 不可

### Maintenance effect

倍率ではなく、v1は**flat reduction**を採用する。

初期チューニング基準:

```text
active Granary 1基につき food maintenance -2
最大2基分まで
```

理由:

- 10%倍率よりプレイヤーが結果を読める。
- Stageごとの基礎維持費変化と掛け算地獄にならない。
- 1基/2基の価値を監査しやすい。

最終数値 `-2 / cap2` はStage1 economy tuningで変更可能だが、
**flat reduction方式**はv1意味論として固定する。

### Authority

Maintenance側はcard IDではなくBoard semantic capability/countを読む。

新Capability例:

```text
FOOD_STORAGE
```

名前自体は実装時に確定してよい。

---

## 5.4 《農地改革》 `CMD_AGRICULTURAL_REFORM`

### プレイヤーへの問い

> 形成済みの平地Zoneへ集中投資して、地域全体を農業化するか。

### v1仕様

- rarity / lifecycle: **UNIQUEを維持**
- cost baseline: **🧱20**
- target: **完成済みPLAINS Zone 1つ**
- one selected Zone only
- global all-plains buffは禁止
- result persists as Zone semantic state
- terrain identityは書き換えない
- Link identityは書き換えない

### Production effect

初期チューニング基準:

```text
target Zone内の各セル 🌾+1 / Verse
```

通常の2x2完成Zoneなら合計 `🌾+4 / Verse`。

この値は調整可能だが、

> 「完成した1 Zoneへ局所的に恒久投資する」

という意味論はv1で固定する。

### Authority

Zone Conversion Foundationを使用する。

想定definition:

```text
AGRICULTURAL_REFORM
eligibleZoneAttributes: [PLAINS]
creationCost: 🧱20
maintenance: none
production modifier: food +1 per member cell
```

カード側の旧 `permanentPlainsFoodBonus` global stateは最終的に廃止対象。

---

# 6. 7枚の役割比較

| Card | Boardに残る | 主な支払い | 主目的 | 長期価値 |
| --- | :---: | ---: | --- | :---: |
| 配給 | No | 行動機会 | 生存救済 | No |
| 緊急徴発 | No | 🌾 | 資源変換 | No |
| 残火再燃 | No | ✨ | 🔥救済 | No |
| 干拓 | Yes | 🧱+🔥 | 単セル変換 | Yes |
| 伐採拠点 | Yes | 未確定 | 森林利用 | Yes |
| 穀倉 | Yes | 🧱 | 維持効率 | Yes |
| 農地改革 | Yes | 🧱 | Zone強化 | Yes |

この差が維持できるなら、

```text
盤面投資4枚
状況対応3枚
```

はOffering上でも別の選択軸として扱える可能性が高い。

---

# 7. Offeringカテゴリへの含意

まだ正式カテゴリ名は決めない。

ただし、この7枚のv1意味論からは次の2群が安定している。

### Group A
**Boardに恒久状態を残すカード**

- 干拓
- 伐採拠点
- 穀倉
- 農地改革

### Group B
**現在状態へ短期対応するカード**

- 配給
- 緊急徴発
- 残火再燃

この区別は既存runtime `COMMAND / MYSTIC` categoryより
プレイヤーの選択体験に近い。

正式 `offering.category` は、
《警戒》《放棄された集落》をどう扱うかまで決めてから確定する。

---

# 8. 実装順

1. 状況対応3枚のsemantic cleanup
   - 配給の50%契約統一
   - 緊急徴発のlegacy penalty排除確認
   - 残火再燃のReserve免除分離
2. 盤面投資のBoard action不足を埋める
   - TRANSFORM_TERRAIN
   - GRANARY Special Block
   - LOGGING_CAMP production resolver
   - AGRICULTURAL_REFORM Zone Conversion
3. 7枚をID単位のprototype gateで有効化
4. Stage1 Offering traceを再試算
5. 《警戒》《放棄された集落》を分類
6. offering.category正式確定
7. Stage別category weight確定

---

# 9. 今回まだ変更しないもの

- `CardRuntimePolicy` のActive category
- dormantカードの通常Offering復帰
- `offering.category`
- Stage別category weight
- 個別Offering weight
- Trial Deployment canonical cost
- LOGGING_CAMP具体的🧱生産値

この順序を崩さない。
