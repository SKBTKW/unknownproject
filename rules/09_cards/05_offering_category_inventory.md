# 09-5. Offeringカテゴリ棚卸し — Stage1

> **Status:** Inventory / Category taxonomy not yet finalized
>
> この文書は Offering 用カテゴリ名やStage別weightを確定するための正本ではない。
> 現在のruntimeとカード案を分離して棚卸しし、カテゴリ確定前に誤ってweightを固定しないための設計台帳である。

---

## 1. 現時点で確定しているもの

正式に確定しているOffering系統は **LAND（土地カード）** のみ。

土地カードは盤面形成そのものを担当し、他のカード群とは役割が明確に異なる。

それ以外のカテゴリ名・カテゴリ数・Stage別weightは未確定とする。

`offering.category` / `offeringCategory` は将来の分類を受け入れるための実装境界であり、
フィールドが存在すること自体は新カテゴリの採用を意味しない。

---

## 2. 現在のlive runtime

現在の `CardRuntimePolicy` がActive扱いするruntime categoryは以下の2つ。

- `LAND`
- `INVESTIGATION`

これは**現在の実装ゲート**であり、最終的なOfferingカテゴリ体系の確定を意味しない。

`COMMAND` / `MILITARY` / `MYSTIC` の既存データは互換・設計・復元用として残っているが、
通常のlive Offeringへそのまま復帰させない。

Investigationは `InvestigationOfferingAdapter` が解禁後に専用masterを既存候補へ追加する。

---

## 3. Stage1 非LANDカード棚卸し

### 3.1 liveでActive

Investigation 3枚。

| ID | runtime category | 状態 |
| :--- | :--- | :--- |
| `INVESTIGATE_FOOTPRINTS` | INVESTIGATION | 解禁後Active |
| `INVESTIGATE_CAMP_REMAINS` | INVESTIGATION | 解禁後Active |
| `INVESTIGATE_SCOUT_SIGHTING` | INVESTIGATION | 解禁後Active |

この3枚は「現在動いている非LANDカード」である。

ただし、`INVESTIGATION` を将来もStage weightの独立カテゴリとして維持するかは別途決める。

### 3.2 authoredだがruntimeではDormant

Stage1設定を持つ非LANDカードは、source JSON上ではさらに15枚ある。

- Economy: 8
- Military: 2
- Mystic: 5

これらは現在の `CardRuntimePolicy` では通常Offering対象外。

#### Economy 8

- `CMD_RATIONING`
- `CMD_WETLAND_RECLAMATION`
- `CMD_LOGGING_CAMP`
- `CMD_GRANARY`
- `CMD_AGRICULTURAL_REFORM`
- `CMD_PASTORAL_FARM`
- `CMD_ABANDONED_SETTLEMENT`
- `CMD_EMERGENCY_LEVY`

#### Military 2

- `CMD_VIGILANCE`
- `CMD_MILITARY_FOCUS`

#### Mystic 5

- `CMD_MEDITATION`
- `CMD_FILL_THE_VOID`
- `CMD_VOICE_BENEATH_EARTH`
- `CMD_REKINDLE_EMBER`
- `CMD_MYSTIC_FOCUS`

したがって、Stage1非LANDは「18枚がlive候補」ではない。

> **18枚 authored / 3枚 live Active / 15枚 Dormant**

として扱う。

---

## 4. 現在のtaxonomyはOffering分類として使わない

既存runtime `category` はカードのテーマと一致していない。

例:

- 経済・施設・緊急対応の多くが `COMMAND`
- 軍事テーマでも `CMD_VIGILANCE` は `COMMAND`
- 神秘テーマでも複数カードが `COMMAND`
- `MILITARY` / `MYSTIC` は一部カードだけ

したがって、現 `category` の枚数比からStage別Offering weightを決めない。

特に、

`COMMAND = 経済 + 施設 + 緊急対応 + 軍事 + 神秘`

になっているため、これを1つのOfferingカテゴリとして重み付けすると、
カード追加数そのものが出現率を歪める。

---

## 5. 未確定カード群から見える「仮クラスタ」

以下はカテゴリ候補ではなく、今後カードを具体化するときの観察用クラスタ。

### 盤面利用 / 開発寄り
- 干拓
- 伐採拠点
- 穀倉
- 農地改革
- 牧畜農場

### 緊急対応 / 資源変換寄り
- 配給
- 緊急徴発
- 放棄された集落

### 防衛準備寄り
- 警戒
- 軍事重視

### 神秘 / Offering操作 / 復帰寄り
- 瞑想
- 虚無を満たす
- 地下の声
- 残火再燃
- 神秘重視

### 調査
- 足跡
- 野営跡
- 斥候目撃

これらの境界はまだ動かしてよい。

カードを具体化した結果、

- 開発と生産を分ける
- 緊急対応をCOMMAND系へまとめる
- 神秘を独立させる
- 調査を強制枠専用扱いにして通常weightから分離する

など、どの形にも変更可能とする。

---

## 6. Stage別weightを決める前のDecision Gate

Stage別カテゴリweightの確定は、少なくとも以下が揃ってから行う。

1. Stage1でliveに戻す非LANDカードの候補が具体化している。
2. 各カードの主目的が「盤面形成 / 盤面利用 / 資源変換 / 防衛準備 / 情報取得 / その他」のどこにあるか説明できる。
3. 同じOfferingに並んだとき、プレイヤーに同系統の選択肢として見えるか確認できる。
4. 休眠Legacyカードを数合わせでカテゴリへ入れない。
5. Investigation保証と通常カテゴリweightを混同しない。

ここまで揃うまでは、Stage別weightは仮値にも固定しない。

---

## 7. 現在の結論

現段階の設計順序は以下。

```text
LAND（確定）
  ↓
Stage1非LANDカードを具体化
  ↓
実際のカード群からOfferingカテゴリを発見
  ↓
offering.categoryへ割り当て
  ↓
Stage別カテゴリweightを決定
  ↓
カテゴリ内で個別card weightを調整
```

カテゴリからカードを逆算せず、カードからカテゴリを発見する。
