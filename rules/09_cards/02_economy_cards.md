# 09-2. 経済・政策カード — 実装状態台帳

> **Status:** Mixed — Implemented / Partial / Planned
>
> カードの候補化データは `game/src/data/economy_cards.json` および生成済み `command_cards_data.js` に存在する。
> ただし、カードがOfferingへ存在することと、説明どおりの最終効果がゲームシステムへ接続済みであることは別とする。

---

## 1. 設計原則

> 土地カードが「どんな大地を得るか」を決め、経済・政策カードは「その大地をどう利用するか」を決める。

この方向性は維持する。

Offering条件・Weight・コストは実装データを現在値の正本とし、本文書では主に**実装完成度**を管理する。

### 状態ラベル

- **Implemented**: 発動結果が現在の主要システムへ接続され、実ゲーム上の効果を持つ。
- **Partial**: カード・コスト・条件・発動分岐はあるが、記述された効果の一部が未接続。
- **Planned**: データ/設計のみ、またはフラグだけで実効処理が未完成。
- **Legacy**: 現行方針と合わず整理対象。

---

## 2. Stage 1

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_RATIONING` | **Implemented** | 食料維持費軽減。現在resolverは `foodCostHalvedTurns` を見て**基本維持費を50%**にする。旧rulesの「40%軽減」と不一致。 |
| `CMD_WETLAND_RECLAMATION` | **Implemented** | 🧱15＋🔥1。湖でない未地帯化湿原1マスを `E1_RECLAIMED_LAND` へ永久変換し、変換後に地帯化/連携再判定。 |
| `CMD_LOGGING_CAMP` | **Partial** | 🔥1、即時🧱+8は実装。周囲森林からの継続産出は現ProductionCalculatorへ未接続。 |
| `CMD_GRANARY` | **Partial** | 🧱20、`granaryCount` は増えるが、現在のMaintenance resolverは `granaryCount` を参照しない。維持費×0.90は未接続。 |
| `CMD_AGRICULTURAL_REFORM` | **Implemented / Simplified** | 🧱20、`permanentPlainsFoodBonus +1`。現実装では指定4マスではなく**全平地系への恒久+1/T**として処理される。 |
| `CMD_PASTORAL_FARM` | **Partial** | 🧱15、現実装は即時🌾+2とBuff登録。牧畜場化・周囲平地による持続産出は未接続。 |
| `CMD_ABANDONED_SETTLEMENT` | **Implemented** | 🔥1、2D6。現在値は 2–5:🌾+15 / 6–8:🧱+15 / 9–11:✨+10 / 12:🌾+20🧱+20✨+15。旧土地探索表は使わない。 |
| `CMD_EMERGENCY_LEVY` | **Implemented** | 🌾20を支払い、即時🧱+15。旧「次Verse維持費+5」ペナルティは現発動分岐では設定しない。 |

---

## 3. Stage 2

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_SAWMILL` | **Partial** | 🧱25、`sawmillCount` とBuff登録のみ。森林由来産出×1.5は主要産出計算へ未接続。 |
| `CMD_QUARRY` | **Partial** | 🧱20、即時🧱+10は実装。周囲丘陵/山岳の継続産出は未接続。 |
| `CMD_MINE` | **Partial** | 🧱25、`mineCount` 登録。鉱物socket産出×1.5は未接続。 |
| `CMD_STABLE` | **Partial** | 🧱20、`stableCount` 登録。騎馬カードWeight/コスト軽減は実効処理未確認・未接続扱い。 |
| `CMD_LIME_KILN` | **Partial** | 🌾10＋🧱15、`limeKilnCount` 登録。建設コスト軽減は未接続。 |
| `CMD_MARKET` | **Partial** | 🧱25、`marketCount` 登録。連携資源による持続産出は未接続。 |
| `CMD_DEPOT` | **Partial** | 🧱30、`depotCount` 登録。PROJECTコスト軽減は未接続。 |
| `CMD_IRRIGATION` | **Partial** | 🧱20、`irrigationCount` 登録。対象農地への恒久🌾+1/Tは未接続。既存の水源灌漑+50%とは別。 |
| `CMD_RESETTLEMENT` | **Partial** | 🌾15＋🧱10、即時🔥+2は実装。指定平地地帯への🌾+2/Tは未接続。 |
| `CMD_WORKSHOP` | **Partial** | 🧱30、`workshopCount` 登録。SPECIAL_BLOCKコスト軽減は未接続。 |

