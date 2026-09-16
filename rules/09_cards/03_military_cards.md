# 09-3. 軍事・防衛カード — 実装状態台帳

> **Status:** Active set + Retired legacy boundary
>
> 現在の軍事カード正本データは `game/src/data/military_cards.json` を参照する。
> 本文書では、通常Offeringへ入る**現役カード**と、旧Trial予約カードとして**retired化されたカード**を分離して扱う。

---

## 1. 現在の現役軍事カード

現 `military_cards.json` に存在する軍事カードは以下の3枚。

| ID | 状態 | 現在の実挙動 / 注意点 |
| :--- | :---: | :--- |
| `CMD_VIGILANCE` | **Implemented / Internal dual path** | 🧱15。次Verseから2Verse、`DefenseSystem.calculateMaxDefense()` は最大🛡️へ+3する。同時に `GameState.gainDefense()` にも有効中の🛡️獲得量+3ロジックが残る。プレイヤー説明は後者だけを説明しており、最大値+3は表示説明に現れない。 |
| `CMD_MILITARY_FOCUS` | **Implemented / Internal taxonomy gap / threshold conflict** | `activeDrawBias={ targetCategory:"MILITARY", type:"UNTIL_DEFENSE", untilValue:20 }` を設定し、Offering抽選時に `category:"MILITARY"` の重みを×2する。最大🛡️20以上で解除。ただしEligibilityは20ちょうどを許可するため、最大🛡️=20では発動直後に解除される。 |
| `CMD_IRON_RAMPART` | **Implemented / Player-facing description mismatch** | 🧱20。runtimeは `DefenseSystem.increaseMaxCapacity(25)` により**最大🛡️容量+25**し、本営近郊1マスあたり恒久最大🛡️+2を加える。表示説明の「🛡️+25 即時獲得」は現在🛡️回復を意味するように読めるが、実装は最大容量増加であり、現在🛡️を同量回復しない。 |

### 《警戒》の二重意味

現在の実装には同じ `vigilanceTurns` を読む処理が2箇所ある。

1. `DefenseSystem.calculateMaxDefense()`
   - 有効中、最大🛡️ +3。
2. `GameState.gainDefense()`
   - 有効中、回復/獲得しようとする🛡️へ +3。

表示説明は「獲得する全ての🛡️に+3」であり2の意味だけを表すが、実コードでは1も同時に存在する。

ただし `gainDefense()` の通常callerは本監査で確定できていないため、プレイヤーが常に両効果を受けるとはまだ扱わない。

分類: **INTERNAL_CONFLICT / duplicate semantic path candidate**

### 《鉄壁》の最大値/現在値境界

プレイヤー表示は、

> 防衛力 🛡️+25 即時獲得 ＆ 本営周囲8マスに 🛡️+2/T 永続付与

となっている。

しかしruntimeは、

```text
DefenseSystem.increaseMaxCapacity(25)
permanentVicinityDefenseBonus += 2
```

である。

`increaseMaxCapacity()` は最大容量を増やした後に `reconcileWithMax()` するが、現在🛡️が最大値未満なら現在値はそのまま保持される。

また `permanentVicinityDefenseBonus` はVerseごとの🛡️獲得ではなく、各本営近郊マスを最大🛡️計算へ恒久加算する。

したがって現在の説明文は、**最大🛡️と現在🛡️を混同し、さらに恒久容量補正を `/T` 産出のように表現している。**

### Military Focus のカテゴリ注意

Draw Biasは軍事テーマ全体ではなく、`card.category === "MILITARY"` の完全一致で適用される。

そのため、軍事的な意味を持つカードでも `category:"COMMAND"` ならBias対象外となる。

---

## 2. retired Trial予約カード

現在の `CardCycleSystem` は以下を `RETIRED_TRIAL_RESERVED_CARD_IDS` として明示的に永久除外する。

