import { freezeBattleResolutionData } from "../domain/battle_resolution_snapshot.js";
import { applyActorScopedBattleTransition, createActorScopedBattleState }
    from "../domain/battle_causality_execution.js";
import {
    CAUSAL_RULE_CLASSIFICATIONS,
    CAUSAL_RULE_IDS,
    CAUSAL_RULE_SLICE_SCHEMA,
    evaluateCausalRuleSliceV1
} from "./causal_rule_slice_v1.js";
import { copy, evaluateTactics } from "./tactical_causality_state.js";

export const CAUSAL_INTERACTION_STATE_TRANSITION_SCHEMA =
    "DEV_CAUSAL_INTERACTION_STATE_TRANSITION_V1";

const ACTORS = new Set(["HUMAN", "ENEMY"]);
const CONSTRAINED_DEPLOYMENT = new Set(["CONSTRAINED", "SEVERELY_CONSTRAINED"]);
const validText = value => typeof value === "string" && value.trim().length > 0;

function actorKey(actor) {
    return actor?.toLowerCase();
}

function validateTactics(tactics) {
    if (!Array.isArray(tactics)) throw new TypeError("TACTIC_LIST_REQUIRED");
    const ids = new Set();
    for (const tactic of tactics) {
        if (!validText(tactic?.tacticId) || ids.has(tactic.tacticId)
            || !ACTORS.has(tactic.actor) || !tactic.requirement
            || typeof tactic.requirement !== "object" || Array.isArray(tactic.requirement)) {
            throw new TypeError("INVALID_DECLARED_TACTIC");
        }
        ids.add(tactic.tacticId);
    }
}

function trustedRuleSlice(ruleSlice) {
    if (ruleSlice?.schema !== CAUSAL_RULE_SLICE_SCHEMA || !ruleSlice.input) {
        throw new TypeError("CAUSAL_RULE_SLICE_REQUIRED");
    }
    const replayed = evaluateCausalRuleSliceV1(ruleSlice.input);
    if (JSON.stringify(replayed) !== JSON.stringify(ruleSlice)) {
        throw new TypeError("CAUSAL_RULE_SLICE_REPLAY_MISMATCH");
    }
    return replayed;
}

function evidenceFacts(evaluation) {
    return evaluation.evidence.map((evidence, index) => ({
        factId: `dev-rule-fact:${evaluation.ruleId}:${index}`,
        type: "CONFIRMED_RULE_EVIDENCE",
        ruleId: evaluation.ruleId,
        target: copy(evaluation.target),
        evidence: copy(evidence),
        order: index
    }));
}

function provenance(evaluation, actionId, index) {
    const facts = evidenceFacts(evaluation);
    const cause = {
        causeId: `dev-rule-cause:${index}:${evaluation.ruleId}`,
        type: evaluation.result,
        ruleId: evaluation.ruleId,
        target: copy(evaluation.target),
        sourceAction: actionId,
        sourceFacts: facts.map(row => row.factId)
    };
    const consequence = {
        consequenceId: `dev-rule-consequence:${index}:${evaluation.ruleId}`,
        ruleId: evaluation.ruleId,
        target: copy(evaluation.target),
        sourceAction: actionId,
        sourceCause: cause.causeId,
        resolved: evaluation.status === "CONFIRMED"
    };
    const event = {
        eventId: `dev-rule-event:${index}:${evaluation.ruleId}`,
        type: evaluation.status === "CONFIRMED" ? "CAUSAL_RULE_CONFIRMED" : "CAUSAL_RULE_UNRESOLVED",
        ruleId: evaluation.ruleId,
        target: copy(evaluation.target),
        sourceAction: actionId,
        sourceCause: cause.causeId,
        sourceFacts: facts.map(row => row.factId)
    };
    return { actionId, cause, consequence, facts, event };
}

function deploymentAfter(evaluation) {
    return evaluation.evidence.find(row => row.field === "deployment")?.value || null;
}

function decisionFor(evaluation) {
    if (evaluation.status !== "CONFIRMED") {
        return {
            stateChangeAllowed: false,
            stateAxis: null,
            after: null,
            rejectionReasons: ["RULE_NOT_CONFIRMED"]
        };
    }
    if (evaluation.classification === CAUSAL_RULE_CLASSIFICATIONS.TACTICAL_CONSTRAINT) {
        return {
            stateChangeAllowed: false,
            stateAxis: null,
            after: null,
            rejectionReasons: ["TACTICAL_CONSTRAINT_REQUIRES_LATER_RESOLUTION"]
        };
    }
    if (evaluation.ruleId === CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT) {
        const after = deploymentAfter(evaluation);
        if (CONSTRAINED_DEPLOYMENT.has(after)) {
            return { stateChangeAllowed: true, stateAxis: "deployment", after, rejectionReasons: [] };
        }
        return {
            stateChangeAllowed: false,
            stateAxis: "deployment",
            after: null,
            rejectionReasons: ["CONFIRMED_DEPLOYMENT_VALUE_REQUIRED"]
        };
    }
    return {
        stateChangeAllowed: false,
        stateAxis: null,
        after: null,
        rejectionReasons: ["UNSUPPORTED_STATE_TRANSITION_RULE"]
    };
}