---

## 4. Stage 3 大規模事業

以下はカードデータ・発動分岐・永続フラグ/Buffの骨格は存在するが、完成した国家事業効果としては未接続部分が大きい。

| ID | 状態 | 現在 |
| :--- | :---: | :--- |
| `CMD_GRANARY_NETWORK` | **Planned / Partial** | UNIQUE。永続状態を立てる骨格あり。 |
| `CMD_INDUSTRIAL_ROAD` | **Planned / Partial** | `industrialRoadActive=true` とBuff登録までは実装。ただし盤面セル/辺としての道路、移動コスト、産業拠点+20%、Trial route誘導のいずれも実装確認できない。 |
| `CMD_IRRIGATION_NETWORK` | **Planned / Partial** | `irrigationNetworkActive` 等の状態は持てるが、最大8農地強化は未接続。 |
| `CMD_INDUSTRIAL_CLUSTER` | **Planned / Partial** | `industrialClusterActive` を立てるが、PROJECTコスト軽減は未接続。 |
| `CMD_GREAT_RAMPART_PROJECT` | **Planned / Partial** | `greatRampartActive` を立てるが、Trialへ防塁効果を反映する完成経路は未接続。 |

### 《産業街道》と道路システムの境界

現 `game/` には、Trial route計算に使える一般的な道路グラフ/道路セル/道路edge/移動コストシステムは確認できない。

`GridEngine` は土地配置・地帯化・連携等を管理するが、道路状態や道路移動コストを保持しない。`ProductionCalculator` も `industrialRoadActive` を参照しない。

したがって現在は、

> **道路カードのデータと永続フラグはあるが、「道路」という盤面システム自体はまだ存在しない**

と分類する。

将来の「道路で敵の低コストrouteを誘導する」というTrial上位設計を実装する場合は、まず平時盤面上で道路をどの単位（セル / edge / 連携間接続等）として保持するかを確定する必要がある。

---

## 5. Offering条件は実装済みでも効果が未完成な場合がある

`DeckManager.isCardEligible()` は、地形数・資源量・socket発見・連結土地・水源・Stage等の多数の条件を評価できる。

したがって、

> **「適切なときにカードが出る」部分は実装されていても、「出した後の文明施設効果」は未完成**

というカードが存在する。

この二つを混同しない。

---

## 6. 《放棄された集落》と探索の扱い

`CMD_ABANDONED_SETTLEMENT` は独立土地探索システムとは分離する。

- カード自身の2D6判定として存続
- `CheckSystem` を利用
- 専用の現在報酬表を持つ
- 廃止方向の `executeExploration()` 報酬表を参照しない

これにより「探索という題材をカード化する」現在方針と整合する。

---

## 7. 既知のrules/game差分

特に重要な差分：

1. 《配給》: rules旧40%軽減 vs runtime 50%軽減。
2. 《農地改革》: rules旧「指定最大4マス」 vs runtime「全平地系+1/T」。
3. 《伐採拠点》《穀物庫》《牧畜場》《製材所》《鉱山》等: カードは存在するが、完成した持続効果が未接続。
4. Stage 3 Project群: フラグ/Buff骨格中心で、Trial/Production/Cost resolverへの接続が未完成。
5. 《産業街道》: `industrialRoadActive` は立つが、道路盤面表現・産出効果・Trial移動コストの消費先がない。

これらは「rulesどおりgameを即修正」ではなく、カードごとに採用する最終仕様を決めてから同期する。

---

## 8. game側整理候補

- カード発動分岐が巨大な `DeckManager.playCommandCard()` に集中しているため、将来は効果Resolver/Handlerへ分離する余地が大きい。
- カウンタやActiveフラグを立てるだけで、どこからも参照されていない効果を棚卸しする。
- カードマスターのdescriptionと実際のresolver結果が一致するテストを用意する。
