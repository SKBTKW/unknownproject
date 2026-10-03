# FirstRun Verse8 Investigation UI execution

Base: AoT261002 `f961c132a5625e939fdba4f03b37f90d10159223`.

## B: Confirmed UI routing defect

The deployed Verse8 card confirmation closed without consuming the card or
producing an Investigation result. `UIController.playCommandCard` sent every
non-LAND card to `GameEngine.playCommandCard`. The existing runtime policy
correctly rejects Investigation there with `NOT_A_COMMAND_CARD`.

`GameEngine.executeInvestigationCard` is the existing authority for source
validation, observation, KnownEnemyState, action consumption and Warning facts.
The fix changes only the UI dispatch to that API for INVESTIGATION cards.

Before the fix, Stage1 certification through the UI execution boundary reported
22 PASS / 1 FAIL at Investigation. After the fix it reports 23 PASS / 0 FAIL.
Certification now uses actual card selection, the production ModalSystem
confirmation handler and production UI execution, rather than directly calling
the Domain API. The headless DOM/rendering surface supplies no gameplay result.

## B candidate: No observable fragments on an undeveloped board

Independent reproduction: canonical seed `20261002`, FirstRun, normal Next Verse
to Verse8 without land development. The dedicated Investigation API returns
`NO_OBSERVABLE_FRAGMENTS`; card and action remain unconsumed, reports unchanged.
The focused test preserves this observed rejection. It is not a successful
Investigation or completion claim. Determine the earliest broken observable
profile/Offering contract separately; do not invent observations to pass tests.

## E: Missing Investigation localization

The deployed Offering/confirmation shows `INVESTIGATE_FOOTPRINTS_NAME` and
`INVESTIGATE_FOOTPRINTS_DESC` as raw keys. Deferred from this execution fix.

## Boundaries

No Investigation Domain, RNG, dice, card definition, balance, lifecycle guarantee,
completion persistence or Trial authority change. Modified UI has not yet been
pushed/deployed; its real-browser confirmation remains pending.
