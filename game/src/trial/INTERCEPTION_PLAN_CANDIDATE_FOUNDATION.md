# Interception Plan Candidate Foundation

Status: **foundation only / not wired to production gameplay**

This contract prepares Trial for presenting a small number of meaningful
"how to intercept here" choices without exposing raw spatial controls.

## Preserved causal chain

Deployment Origin
→ Maneuver
→ humanEngagementOrigin
→ battleLocation
→ Battlefield Context
→ Tactic Requirement
→ Battle Action
→ Cause / Consequence

The following identities remain distinct:

- Deployment Origin: strategic/operational departure point such as HQ or a future semantic military origin.
- humanEngagementOrigin: the final pre-contact origin adjacent/connected to the battle.
- battleLocation: where contact occurs.
- tacticIntent: what the player is attempting, not a guaranteed result.
- initialPositioning: expected/derived initial relation such as FRONT or LEFT_FLANK, not tactic success.

## Foundation responsibilities

The candidate model may carry:

- semantic Deployment Origin data
- maneuver summary/reference
- humanEngagementOrigin
- initial Positioning
- opaque tactic intent
- Tactic Requirement-shaped requirements
- capability/infrastructure evidence
- burden summaries

The compactor groups route-level proposals by semantic tactic intent and keeps
only a small representative set. It has no universal tactic score. A future
caller may inject a representative policy after design is decided.

## Explicit non-goals

This foundation does **not**:

- implement pathfinding
- expose raw paths to UI
- select a facility by facility ID
- define flank-attack success
- define tactic availability
- add Deployment Capacity
- modify Defense Allocation
- roll dice or use RNG
- change Battle Outcome
- add Presentation/UI
- wire candidates into current Trial runtime

The existing engagement-origin selection API remains a lower-level primitive.
A future runtime adapter may project the selected plan's
humanEngagementOrigin into that API without exposing origin selection directly
to the player.


## Requirement evaluation preparation

A pure TacticRequirementEvaluator may be used by future plan generation to
answer whether declared semantic prerequisites are currently present.

It reports missing axes separately (Context / Capability / Deployment / State /
Infrastructure / Timing). It intentionally does not:

- infer tactic success
- convert eligibility into Battle Outcome
- produce a universal score
- inspect card or facility IDs
- roll dice
- mutate Battle State

This keeps "can attempt this plan" separate from "the tactic succeeds".


## Candidate generation preparation

The InterceptionPlanCandidateGenerator composes existing semantic boundaries:

1. DeploymentOriginResolver provides semantic departure origins.
2. An injected maneuverProvider supplies maneuver/route proposals.
3. TacticRequirementEvaluator filters only by declared prerequisite eligibility.
4. InterceptionPlanCandidate captures the preserved causal inputs.
5. InterceptionPlanCandidateCompactor reduces route multiplicity to a small semantic set.

The generator intentionally performs no pathfinding. It does not infer a
Barracks/HQ identity from card IDs and it does not treat tactic intent or
initial Positioning as success.

A future runtime adapter may feed the selected candidate's
humanEngagementOrigin into the existing engagement-origin runtime. That hookup
is intentionally deferred until selection lifecycle and UI ownership are
defined.
