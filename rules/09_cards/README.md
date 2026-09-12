# 09. カード仕様 — Authority Index

> **Status:** Rules index / Runtime data lives in `game/src/data/`
>
> カード仕様は、設計意図と実行時データを分離して管理する。
> `rules/09_cards/` はカード群の役割・設計方針・未実装差分を記録し、現在gameが実際に使用する数値・条件・タグは runtime master を参照する。

---

## 1. 現行Runtime正本

現在の `DeckManager` は以下を読み込んでOffering候補を構築する。

- `game/src/data/land_cards_data.js`
- `game/src/data/command_cards_data.js`

これらの生成元として、以下のJSONデータが存在する。

- `game/src/data/land_cards.json`
- `game/src/data/economy_cards.json`
- `game/src/data/military_cards.json`
- `game/src/data/mystic_cards.json`

したがって、**現在ゲーム内で有効なカードID、cost、rarity、weight、tags、minStage、Offering条件等の事実確認はgame側データを優先する。**

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

実装上は非土地カードの多くが `category: "COMMAND"` として統一されており、上記4分類は主に設計・文書整理上の分類である。

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

## 6. 調査・情報カテゴリ

第1 Trial前の異変認識後に、調査・情報系カードをOfferingへ解禁する方針を採用している。

ただし現行 `command_cards_data.js` には、このカテゴリを完成した独立カード群として扱う実装はまだない。

よって現在は **Planned / Not fully implemented** とする。

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
