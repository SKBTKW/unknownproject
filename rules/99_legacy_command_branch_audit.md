# Legacy Command Branch Audit

> **Status:** Audit Ledger / Non-Authority
>
> `DeckManager.playCommandCard()` に発動分岐が残る一方、現行 `COMMAND_CARDS_MASTER` にカード定義が存在せず、通常Offeringから到達できないことを確認した分岐を記録する。

## Confirmed unreachable branches

| ID | DeckManager branch | Current COMMAND_CARDS_MASTER | 分類 |
| :--- | :---: | :---: | :--- |
| `CMD_LAND_EXPLORATION` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_PASTORAL_EXPANSION` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_LIME_CONSTRUCTION` | あり | なし | **LEGACY / normal Offering unreachable** |
| `FAC_GREAT_WINDMILL` | あり | なし | **LEGACY / normal Offering unreachable** |
| `LGD_DESPERATE_PACT` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_AGRICULTURAL_POLICY` | あり | なし | **LEGACY alias / normal Offering unreachable** |
| `CMD_BLACK_MARKET` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_CONSERVE_EMBER` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_GRAND_CULTIVATION` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_SYSTEMATIC_LOGGING` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_SINGLE_CLEARING` | あり | なし | **LEGACY / normal Offering unreachable** |
| `CMD_OUTPOST` | あり | なし | **LEGACY / normal Offering unreachable** |

## Notes

### `CMD_LAND_EXPLORATION`

旧standalone探索系。現行方針では独立探索を中核仕様から外しており、カードmasterにも存在しない。

### `CMD_PASTORAL_EXPANSION`

発動すると `pastoralExpansionActive=true` を立てる旧分岐が残るが、現masterにカード自体がない。現行経済カード `CMD_PASTORAL_FARM` とは別ID。

### `CMD_LIME_CONSTRUCTION`

発動すると `limeConstructionActive=true` を立てる旧分岐が残るが、現masterにカード自体がない。現行 `CMD_LIME_KILN` とは別ID。

### `FAC_GREAT_WINDMILL`

`activeConstructionProjects` へ大風車建設projectを登録する分岐が残るが、現masterに定義がない。

### `LGD_DESPERATE_PACT`

旧《背水の盟約》分岐。🔥+5、Offering4枚化、`nextTrialMultiplier=1.5` を設定するが、現masterに定義がない。

このため `nextTrialMultiplier` は現GameStateに残るものの、少なくともこの旧分岐は通常Offeringから発火しない。

### `CMD_AGRICULTURAL_POLICY`

旧《農地改革》系alias。現行masterと通常Offeringが使用するIDは `CMD_AGRICULTURAL_REFORM` であり、そちらの発動分岐は別途存在する。したがって現《農地改革》が壊れているわけではなく、旧alias分岐だけが残っている。

### その他の旧分岐

`CMD_BLACK_MARKET`、`CMD_CONSERVE_EMBER`、`CMD_GRAND_CULTIVATION`、`CMD_SYSTEMATIC_LOGGING`、`CMD_SINGLE_CLEARING`、`CMD_OUTPOST` も発動分岐は残るが現masterには存在しない。

これらのstate・Buff・コメント・古い効果値を、現行カード仕様の根拠として扱わない。

## Audit rule

本表の項目は「コードが存在する」ことだけを理由に現行カード仕様へ戻さない。

再採用が明示されない限り、

> **legacy compatibility / dead branch candidate**

として扱う。
