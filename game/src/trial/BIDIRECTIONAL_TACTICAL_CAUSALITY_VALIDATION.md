# Phase 2 — deterministic tactical causality validation

Status: IMPLEMENTED as a development-only validation model, not production rules.
User approved caller ordering/decisions/evidence, single consumption per action ID,
reevaluation after state changes, and termination at the explicit input end.

## API and separation

`dev/tactical_causality_validation_model.js` exports
`validateTacticalCausality(input)` and `restoreTacticalCausality(envelope)`.
No production module imports this model. No UI, commander AI or RNG is added.

Input is JSON data:

- `baseSnapshot`: existing immutable BattleResolutionSnapshot. It is copied without
  changing any production field, including Normal Outcome, Opportunity or Fortune.
- `tactics`: unique `tacticId`, HUMAN/ENEMY `actor`, allowed `actionTypes`, and an
  existing TacticRequirement using `requiredStates`. Other axes must be empty in
  this bounded adapter; non-empty unsupported axes are rejected, not ignored.
- `initialState`: human `freedom` FREE/CAPTURED/UNKNOWN and `escapeRoute`
  AVAILABLE/BLOCKED/UNKNOWN; enemy `formation` ORDERED/DISRUPTED/UNKNOWN and
  `pursuit` NONE/PURSUING. `initialStateReason` is mandatory. These are external
  starting observations, explicitly labelled unverified, not pathfinding proofs.
- `actions`: externally ordered unique action IDs, actors, tactic IDs, action types
  and reasons. Duplicate IDs are retained as REJECTED history rows, never applied
  again. No implicit side priority exists.

The caller declares validation tactic requirements. The test fixture declares
charge = LARGE_BODY + DEPLOYMENT_SPACE + ORDERED_FORMATION, skirmish =
FREE_MOVEMENT + ESCAPE_ROUTE, and intercept/hold = FREE_MOVEMENT. These are
validation assumptions, not approved production sufficiency rules.

`tactical_causality_state.js` projects eligibility tokens and applies consequences.
It reuses BattlefieldContext's existing body-size/frontage projection and
TacticRequirementEvaluator. State tokens cannot be injected as external tokens.
`tactical_causality_action.js` validates external decisions and resolves only
bounded semantic changes; it does not select actions or calculate combat.

## Actions and causal chains

- HUMAN SKIRMISH requires known freedom and an available escape route. Selection
  alone causes no disruption and grants no damage reduction.
- ENEMY PURSUE/IGNORE must reference a preceding executed SKIRMISH. PURSUE requires
  boolean `overextended` plus `evidence.overextended`; true produces pursuit state,
  existing VANGUARD_ISOLATED Cause and FORMATION_DISRUPTED Consequence. False
  preserves formation. IGNORE records its decision reason and preserves formation.
- ENEMY CAPTURE/BLOCK_ESCAPE require boolean `success` and `evidence.success`.
  Success changes freedom/escape availability, invalidating whichever human
  requirements depend on that state. Failure changes no state.
- INTERCEPT/HOLD/COLLECTIVE_CHARGE observe their declared eligibility and record
  execution; they do not apply numerical combat or new victory effects.

Every accepted state change triggers both sides' reevaluation. Eligibility never
executes another action. Unchanged state does not produce duplicate change events.
Only the finite input schedule advances execution; no recursive event queue exists.

## Evidence and contradiction limits

Known capture or unavailable escape rejects normal skirmish/disengagement even if
the caller asks for it. Pursuit cannot refer to a future, missing or rejected lure.
An action cannot borrow a different tactic's requirements. Missing reasons, invalid
booleans, actor mismatches and unknown action types fail closed.

If `movement` is supplied, `canEnter: false` rejects execution. Enemy movement with
a `destinationCell.terrainId` additionally uses existing
TrialTerrainEffectResolver.canEnterNormalRoute; a mountain route cannot be entered
just because external input claims success. Positive route access still remains
external evidence: existing route permission does not prove reachability.

No pathfinder, pursuit distance, capture probability or hidden physical rule is
invented. Success/overextension, initial observations and positive movement evidence
are labelled UNVERIFIED_EXTERNAL_FACT. Reasons make provenance inspectable, not
independently true. This model does not certify arbitrary external claims against
unavailable board/physics data.

## Snapshot and replay

The frozen DEV_TACTICAL_CAUSALITY_V1 envelope contains the unchanged production
snapshot, complete original inputs, ordered action history, decision/evidence,
per-action eligibility, Cause/Consequence/event IDs, each state transition and both
sides' before/after eligibility (including missing-state reasons). The existing
BattleCausalEventResolver produces ENEMY_VANGUARD_ISOLATED for that existing cause;
new development events remain inside the separate envelope.

Restore replays explicit inputs and compares the complete envelope, rejecting
modified derived history. This is deterministic development replay, not an added
production save-schema migration. The model consumes no RNG; identical input with
any unchanged external RNG state produces identical results without advancing RNG.

## Validation and handoff

Focused command: `node scratch/test_trial_bidirectional_tactical_causality.mjs`.
25 cases cover the A/B chains, reverse capture/route blocking, failed interference,
plains/forest/hill differences, order reversal, evidence rejection, duplicates,
bounded termination, replay/tampering, immutable production snapshot and zero RNG
consumption. The test is registered in the canonical supplemental suite.

Run Full Inspection on the clean committed TASK; see chat handoff for actual result
and HEAD. Browser rendering is not tested because this change adds no presentation.

Production commander policy, action-order arbitration, repeated turns, retreat,
halt versus delay, zone/LINK, numerical tactical effects, defense conversion and
Ember settlement remain ON_HOLD. Next phase may replace external judgments through
an explicitly agreed production adapter without changing the existing victory or
Opportunity/Fortune contracts implicitly.
