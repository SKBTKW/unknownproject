import { createBattleAction } from "../domain/battle_action.js";
import { freezeBattleResolutionData } from "../domain/battle_resolution_snapshot.js";
import { BATTLE_CAUSE_TYPES, BATTLE_CAUSE_CATEGORIES } from "../domain/battle_causality_types.js";
import { BattleCausalEventResolver } from "../systems/battle_causal_event_resolver.js";
import { evaluateTactics, copy } from "./tactical_causality_state.js";
import { resolveTacticalAction } from "./tactical_causality_action.js";
import {
    applyActorScopedBattleTransition,
    createActorScopedBattleState,
    createBattleCausalReferenceIndex,
    createExternalBattleFacts,
    registerBattleCausalReferences,
    validateBattleCausalReferences
} from "../domain/battle_causality_execution.js";

const ACTORS = new Set(["HUMAN", "ENEMY"]);
const validText = value => typeof value === "string" && value.trim().length > 0;

function validateInput(input) {
    if (!input?.baseSnapshot?.battlefieldContext) throw new TypeError("BASE_SNAPSHOT_REQUIRED");
    if (!Array.isArray(input.actions) || !Array.isArray(input.tactics)) throw new TypeError("TACTICAL_INPUT_REQUIRED");
    const ids = new Set();
    for (const row of input.tactics) {
        const unusedAxes = Object.entries(row.requirement || {}).filter(([key]) => key !== "requiredStates");
        if (!validText(row.tacticId) || ids.has(row.tacticId) || !ACTORS.has(row.actor)
            || !Array.isArray(row.actionTypes) || !row.actionTypes.length || row.actionTypes.some(type => !validText(type))
            || !row.requirement || unusedAxes.some(([key, value]) =>
                !["requiredContext", "requiredCapabilities", "requiredDeployment", "requiredInfrastructure", "requiredTiming"].includes(key)
                || !value || typeof value !== "object" || Object.keys(value).length > 0)
            || !Array.isArray(row.requirement.requiredStates)
            || row.requirement.requiredStates.some(value => !validText(value))) {
            throw new TypeError("INVALID_DECLARED_TACTIC");
        }
        ids.add(row.tacticId);
    }
    for (const row of input.actions) {
        if (!validText(row.actionId) || !ACTORS.has(row.actor)
            || !input.tactics.some(t => t.tacticId === row.tacticId && t.actor === row.actor)) {
            throw new TypeError("INVALID_DECLARED_ACTION");
        }
    }
    const state = input.initialState;
    if (!state || !["ORDERED", "DISRUPTED", "UNKNOWN"].includes(state.enemy?.formation)
        || !["NONE", "PURSUING"].includes(state.enemy?.pursuit)
        || !["FREE", "CAPTURED", "UNKNOWN"].includes(state.human?.freedom)
        || !["AVAILABLE", "BLOCKED", "UNKNOWN"].includes(state.human?.escapeRoute)
        || !validText(input.initialStateReason)) throw new TypeError("INITIAL_STATE_EVIDENCE_REQUIRED");
    // Derived tokens cannot be forged via external token injection.
    if (state.enemy.externalTokens || state.human.externalTokens) throw new TypeError("EXTERNAL_STATE_TOKENS_FORBIDDEN");
    if (input.maxActions !== undefined
        && (!Number.isInteger(input.maxActions) || input.maxActions < 0)) {
        throw new TypeError("INVALID_ACTION_LIMIT");
    }
}

/**
 * Opt-in development harness; no production imports, AI, RNG or outcome edits.
 * A finite caller schedule is the only source of executions. Reevaluation only
 * observes eligibility. The separate envelope preserves the production schema.
 */
