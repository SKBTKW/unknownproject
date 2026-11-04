# Causal Rule Slice v1

Status: IMPLEMENTED as a development-only validation slice. It is not connected
to production Trial progression, combat outcome, Opportunity, Fortune, AI, or UI.

## Contract

`dev/causal_rule_slice_v1.js` accepts an already resolved `battlefieldContext`,
one explicit opposing action, target actor/force identity, and explicit Fact and
Trait evidence. It returns a frozen `DEV_CAUSAL_RULE_SLICE_V1` envelope with one
evaluation per rule. Every evaluation identifies its Rule ID, input references,
target, classification, evidence, missing conditions, unresolved prerequisites,
and the unchanged resolution boundaries.

The classifications are deliberately separate:

- `CONFIRMED_CONDITION`: an existing SSOT has confirmed a battlefield condition.
- `TACTICAL_CONSTRAINT`: confirmed evidence constrains a tactic but does not
  resolve the tactic or attack.
- `UNRESOLVED`: evidence is missing, the rule is not applicable, or another
  resolver must decide the condition.

Trait identifiers in this module are validation evidence vocabulary. They do not
add race traits to production master data.

## Reused SSOT

- `BattlefieldCapabilityProjector` owns terrain family and frontage projection.
- `EnemyForceTerrainInteractionResolver`, projected through
  `BattlefieldContextResolver`, owns body-size deployment interaction.
- `RelativeEngagementResolver` owns front/flank position.
- `TacticRequirementEvaluator` reports independent missing context, capability,
  and state requirements for the frontal-resistance and detection rules.
- `freezeBattleResolutionData` provides the immutable result boundary.

The slice contains no terrain-ID mapping, position-vector calculation, deployment
ratio, state reducer, success probability, or RNG.

## Rules and limits

1. Forest/deep-forest plus large body confirms deployment constraint only when
   the existing terrain-interaction deployment value is `CONSTRAINED` or
   `SEVERELY_CONSTRAINED`. Forest frontage alone never invents deployment failure,
   delayed support, or isolated vanguard.
2. Large body plus a human frontal attack constrains breakthrough only when an
   explicit physical trait and maintained-formation Fact are supplied. Attack
   capability, equipment, speed, disruption, and breakthrough resolution remain
   unresolved.
3. Small body plus an explicit sensory trait and flank ambush approach yields
   detection possibility only. Approach reachability, actual detection, response
   capacity, and attack success remain separate unresolved prerequisites. Mobility
   and unit control cannot substitute for sensory evidence.

Every rule reports that Battle State, tactic/attack result, Normal Outcome,
Opportunity, and Fortune remain unchanged. A later causal-integration phase may
translate confirmed evaluations into Foundation inputs after a separate contract
is approved.
