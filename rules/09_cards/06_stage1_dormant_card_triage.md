# 09-6. Stage1 Dormant Card Triage

> **Status:** Design triage / Non-runtime authority
>
> Integration target: `AoT260924`
>
> この文書はDormantカードをlive Offeringへ戻す変更ではない。
> Stage1カテゴリ設計前に、既存15枚を「そのまま数えない」ための採用判断メモである。

---

## 1. 前提

現在live OfferingでActiveなのは `LAND` と、解禁後の `INVESTIGATION`。

Stage1設定を持つ既存非LANDカードのうち、以下15枚は source master に残るが
`CardRuntimePolicy` により通常OfferingではDormant。

この15枚をそのままカテゴリ母数に含めてStage weightを決めてはならない。

---

## 2. Triage分類

### A. LIGHT_FIX_RETURN

**コンセプトと主要効果を維持してよい。**
説明・寿命・細部の修正後、Stage1候補へ戻す価値が高い。

| ID | 理由 | 戻す前の最低修正 |
| :--- | :--- | :--- |
| `CMD_RATIONING` | 緊急時の維持費軽減として役割が明快。実効果も接続済み。 | **v1 cleanup済み:** 50%化へ統一。 |
| `CMD_ABANDONED_SETTLEMENT` | 🔥を賭ける2D6リスク選択として独立性が高く、実処理も完成度が高い。 | Stage1での報酬量と出現条件だけ再監査。 |
| `CMD_EMERGENCY_LEVY` | 🌾→🧱の緊急変換として、余剰食料と資材不足をつなぐ役割が明快。 | Stage1経済に対する交換比率を再監査。 |
| `CMD_REKINDLE_EMBER` | 🔥危機からの復帰は神秘系の中核候補。主要効果は動く。 | **v1 cleanup済み:** ✨10→🔥+3へ単純化し、Hold維持費免除を分離。 |

**件数: 4**

---

### B. REWORK_BEFORE_RETURN

**カードの役割は残したいが、現在実装を製品仕様として復帰させない。**

| ID | 残す理由 | 作り直しポイント |
| :--- | :--- | :--- |
| `CMD_WETLAND_RECLAMATION` | 土地を「得る」LANDに対し、既存土地を「利用/変換する」カードとして差別化できる。 | 自動走査変換をやめ、target/Zone Conversion境界へ統一。 |
| `CMD_LOGGING_CAMP` | 森林を資材経済へ変換するStage1投資として重要。 | 即時🧱+8ではなく、Special Block/Zone Conversionの恒久価値へ再設計。 |
| `CMD_GRANARY` | 食料生産と維持費をつなぐ内政投資として役割がある。 | counterだけで終わらずMaintenance consumerを接続するか、効果自体を再設計。 |
| `CMD_AGRICULTURAL_REFORM` | 平地構築を後から伸ばすシナジーとして有用。 | 全平地一律+1ではなく、選択範囲/Zone単位など盤面判断へ戻す。 |
| `CMD_PASTORAL_FARM` | 資源発見→土地利用という連鎖を作れる。 | 即時🌾+2中心ではなく、施設として何を恒久化するか確定。 |
| `CMD_VIGILANCE` | Trial前の防衛準備を通常Verseで行う役割は必要。 | 最大🛡️+3と獲得🛡️+3の二重意味を一本化。Trial予約flagには戻さない。 |
| `CMD_MEDITATION` | 神秘からLAND形成へ干渉する橋渡しは面白い。 | 「保証」か「weight補正」かを選び、条件と表示を一致させる。 |

**件数: 7**

---

### C. DEFER_UNTIL_SYSTEM_EXISTS

**コンセプトは捨てないが、依存システムが未完成なのでStage1カテゴリ設計の母数に入れない。**

| ID | 保留理由 | 必要な先行決定 |
| :--- | :--- | :--- |
| `CMD_FILL_THE_VOID` | Command不足コストを✨で補填するconsumerがない。 | 一般カード支払いで✨代替を許すか、その交換率と対象資源を確定。 |
| `CMD_VOICE_BENEATH_EARTH` | 「次Offeringを資源タグから寄せる」consumerと状態寿命がない。 | Offering操作API、タグ抽選、1枠保証/weight補正の意味論を確定。 |

**件数: 2**

---

### D. MOVE_TO_DIRECTIVE_OR_REDESIGN

**現在の「重視カード」としてそのまま復帰させない。**
OfferingカテゴリweightとDirective設計を先に決める。

| ID | 理由 |
| :--- | :--- |
| `CMD_MILITARY_FOCUS` | 自分自身がOfferingに出て、以後MILITARYカテゴリweightを上げる構造は、Stage別カテゴリweight / Directiveと責務が重なりやすい。 |
| `CMD_MYSTIC_FOCUS` | 同上。現taxonomyの不整合もあり、神秘テーマ全体を正しく対象化できていない。 |

**件数: 2**

土地重視も含む「重点方針」は将来Directive/Event側から
Offering category multiplierや同カテゴリ3枚許可へ作用させる方が、
カード1枚でメタ抽選ルールを変更するより責務が明確。

---

## 3. 集計

```text
Stage1 dormant authored cards: 15

LIGHT_FIX_RETURN          4
REWORK_BEFORE_RETURN      7
DEFER_UNTIL_SYSTEM_EXISTS 2
MOVE_TO_DIRECTIVE         2
```

したがって、現在のカテゴリ設計で「Stage1非LANDが15枚ある」と数えない。

直近の製品候補として見るなら、

```text
LAND
INVESTIGATION 3枚
+ LIGHT_FIX_RETURN 4枚（修正後）
+ REWORK群から必要最小限
```

という順でカードプールを再構築する。

---

## 4. Stage1で優先して具体化するカード

カテゴリを発見するための次の設計対象は、15枚全部ではなく以下を優先する。

### 第一群 — 緊急対応 / 状況対応
- 配給
- 緊急徴発
- 残火再燃

この3枚は盤面を増やさず、現在状態へ対応する。

### 第二群 — 盤面利用 / 恒久投資
- 干拓
- 伐採拠点
- 穀倉
- 農地改革

この4枚はLANDで作った盤面を利用・強化する。

### 第三群 — 防衛準備
- 警戒

Trial中カードではなく、Trial前に盤面/🛡️状態を整えるカードとして再設計する。

### 独立性が高いもの
- 放棄された集落

2D6のリスクイベントカードとして、通常の「開発」「緊急対応」と別に見える可能性がある。

この実物群を設計してから、
「これらをOffering上で何カテゴリに束ねると選択肢として自然か」を決める。

---

## 5. カテゴリ設計への含意

現段階ではまだ正式カテゴリ名を作らない。

ただしカードの選択体験として、少なくとも以下の差は観察する。

1. **新しい盤面を得る** — LAND
2. **既存盤面へ投資する**
3. **不足・危機へ対応する**
4. **Trialへ備える**
5. **情報を得る** — Investigation
6. **Offeringそのものを操作する**

この6つが本当に別カテゴリになるとは限らない。
カード数が少なければ2〜4をまとめる可能性もある。

---

## 6. 禁止事項

このTriageを理由に、まだ以下を行わない。

- Dormant 15枚を一括でruntime Activeへ戻す
- `COMMAND / MILITARY / MYSTIC` をそのままOffering正式カテゴリへ採用する
- Stage別カテゴリweightを固定する
- FocusカードをDirectiveへ即移植する
- Partialカードのcostだけ先に引き上げる
- 表示説明へruntimeを無条件に合わせる

カードの最終仕様を決めてから、データ・効果・Eligibility・表示を同じ変更単位で同期する。
