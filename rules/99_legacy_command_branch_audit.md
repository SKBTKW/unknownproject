# Legacy Command Branch Audit

> **Status:** Audit Ledger / Non-Authority
>
> `DeckManager.playCommandCard()` 等に旧分岐が残っていても、現在の通常Offeringから到達できないものを整理する。

## 1. master定義がなく通常Offeringから到達不能

| ID | 分類 |
| :--- | :--- |
| `CMD_LAND_EXPLORATION` | **LEGACY / master absent** |
| `CMD_PASTORAL_EXPANSION` | **LEGACY / master absent** |
| `CMD_LIME_CONSTRUCTION` | **LEGACY / master absent** |
| `FAC_GREAT_WINDMILL` | **LEGACY / master absent** |
| `LGD_DESPERATE_PACT` | **LEGACY / master absent** |
| `CMD_AGRICULTURAL_POLICY` | **LEGACY alias / master absent** |
| `CMD_BLACK_MARKET` | **LEGACY / master absent** |
| `CMD_CONSERVE_EMBER` | **LEGACY / master absent** |
| `CMD_GRAND_CULTIVATION` | **LEGACY / master absent** |
| `CMD_SYSTEMATIC_LOGGING` | **LEGACY / master absent** |
| `CMD_SINGLE_CLEARING` | **LEGACY / master absent** |

### 代表例

`CMD_AGRICULTURAL_POLICY` は旧aliasで、現行《農地改革》は `CMD_AGRICULTURAL_REFORM`。

`LGD_DESPERATE_PACT` は旧《背水の盟約》で、`nextTrialMultiplier` を書く分岐が残るが現masterから通常発火しない。

---

## 2. CardCycleで明示retiredされたTrial予約カード

現在 `CardCycleSystem.RETIRED_TRIAL_RESERVED_CARD_IDS` に含まれるカード:

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

これらは、古い定義や発動分岐が残っていても、Card Cycle上で通常Offeringへ戻らない。

- `isRetiredCard()` → true
- `isInCooldown()` → 常時true
- UNIQUE消費判定上も復帰不可
- 候補不足フォールバックでも復活不可

分類: **LEGACY / RETIRED / normal Offering unreachable**

---

## 3. retired Trial modifier state

旧Trial予約カード由来の以下fieldはGameState初期値だけ残る。

- `nextTrialDamageMitigation`
- `nextTrialMultiplier`

現在のStateSerializerはこれらを保存しない。

診断テストでも「serializeしてはならない」と固定されている。

したがって現在の永続Gameplay仕様として扱わない。

---

## 4. Audit rule

次の3つを区別する。

```text
現masterに存在 + Offering到達可能
→ 現役候補

masterに定義なし
→ LEGACY / master absent

CardCycle RETIRED_TRIAL_RESERVED_CARD_IDS
→ LEGACY / RETIRED
```

コード分岐やstate fieldが残っていることだけを理由に、現行カード仕様へ戻さない。
