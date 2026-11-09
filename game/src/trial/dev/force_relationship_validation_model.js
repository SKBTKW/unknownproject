import { freezeBattleResolutionData } from "../domain/battle_resolution_snapshot.js";
import {
    applyForceRelationshipTransition,
    applyForceScopedBattleTransition,
    createActorScopedBattleState,
    createBattleCausalReferenceIndex,
    createExternalBattleFacts,
    createForceRelationshipState,
    createForceScopedBattleState,
    registerBattleCausalReferences,
    validateBattleCausalReferences
} from "../domain/battle_causality_execution.js";
import {
    FORCE_ACTORS,
    FORCE_RELATIONSHIP_SCHEMA,
    FORCE_RELATIONSHIP_STATUS,
    evaluateForceIsolation,
    validateForceRelationshipSnapshot,
    validateForceRelationshipStatus
} from "../domain/force_relationship_foundation.js";

export const FORCE_RELATIONSHIP_VALIDATION_SCHEMA = "DEV_FORCE_RELATIONSHIP_VALIDATION_V1";
export const FORCE_OPERATION_TYPES = Object.freeze({
    FORCE_STATE: "FORCE_STATE",
    RELATION: "RELATION"
});

const ACTORS = new Set(Object.values(FORCE_ACTORS));
const OPERATION_TYPES = new Set(Object.values(FORCE_OPERATION_TYPES));
const validText = value => typeof value === "string" && value.trim().length > 0;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

function relationList(relations) {
    return Object.values(relations);
}

function validateOperationShape(operation) {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)
        || !validText(operation.actionId) || !validText(operation.eventId)
        || !ACTORS.has(operation.actor) || !OPERATION_TYPES.has(operation.type)
        || !validText(operation.reason) || !operation.evidence
        || typeof operation.evidence !== "object" || Array.isArray(operation.evidence)
        || Object.keys(operation.evidence).length === 0) {
        throw new TypeError("INVALID_FORCE_RELATIONSHIP_OPERATION");
    }
}

function validateInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("FORCE_RELATIONSHIP_VALIDATION_INPUT_REQUIRED");
    }
    validateForceRelationshipSnapshot(input.initialSnapshot);
    if (!Array.isArray(input.operations)) throw new TypeError("FORCE_OPERATION_LIST_REQUIRED");
    for (const operation of input.operations) validateOperationShape(operation);
    if (input.maxOperations !== undefined
        && (!Number.isInteger(input.maxOperations) || input.maxOperations < 0)) {
        throw new TypeError("INVALID_FORCE_OPERATION_LIMIT");
    }
}

function compatibilityView(forceState, selection) {
    if (selection === undefined) return null;
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
        throw new TypeError("ACTOR_FORCE_SELECTION_REQUIRED");
    }
    const selected = {};
    for (const actor of Object.values(FORCE_ACTORS)) {
        const forceId = selection[actor];
        const force = forceState[forceId];
        if (!force || force.actor !== actor) throw new TypeError("ACTOR_FORCE_SELECTION_MISMATCH");
        selected[actor.toLowerCase()] = copy(force.state);
    }
    return createActorScopedBattleState(selected);
}

function validateOwnership(operation, forceState, relations) {
    if (operation.type === FORCE_OPERATION_TYPES.FORCE_STATE) {
        const force = forceState[operation.forceId];
        if (!force) return ["UNKNOWN_FORCE"];
        if (force.actor !== operation.actor) return ["FORCE_ACTOR_MISMATCH"];
        if (!operation.resultingState || typeof operation.resultingState !== "object"
            || Array.isArray(operation.resultingState)) return ["RESULTING_FORCE_STATE_REQUIRED"];
        return [];
    }
    const relation = relations[operation.relationId];
    if (!relation) return ["UNKNOWN_RELATION"];
    const source = forceState[relation.sourceForceId];
    if (!source || source.actor !== operation.actor) return ["RELATION_SOURCE_ACTOR_MISMATCH"];
    try {
        validateForceRelationshipStatus(operation.status);
    } catch {
        return ["INVALID_RELATION_STATUS"];
    }
    if (operation.evidence.supportAssessment !== operation.status) {
        return ["EXPLICIT_RELATION_ASSESSMENT_REQUIRED"];
    }
    return [];
}

