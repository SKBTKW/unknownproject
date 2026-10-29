# Bidirectional Tactical Causality — Phase 1 audit

Date: 2026-10-23 (JST)
Status: Phase 1 audited. Phase 2 validation contract subsequently approved by user;
see BIDIRECTIONAL_TACTICAL_CAUSALITY_VALIDATION.md for implementation and limits.
Target: AoT261015
Task: aot-task/AoT261015/trial/bidirectional-tactical-causality-v1
Fetched base / current code HEAD: 737e2e7244d0f7fb8f7336a6cb01a888393a98a8
Owner: Trial bidirectional tactical causality担当

## Scope

Audit existing domain contracts and identify a safe minimal extension. No runtime
changes in this phase. No new victory, retreat, breakthrough, RNG, soldier-count,
defense conversion, Ember settlement, UI, zone or LINK rules.

## Existing contracts and evidence

Paths below are relative to game/src/trial/ unless prefixed scratch/.

| Area | Evidence and reuse | Gap |
| --- | --- | --- |
| Facts | systems/battlefield_context_resolver.js retains interception, approach and human origin, terrain E/GL, spatial vectors, enemy body/equipment/deployment and combat data. systems/battle_fact_resolver.js emits terrain, high-ground, large-body, equipment, reserve and power facts. | Weather/time/personality/formationStretch/zone/LINK are optional futureInputs, not established simulation rules. Context does not retain selected enemy tactic or commander. |
| Terrain capabilities | systems/battlefield_capability_projector.js already owns frontage, concealment, movement, retreat, visibility and elevation projection. OPEN has OPEN frontage; forest/hill LIMITED. | Frontage alone does not prove formation, pursuit success or an actual escape route. Do not infer those outcomes from terrain IDs. |
| Position | systems/relative_engagement_resolver.js resolves FRONT/REAR/flanks from three positions. Missing vectors remain UNRESOLVED. | Does not resolve pursuit, capture or route blocking. |
| Eligibility | domain/tactic_requirement.js and systems/tactic_requirement_evaluator.js support context/capabilities/deployment/states/infrastructure/timing, with per-axis missing reasons. systems/interception_plan_candidate_generator.js uses them to filter planning candidates. | No combat-time evaluation of action.requirements; planning eligibility is not execution success. |
| Decision | systems/enemy_tactic_resolver.js derives existing eligible tactics from equipment, terrain and commander level; systems/enemy_tactic_selection_resolver.js ranks by injected priority with stable ties. flow/trial_controller.js attaches selection to battle input. | No personality-based pursuit/ignore/capture decisions. FRONTAL_BREAKTHROUGH is heavy-equipment based, not a declared collective-charge contract; do not silently rename it. |
| Action | domain/battle_action.js preserves actor, target, location, timing, requirements and provenance. flow/trial_battle_coordinator.js currently emits HUMAN INTERCEPT. | HOLD/SKIRMISH/collective-charge execution contracts and player selection ingress are absent from the inspected battle path. |
| Causality | systems/battle_causality_resolver.js -> battle_consequence_resolver.js -> second causality evaluation in battle_resolution_snapshot_factory.js. Existing chain: movement constrained -> SUPPORT_DELAYED -> VANGUARD_ISOLATED when formationStretch is supplied. Events retain sourceAction/sourceFacts/sourceCauses/derivedFrom. | Rules are largely enemy-targeted. formationStretch is supplied, not produced by pursuit. No general action-driven shared-state reducer or opposing tactic invalidation. |
| State | systems/battle_state_projector.js projects deployment/mobility/cohesion/reserve/local superiority/supportDelay/withdrawal/collapse. | State is a terminal aggregate, not an input to later eligibility. Human escape/capture state is absent. Actor-specific state is necessary to avoid mixing sides. |
| Reevaluation | Snapshot factory performs exactly two cause evaluations, one consequence pass and ID/type deduplication. | This bounds the existing chain only. It is not a general conflict order, repeat limit or fixed-point stopping policy. New rules must not inherit an accidental ordering. |
| Outcome | flow/trial_battle_coordinator.js calculates combat before creating the snapshot. systems/battle_normal_outcome_projector.js copies outcome/margin/power/damage and adds causal summaries/postBattleState. | Causal state currently does not recompute numerical combat or replace victory. Preserve that boundary. Changing favorable/danger causes can affect downstream Opportunity and requires regression checks even without power changes. |
| Snapshot | domain/battle_resolution_snapshot.js deep-clones/freezes data; evolve rejects changes to causality/normalOutcome fields and unknown fields. | New causality must be complete before final snapshot creation. Do not evolve an already published snapshot to rerun tactics. Restore determinism for new state requires explicit tests; current tests alone cannot certify it. |