- `CMD_MUD_OBSTACLE`
- `CMD_HIGH_GROUND_FORMATION`
- `CMD_CAVALRY_SCOUTS`
- `CMD_OUTPOST_SIGNAL`
- `CMD_BALLISTA_SET`
- `CMD_GUIDED_DEFENSE`
- `CMD_SCOUT_ENEMY`
- `CMD_SCORCHED_RETREAT`
- `CMD_CAVALRY_HOST`
- `CMD_LOCAL_IRON_ARMAMENT`
- `CMD_OMEN_DREAM`
- `CMD_STONE_STRONGPOINT`
- `CMD_GREAT_RAMPART_PROJECT`
- `CMD_OUTPOST`

これらは、

- Cooldown判定上つねに再提示不可
- UNIQUE消費判定上も復帰不可
- 候補不足フォールバックでも復活不可

となる。

したがって、旧発動分岐や旧state fieldがコード内に残っていても、**現在の通常Offeringで使用可能な現役カードとして扱わない。**

分類: **LEGACY / RETIRED**

---

## 3. 旧「次Trial予約効果」state

`GameState` には現在も、後方互換・旧実装残存として、

- `nextTrialDamageMitigation`
- `nextTrialMultiplier`

の初期fieldが残る。

ただし現在の `StateSerializer` はこれらを保存しない。

さらに診断テストで、

> `nextTrialDamageMitigation` / `nextTrialMultiplier` をserializeしてはならない

という境界が固定されている。

したがって以前の「永続化済みwrite-only Trial modifier」という分類は古い。

現在は、

> **retired Trial予約カード由来のlegacy state。通常runの永続Gameplay契約には含めない。**

と扱う。

---

## 4. 現在のTrial戦闘で確実に使われる軍事要素

現Trial Resolverが確実に使用するのは、カード予約flagではなく主に以下。

- 配備した現在🛡️
- `1🛡️ = 5⚔` 換算
- 森 / 深い森の展開制限
- 湿原出口倍率
- 砂漠出口倍率
- 高低差倍率
- 盤面上の迎撃地点

旧Mud / High Ground Formation / Cavalry / Guided Defense等の予約flagは、現役カードではない。

したがって現在のTrialについては、

> **「現役軍事カードのTrial予約効果が未接続」ではなく、「旧Trial予約カード群そのものをretired化し、Trialは盤面・地形・🛡️中心へ整理中」**

と見る方が正確。

---

## 5. Trialとの資源境界

軍事カードのretired化とは別に、Trial通常ラン統合には未完成箇所が残る。

- Trial開始時の `availableDefense` は通常GameStateからコピーされる。
- 迎撃計画で消費した🛡️はTrial-local `state.human.availableDefense` のみ減少する。
- 通常GameStateの `currentDefense` には消費結果がコミットされない。
- 本営到達🔥損害は `EmberSystem` 注入時に通常GameStateへwrite-throughする。

したがって現在も、

> **🛡️はTrial-local、🔥損害は通常GameStateへ直接反映し得る**

という非対称境界は残る。

詳細は `99_trial_integration_boundary_audit.md` を参照する。

---

## 6. 🛡️最大値と現在値

軍事カードの「🛡️を増やす」という表現は、最大値と現在値を区別する。

`DefenseSystem.increaseMaxCapacity()` は最大容量を増加させる。現在🛡️が自動的に同量回復するとは限らない。

カード説明では、

- 最大🛡️容量+X
- 現在🛡️回復+X

を別表現にする。

---

## 7. 現在の結論

軍事カード周辺は、旧Trial予約カードを多数抱えた状態から、現在は以下へ整理されている。

```text
現役
├─ 警戒
├─ Military Focus
└─ 鉄壁

旧Trial予約カード
└─ CardCycleSystemでretired固定
   └─ 通常Offeringへ復帰しない
```

今後Trial統合を監査する際は、retiredカードの旧flagを現行Gameplay要件として数えない。