function createProvenance(operation, index, sourceFactIds) {
    const cause = {
        causeId: `dev-force-cause:${index}`,
        type: operation.type === FORCE_OPERATION_TYPES.RELATION
            ? "FORCE_RELATIONSHIP_ASSESSED" : "FORCE_STATE_ASSESSED",
        sourceAction: operation.actionId,
        sourceFacts: [...sourceFactIds],
        payload: { reason: operation.reason, evidence: copy(operation.evidence) }
    };
    const consequence = {
        consequenceId: `dev-force-consequence:${index}`,
        type: operation.type === FORCE_OPERATION_TYPES.RELATION
            ? "FORCE_RELATIONSHIP_CHANGED" : "FORCE_STATE_CHANGED",
        sourceAction: operation.actionId,
        sourceCause: cause.causeId,
        resolved: true
    };
    const event = {
        eventId: operation.eventId,
        type: consequence.type,
        sourceAction: operation.actionId,
        sourceCause: cause.causeId,
        sourceFacts: [...sourceFactIds]
    };
    return { cause, consequence, event };
}

function referenceReasons(operation, referenceIndex) {
    return validateBattleCausalReferences(operation, referenceIndex);
}

function finalSnapshot(initial, forceState, relationState) {
    return validateForceRelationshipSnapshot({
        schema: FORCE_RELATIONSHIP_SCHEMA,
        forces: initial.forces.map(force => ({
            ...force,
            state: copy(forceState[force.forceId].state)
        })),
        relations: initial.relations.map(relation => copy(relationState[relation.relationId])),
        supportScopes: initial.supportScopes
    });
}

/**
 * Finite development harness for force-scoped state and directed relationship
 * transitions. All deltas use the existing battle causality execution helpers.
 */