export function validateTacticalCausality(input) {
    validateInput(input);
    const { baseSnapshot, tactics, actions } = copy(input);
    const context = baseSnapshot.battlefieldContext;
    let state = createActorScopedBattleState(input.initialState);
    let eligibility = evaluateTactics(context, state, tactics);
    const initialEligibility = copy(eligibility);
    const history = [];
    const seen = new Set();
    const referenceIndex = createBattleCausalReferenceIndex(baseSnapshot);
    const transitionHistory = [];
    const maxActions = input.maxActions ?? actions.length;
    let stopped = "END_OF_INPUT";
    for (const [index, action] of actions.entries()) {
        if (index >= maxActions) {
            stopped = "MAX_ACTIONS_REACHED";
            break;
        }
        const beforeState = copy(state);
        const beforeEligibility = copy(eligibility);
        const current = eligibility.find(row => row.tacticId === action.tacticId);
        const duplicate = seen.has(action.actionId) || referenceIndex.actions.has(action.actionId);
        seen.add(action.actionId);
        const resolution = duplicate
            ? { reasons: ["DUPLICATE_ACTION_ID"], unverified: [], updates: [] }
            : resolveTacticalAction(action, state, history);
        const invalidReferences = duplicate ? [] : validateBattleCausalReferences(action, referenceIndex);
        const declared = tactics.find(row => row.tacticId === action.tacticId);
        const reasons = duplicate ? resolution.reasons : [
            ...(!declared.actionTypes.includes(action.type) ? ["ACTION_TACTIC_MISMATCH"] : []),
            ...(!current.eligible ? ["TACTIC_INELIGIBLE"] : []),
            ...invalidReferences,
            ...resolution.reasons
        ];
        const causes = [];
        const consequences = [];
        const transitions = [];
        const actionEvents = [];
        const externalFacts = reasons.length
            ? []
            : createExternalBattleFacts(resolution.unverified, { actionId: action.actionId, actionOrder: index });
        const sourceFactIds = [
            ...externalFacts.map(row => row.factId),
            ...(Array.isArray(action.sourceFactIds) ? action.sourceFactIds : [])
        ];
        registerBattleCausalReferences(referenceIndex, { facts: externalFacts });
        if (!reasons.length) {
            for (const [step, update] of resolution.updates.entries()) {
                if (Object.entries(update.resultingState).every(([key, value]) => state[update.target][key] === value)) continue;
                const causeId = `dev-cause:${index}:${step}`;
                const source = [
                    ...(Array.isArray(action.sourceCauseIds) ? action.sourceCauseIds : []),
                    ...(causes.length ? [causes.at(-1).causeId] : [])
                ];
                const isolated = update.type === "FORMATION_DISRUPTED";
                causes.push({ causeId, type: isolated ? BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED : update.type,
                    category: isolated ? BATTLE_CAUSE_CATEGORIES.COHESION : BATTLE_CAUSE_CATEGORIES.MOBILITY,
                    phase: "DEV_VALIDATION", target: update.target,
                    sourceAction: action.actionId, sourceFacts: sourceFactIds, sourceCauses: source,
                    derivedFrom: [
                        action.sourceActionId,
                        ...(Array.isArray(action.sourceActionIds) ? action.sourceActionIds : []),
                        ...(Array.isArray(action.sourceEventIds) ? action.sourceEventIds : []),
                        ...source
                    ].filter(Boolean),
                    payload: { reason: action.reason, evidence: copy(action.evidence || {}) } });
                const consequence = { ...update, consequenceId: `dev-consequence:${index}:${step}`,
                    sourceAction: action.actionId, sourceCauses: [causeId], resolved: true, persistence: "DEV_VALIDATION" };
                consequences.push(consequence);
                const priorState = copy(state);
                const priorEligibility = copy(eligibility);
                const causalEvent = new BattleCausalEventResolver().resolve([causes.at(-1)])[0]
                    || { ...causes.at(-1), eventId: `dev-event:${causeId}` };
                actionEvents.push(causalEvent);
                registerBattleCausalReferences(referenceIndex, {
                    causes: [causes.at(-1)], events: [causalEvent]
                });
                const applied = applyActorScopedBattleTransition({
                    state,
                    update,
                    actionId: action.actionId,
                    causeId,
                    consequenceId: consequence.consequenceId,
                    eventId: causalEvent.eventId,
                    sourceFactIds,
                    sourceEventIds: [causalEvent.eventId, ...(action.sourceEventIds || [])],
                    order: transitionHistory.length,
                    step
                });
                state = applied.state;
                eligibility = evaluateTactics(context, state, tactics);
                const detailed = applied.transitions.map(transition => ({ ...transition,
                    beforeState: priorState, afterState: copy(state),
                    beforeEligibility: priorEligibility, afterEligibility: copy(eligibility) }));
                transitions.push(...detailed);
                transitionHistory.push(...detailed);
            }
        }
        registerBattleCausalReferences(referenceIndex, {
            actionId: action.actionId,
            executed: reasons.length === 0
        });
        const eligibilityEvent = {
            eventId: `dev-eligibility:${index}`,
            type: reasons.length ? "ACTION_BLOCKED" : "ACTION_EXECUTED",
            sourceAction: action.actionId,
            reasons: copy(reasons),
            beforeEligibility,
            afterEligibility: copy(eligibility)
        };
        registerBattleCausalReferences(referenceIndex, { events: [eligibilityEvent] });
        history.push({ actionId: action.actionId, type: action.type, order: index,
            action: createBattleAction({ ...action, metadata: { validationInput: action } }),
            status: reasons.length ? "REJECTED" : "EXECUTED", reasons,
            decisionReason: action.reason || null, unverifiedExternalFacts: externalFacts,
            eligibilityAtAction: copy(current), causes, consequences, transitions,
            causalEvents: [...actionEvents, eligibilityEvent],
            beforeState, afterState: copy(state), beforeEligibility, afterEligibility: copy(eligibility) });
    }
    return freezeBattleResolutionData({ schema: "DEV_TACTICAL_CAUSALITY_V1", status: "DEVELOPMENT_ONLY",
        baseSnapshot, input: copy(input), initialEligibility, history, finalState: state,
        finalEligibility: eligibility, transitionHistory, stopped, processedActionIds: [...seen],
        externalInitialState: { status: "UNVERIFIED_EXTERNAL_FACT", reason: input.initialStateReason } });
}

// Restore by replay from explicit inputs rather than trusting editable derived
// history. Reject tampering and return a freshly frozen validation envelope.
export function restoreTacticalCausality(snapshot) {
    if (snapshot?.schema !== "DEV_TACTICAL_CAUSALITY_V1") throw new TypeError("INVALID_VALIDATION_SCHEMA");
    const restored = validateTacticalCausality(snapshot.input);
    if (JSON.stringify(restored) !== JSON.stringify(snapshot)) throw new TypeError("VALIDATION_REPLAY_MISMATCH");
    return restored;
}