## Phase 1 proposed contracts (historical; see Phase 2 record)

1. Shared actor-scoped tactical state: enemy formation/cohesion and pursuit status;
   human freedom of movement/escape-route availability and capture status. Keep
   original Facts immutable; append consequences and derive the current state.
2. Reuse TacticRequirementEvaluator for each side before execution and after state
   changes. Emit eligibility/blocked events containing missing reasons and causal
   source IDs. Eligibility never means the action succeeded or was selected.
3. Separate decision policy, action resolution, consequence application and
   bounded orchestration. No single resolver owns all four responsibilities.
4. Candidate charge requirement: large body + usable deployment frontage + ordered
   formation. Exact frontage/formation thresholds need approval; existing heavy
   frontal breakthrough remains a distinct tactic.
5. Candidate chain: selected skirmish + available disengagement route -> enemy
   pursuit decision -> successful vanguard overextension -> formation disruption
   -> charge requirement missing. An ignore decision leaves formation unchanged.
6. Reverse chain: eligible enemy capture/route-block action -> successful loss of
   human disengagement capability -> human skirmish requirement missing. No direct
   tactic-name cancellation and no unconditional damage reduction.
7. Keep tactical causality parallel to existing numerical Normal Outcome. Do not
   add favorable/danger tags that grant Opportunity implicitly. A future numerical
   connection requires a separately agreed combat contract.

## Decisions presented before Phase 2 (historical)

The task explicitly requires these decisions to be presented before provisional
implementation. None is resolved by this audit.

| Decision | Proposed minimal validation option | Why approval is needed |
| --- | --- | --- |
| Resolution order | Caller supplies an explicit ordered action/decision schedule for a development-only harness. No production default. | Capture-before-pursuit and pursuit-before-capture can produce different valid outcomes. |
| Repeat and stop | Consume each uniquely identified action once; reevaluate after each accepted state event; reject duplicate action IDs; finite supplied schedule ends the chain. | This is a new stopping/continuous-action contract, not an existing game rule. |
| Commander decision | Inject a policy with explicit pursuit/ignore/capture decisions in fixtures; defer automatic personality mapping. | No approved probabilities or personality thresholds exist. Automatic reckless=pursuit would silently finalize behavior. |
| Resolution evidence | Fixtures explicitly supply evidence of pursuit overextension, capture and actual escape paths; absent evidence fails closed. | Terrain capability is not proof of maneuver success; capture thresholds are unspecified. |
| Tactic requirements | Agree the charge formation/frontage requirement and human INTERCEPT/HOLD/SKIRMISH prerequisites. | The user defines intent, but does not define all necessary sufficiency conditions. |
| Production connection | Approve isolated domain validation first; retain existing Normal Outcome/Opportunity/Fortune untouched. | Production timing and new state persistence/restore ownership are not yet defined. |

Recommended next step: approve the development-only, caller-scheduled validation
contracts together with exact tactic prerequisites. Validate the five requested
chains without assigning production AI behavior. Production personality policy,
retreat/breakthrough meaning, delay versus halt, zone/LINK, defense conversion and
Ember settlement remain ON_HOLD.

## Validation and affected tests

Executed focused scripts, all exit 0:

- scratch/test_battle_causality_domain.mjs — PASS (script does not print count).
- scratch/test_battle_causality_resolution_domain.mjs — PASS (no printed count).
- scratch/test_trial_tactic_requirement_evaluator.mjs — PASS, 5/5 cases.
- scratch/test_battle_opportunity_fortune_lifecycle.mjs — PASS (no printed count).
- pre_write_linter.py — PASS after TASK configuration; 0 errors / 0 warnings.

Full Inspection was started on the clean, unchanged TASK. First sandbox run was
BLOCKED in Layer 1 task-health temporary Git repo setup: unable to write symref
for HEAD (Permission denied). The rerun with sandbox escalation exited 0:
Layers 1–6 PASS. See external log
../trial-causality-phase1-inspection-elevated.log. Logs are outside the task tree.
This is a baseline inspection started before adding this document, not Phase 2
certification or a clean committed TASK integration certification.

Regression surface for Phase 2 also includes spatial engagement, plan candidate
generation, enemy tactic resolver/selection, battle coordinator characterization,
battle presentation runtime integration, fortune result adapter, runtime lifecycle
and restore boundary tests. Run canonical Full Inspection after implementation.

New bidirectional chains, no duplicate/infinite chain guarantees, and new-state
Snapshot/Restore/RNG determinism: BLOCKED pending contract decisions; not certified.
Actual browser rendering: not tested. No runtime change, commit, push or PR was
made in Phase 1. Only this audit document was added at that point. This section
records the Phase 1 boundary, not subsequent Phase 2 implementation status.
