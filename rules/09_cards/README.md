# 09. カード仕様 — Authority Index

> **Labels:** [INDEX] [IMPLEMENTATION_LEDGER] [REFERENCE]

> **Status:** Rules index / Runtime data lives in `game/src/data/`
>
> カード仕様は、設計意図と実行時データを分離して管理する。
> `rules/09_cards/` はカード群の役割・設計方針・未実装差分を記録し、現在gameが実際に使用する数値・条件・タグは runtime master を参照する。

---

## 1. 現行Runtime正本

現在の `DeckManager` は基本masterとして以下を読み込む。

- `game/src/data/land_cards_data.js`
- `game/src/data/command_cards_data.js`

加えて、Investigation subsystem が解禁後に
`game/src/data/investigation_cards_data.js` を Offering master へ拡張する。

生成元JSON:

- `game/src/data/land_cards.json`
- `game/src/data/economy_cards.json`
- `game/src/data/military_cards.json`
- `game/src/data/mystic_cards.json`
- `game/src/data/investigation_cards.json`

ただし「masterに存在する」ことと「live runtimeでOffering対象になる」ことは別。
現在の `CardRuntimePolicy` は `LAND` と `INVESTIGATION` のみをActive扱いし、
`COMMAND / MILITARY / MYSTIC` は通常Offeringへ再流入させない。

したがって、**カードID、cost、rarity、weight、tags、minStage等のデータ事実はgame側masterを優先し、
live Offering可否はCardRuntimePolicyとInvestigation解禁条件も合わせて確認する。**

`rules/09_cards/` に異なる数値が書かれている場合、それだけを理由にgameを変更してはならない。

### Legacy data file

`game/src/data/card_database.js` にも古い土地定義が残っているが、現行 `index.html` のmodule entryは `src/app.js` であり、`DeckManager` はこのファイルではなく上記 runtime master を使用する。

さらに `card_database.js` 内の土地値は現runtimeと一致しないものがある。

例:

- 森林: `defense: 0`
- 山岳: `wood: 1`, `defense: 3`
- 砂漠: `food: 1`, `mystic: 2`

これらを現在のカード産出値として参照してはならない。

> **`game/src/data/card_database.js` は現時点では Legacy / non-authoritative data file として扱う。**

削除・archive移動はgame側整理時に判断する。

---

## 2. rules側の役割

`rules/09_cards/` は以下を扱う。

- カード群の設計思想
- プレイヤーに何を選ばせるカードか
- 実装予定だが未同期の効果
- 廃止候補・Legacyカード
- runtime dataでは表現しにくい意味論

個別数値を記載する場合は、必ず以下のどちらかを明示する。

- **Implemented:** 現行gameと一致
- **Planned:** 採用予定だがgame未同期

「確定仕様」という見出しだけで未実装値を正本扱いしない。

---

## 3. カテゴリ別文書

### 🌱 `01_land_cards.md`
土地カード。盤面形成・地形・形状・Stage解禁等を扱う。

### 📜 `02_economy_cards.md`
経済・政策・土地改良・産業・特殊ブロック関連。

### 🛡️ `03_military_cards.md`
防衛・軍事準備・Trial準備関連。

### ✨ `04_mystic_cards.md`
神秘・予兆・Offering操作・🔥回復等。

### 🗂️ `05_offering_category_inventory.md`
Stage1のlive / dormantカードとOfferingカテゴリ未確定境界の棚卸し。

### 🔎 `06_stage1_nonland_live_candidate_audit.md`
Stage1のDormant非LAND 15枚を、現在の実装意味論のままliveへ戻せるか監査した台帳。
カテゴリ・weightを決める前に、prototype可能 / support / semantic repair requiredへ切り分ける。

### 🧪 `06_stage1_dormant_card_triage.md`
Stage1 Dormantカード15枚の復帰・再設計・保留判断。runtime再有効化は行わない。

### 🧭 `07_stage1_first_wave_card_intents.md`
Stage1で優先して具体化する非LANDカードの判断軸。Offering正式カテゴリ・weightはまだ確定しない。

実装上は非土地カードの多くが `category: "COMMAND"` として残っており、上記テーマ分類とruntime categoryは一致しない。
Offering用taxonomyは `offering.category` 境界へ段階的に移すが、現時点で正式確定している系統はLANDのみとする。

---

## 4. Offeringとの関係

カードが存在するだけではOfferingへ出現しない。

実際の候補化は `DeckManager` により、概ね以下の順で処理される。

1. Stage条件
2. Card Cycle / Cooldown
3. UNIQUE消費済み判定
4. HOLD中重複除外
5. 発動中Buff・建設中Project等との重複除外
6. カード固有の盤面・資源・Trial条件
7. Weight抽選
8. 候補不足時のfallback

詳細は `rules/04_draw_and_hand_system.md` を正本とする。

---

## 5. Trialカード方針

Trial専用カードを別手札として持ち込む構造は採用しない。

> **戦場そのものがカードストックの役割を持つ。**

平時のカードは、盤面・制度・資源・準備状態を形成するために使う。Trialでは、それまで作った状態そのものを戦力として利用する。

---

## 6. 調査・情報カード

第1 Trial前の異変認識後に、調査カードをOfferingへ解禁する導線はlive runtimeへ接続済み。

- `investigation_cards_data.js` に3枚
- `InvestigationOfferingAdapter` が解禁後にmasterへ追加
- `CardRuntimePolicy` では `INVESTIGATION` をActive扱い

ただしこれは現在のruntime categoryであり、
将来のStage別Offering weightで `INVESTIGATION` を独立カテゴリとして固定することまでは意味しない。

Offering taxonomyの確定状況は `05_offering_category_inventory.md` を参照する。

---

## 7. 今後の同期ルール

カードを新規追加・変更する場合は、以下を同一変更単位として扱う。

1. rules上の設計意図
2. source JSON
3. generated data
4. 実行ロジック（必要な場合）
5. Offering条件
6. 表示文言

数値だけrulesへ先行記載し、長期間gameと乖離させる運用は行わない。