function constraintFor(evaluation, sources) {
    if (evaluation.status !== "CONFIRMED"
        || evaluation.classification !== CAUSAL_RULE_CLASSIFICATIONS.TACTICAL_CONSTRAINT) return null;
    return {
        constraintId: `dev-interaction-constraint:${evaluation.ruleId}`,
        ruleId: evaluation.ruleId,
        type: evaluation.result,
        target: copy(evaluation.target),
        sourceAction: sources.actionId,
        sourceCause: sources.cause.causeId,
        sourceFacts: sources.facts.map(row => row.factId),
        sourceEvent: sources.event.eventId,
        unresolvedPrerequisites: [...evaluation.unresolvedPrerequisites],
        resolutionStatus: "PENDING_LATER_ACTION_RESOLUTION"
    };
}

function validateInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("CAUSAL_INTERACTION_INPUT_REQUIRED");
    }
    validateTactics(input.tactics);
    createActorScopedBattleState(input.initialState);
}

/**
 * Development-only adapter. Trusted Rule Slice evaluations may update an
 * actor-scoped state through the existing execution foundation. Tactical
 * constraints stay referenceable and never become action results.
 */
export function applyCausalInteractionStateTransitionsV1(input) {
    validateInput(input);
    const ruleSlice = trustedRuleSlice(input.ruleSlice);
    const tactics = copy(input.tactics);
    const context = ruleSlice.input.battlefieldContext;
    let state = createActorScopedBattleState(input.initialState);
    let eligibility = evaluateTactics(context, state, tactics);
    const initialEligibility = copy(eligibility);
    const records = [];
    const transitionHistory = [];
    const interactionConstraints = [];

    for (const [index, evaluation] of ruleSlice.evaluations.entries()) {
        const beforeState = copy(state);
        const beforeEligibility = copy(eligibility);
        const decision = decisionFor(evaluation);
        const sources = provenance(evaluation, ruleSlice.input.action.actionId, index);
        const constraint = constraintFor(evaluation, sources);
        if (constraint) interactionConstraints.push(constraint);
        let transitions = [];

        if (decision.stateChangeAllowed) {
            const key = actorKey(evaluation.target.actor);
            const applied = applyActorScopedBattleTransition({
                state,
                update: {
                    target: key,
                    forceId: evaluation.target.forceId,
                    resultingState: { [decision.stateAxis]: decision.after }
                },
                actionId: sources.actionId,
                causeId: sources.cause.causeId,
                consequenceId: sources.consequence.consequenceId,
                eventId: sources.event.eventId,
                sourceFactIds: sources.facts.map(row => row.factId),
                sourceEventIds: [sources.event.eventId],
                order: transitionHistory.length,
                step: index
            });
            state = applied.state;
            if (applied.transitions.length > 0) {
                eligibility = evaluateTactics(context, state, tactics);
                transitions = applied.transitions.map(transition => ({
                    ...transition,
                    ruleId: evaluation.ruleId,
                    beforeState,
                    afterState: copy(state),
                    beforeEligibility,
                    afterEligibility: copy(eligibility)
                }));
                transitionHistory.push(...transitions);
            }
        }

        records.push({
            ruleId: evaluation.ruleId,
            target: copy(evaluation.target),
            classification: evaluation.classification,
            confirmedCondition: evaluation.status === "CONFIRMED" ? evaluation.result : null,
            stateAxis: decision.stateAxis,
            before: decision.stateAxis ? beforeState[actorKey(evaluation.target.actor)][decision.stateAxis] : null,
            after: decision.stateAxis ? state[actorKey(evaluation.target.actor)][decision.stateAxis] : null,
            stateChangeAllowed: decision.stateChangeAllowed,
            stateChanged: transitions.length > 0,
            unresolvedConditions: [...evaluation.unresolvedPrerequisites],
            rejectionReasons: [...decision.rejectionReasons],
            provenance: sources,
            interactionConstraintId: constraint?.constraintId || null,
            beforeEligibility,
            afterEligibility: copy(eligibility),
            transitions
        });
    }

    return freezeBattleResolutionData({
        schema: CAUSAL_INTERACTION_STATE_TRANSITION_SCHEMA,
        status: "DEVELOPMENT_ONLY",
        input: copy(input),
        initialEligibility,
        records,
        transitionHistory,
        interactionConstraints,
        finalState: state,
        finalEligibility: eligibility,
        resolutionBoundary: {
            actionSelected: false,
            actionExecuted: false,
            actionOutcomeResolved: false,
            damageChanged: false,
            normalOutcomeChanged: false,
            opportunityChanged: false,
            fortuneChanged: false
        }
    });
}

export function restoreCausalInteractionStateTransitionsV1(snapshot) {
    if (snapshot?.schema !== CAUSAL_INTERACTION_STATE_TRANSITION_SCHEMA) {
        throw new TypeError("INVALID_CAUSAL_INTERACTION_SCHEMA");
    }
    const restored = applyCausalInteractionStateTransitionsV1(snapshot.input);
    if (JSON.stringify(restored) !== JSON.stringify(snapshot)) {
        throw new TypeError("CAUSAL_INTERACTION_REPLAY_MISMATCH");
    }
    return restored;
}

export default applyCausalInteractionStateTransitionsV1;