export function validateForceRelationshipsV1(input) {
    validateInput(input);
    const initial = validateForceRelationshipSnapshot(input.initialSnapshot);
    let forceState = createForceScopedBattleState(initial.forces);
    let relationState = createForceRelationshipState(initial.relations);
    const referenceIndex = createBattleCausalReferenceIndex(input.causalBasis || {});
    const history = [];
    const stateTransitions = [];
    const relationTransitions = [];
    const seenActions = new Set();
    const seenEvents = new Set(referenceIndex.events);
    const maxOperations = input.maxOperations ?? input.operations.length;
    let stopped = "END_OF_INPUT";

    for (const [index, operation] of input.operations.entries()) {
        if (index >= maxOperations) {
            stopped = "MAX_OPERATIONS_REACHED";
            break;
        }
        const beforeForces = copy(forceState);
        const beforeRelations = copy(relationState);
        const duplicateAction = seenActions.has(operation.actionId)
            || referenceIndex.actions.has(operation.actionId);
        const duplicateEvent = seenEvents.has(operation.eventId);
        seenActions.add(operation.actionId);
        seenEvents.add(operation.eventId);
        const reasons = [
            ...(duplicateAction ? ["DUPLICATE_ACTION_ID"] : []),
            ...(duplicateEvent ? ["DUPLICATE_EVENT_ID"] : []),
            ...(!duplicateAction && !duplicateEvent
                ? validateOwnership(operation, forceState, relationState) : []),
            ...(!duplicateAction && !duplicateEvent ? referenceReasons(operation, referenceIndex) : [])
        ];
        const facts = reasons.length ? [] : createExternalBattleFacts([{
            status: "EXPLICIT_EXTERNAL_EVIDENCE",
            fact: operation.type,
            evidence: copy(operation.evidence)
        }], { actionId: operation.actionId, actionOrder: index });
        const sourceFactIds = [
            ...facts.map(fact => fact.factId),
            ...(Array.isArray(operation.sourceFactIds) ? operation.sourceFactIds : [])
        ];
        registerBattleCausalReferences(referenceIndex, { facts });
        let provenance = null;
        let transitions = [];

        if (!reasons.length) {
            provenance = createProvenance(operation, index, sourceFactIds);
            if (operation.type === FORCE_OPERATION_TYPES.FORCE_STATE) {
                const applied = applyForceScopedBattleTransition({
                    state: forceState,
                    update: {
                        forceId: operation.forceId,
                        actor: operation.actor,
                        resultingState: operation.resultingState
                    },
                    actionId: operation.actionId,
                    causeId: provenance.cause.causeId,
                    consequenceId: provenance.consequence.consequenceId,
                    eventId: provenance.event.eventId,
                    sourceFactIds,
                    sourceEventIds: [provenance.event.eventId, ...(operation.sourceEventIds || [])],
                    order: stateTransitions.length,
                    step: index
                });
                forceState = applied.state;
                transitions = applied.transitions;
                stateTransitions.push(...transitions);
            } else {
                const relation = relationState[operation.relationId];
                const applied = applyForceRelationshipTransition({
                    relations: relationState,
                    update: {
                        relationId: relation.relationId,
                        type: relation.type,
                        sourceForceId: relation.sourceForceId,
                        targetForceId: relation.targetForceId,
                        status: operation.status
                    },
                    actionId: operation.actionId,
                    causeId: provenance.cause.causeId,
                    consequenceId: provenance.consequence.consequenceId,
                    eventId: provenance.event.eventId,
                    sourceFactIds,
                    sourceEventIds: [provenance.event.eventId, ...(operation.sourceEventIds || [])],
                    order: relationTransitions.length,
                    step: index
                });
                relationState = applied.relations;
                transitions = applied.transitions;
                relationTransitions.push(...transitions);
            }
            registerBattleCausalReferences(referenceIndex, {
                actionId: operation.actionId,
                causes: [provenance.cause],
                events: [provenance.event],
                executed: true
            });
        }

        history.push({
            actionId: operation.actionId,
            eventId: operation.eventId,
            type: operation.type,
            status: reasons.length ? "REJECTED" : "EXECUTED",
            reasons,
            evidenceFacts: facts,
            provenance,
            transitions,
            beforeForces,
            afterForces: copy(forceState),
            beforeRelations,
            afterRelations: copy(relationState)
        });
    }

    const final = finalSnapshot(initial, forceState, relationState);
    const isolation = final.forces.map(force => evaluateForceIsolation({
        forceId: force.forceId,
        forces: final.forces,
        relations: final.relations,
        supportScopes: final.supportScopes
    }));
    return freezeBattleResolutionData({
        schema: FORCE_RELATIONSHIP_VALIDATION_SCHEMA,
        status: "DEVELOPMENT_ONLY",
        input: copy(input),
        initialSnapshot: initial,
        history,
        finalSnapshot: final,
        stateTransitions,
        relationTransitions,
        isolation,
        actorScopedCompatibility: compatibilityView(forceState, input.actorCompatibilitySelection),
        stopped,
        resolutionBoundary: {
            productionTrialChanged: false,
            actionOutcomeResolved: false,
            damageChanged: false,
            opportunityChanged: false,
            fortuneChanged: false
        }
    });
}

export function restoreForceRelationshipsV1(snapshot) {
    if (snapshot?.schema !== FORCE_RELATIONSHIP_VALIDATION_SCHEMA) {
        throw new TypeError("INVALID_FORCE_RELATIONSHIP_VALIDATION_SCHEMA");
    }
    const restored = validateForceRelationshipsV1(snapshot.input);
    if (JSON.stringify(restored) !== JSON.stringify(snapshot)) {
        throw new TypeError("FORCE_RELATIONSHIP_REPLAY_MISMATCH");
    }
    return restored;
}

export default validateForceRelationshipsV1;
