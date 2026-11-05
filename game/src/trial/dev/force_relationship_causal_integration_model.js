import { freezeBattleResolutionData } from "../domain/battle_resolution_snapshot.js";
import {
    applyForceRelationshipTransition,
    applyForceScopedBattleTransition,
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
    FORCE_RELATIONSHIP_TYPES,
    evaluateForceIsolation,
    validateForceRelationshipSnapshot
} from "../domain/force_relationship_foundation.js";
import { TacticRequirementEvaluator } from "../systems/tactic_requirement_evaluator.js";

export const FORCE_RELATIONSHIP_CAUSAL_INTEGRATION_SCHEMA =
    "DEV_FORCE_RELATIONSHIP_CAUSAL_INTEGRATION_V1";

const ACTORS = new Set(Object.values(FORCE_ACTORS));
const STATUSES = new Set(Object.values(FORCE_RELATIONSHIP_STATUS));
const EVIDENCE_STATUSES = new Set(["CONFIRMED", "DENIED", "UNRESOLVED"]);
const SUPPORT_DECISION_AXES = Object.freeze([
    "routeReachability",
    "supportCapability",
    "timing"
]);
const validText = value => typeof value === "string" && value.trim().length > 0;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
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

function forceStateTokens(snapshot) {
    const tokens = [];
    for (const force of snapshot.forces) {
        for (const [key, value] of Object.entries(force.state)) {
            if (value !== null && typeof value !== "object") {
                tokens.push(`FORCE:${force.forceId}:${key}:${String(value)}`);
            }
        }
    }
    return tokens;
}

function relationTokens(snapshot, isolationRows) {
    return [
        ...snapshot.relations.map(row => `RELATION:${row.relationId}:${row.status}`),
        ...isolationRows.map(row => `ISOLATION:${row.forceId}:${row.status}`)
    ];
}

function knownTokens(snapshot, isolationRows, knownEnemyState) {
    const relationIds = new Set(knownEnemyState?.relationIds || []);
    const isolationForceIds = new Set(knownEnemyState?.isolationForceIds || []);
    const ownForceTokens = [];
    for (const force of snapshot.forces.filter(row => row.actor === FORCE_ACTORS.HUMAN)) {
        for (const [key, value] of Object.entries(force.state)) {
            if (value !== null && typeof value !== "object") {
                ownForceTokens.push(`FORCE:${force.forceId}:${key}:${String(value)}`);
            }
        }
    }
    return [
        ...ownForceTokens,
        ...snapshot.relations
            .filter(row => relationIds.has(row.relationId))
            .map(row => `RELATION:${row.relationId}:${row.status}`),
        ...isolationRows
            .filter(row => isolationForceIds.has(row.forceId))
            .map(row => `ISOLATION:${row.forceId}:${row.status}`)
    ];
}

function evaluateTactics(snapshot, isolationRows, tactics, knownEnemyState) {
    const evaluator = new TacticRequirementEvaluator();
    const objectiveStates = [...forceStateTokens(snapshot), ...relationTokens(snapshot, isolationRows)];
    const humanKnownStates = knownTokens(snapshot, isolationRows, knownEnemyState);
    const rows = tactics.map(tactic => {
        const objective = evaluator.evaluate({ requirement: tactic.requirement, states: objectiveStates });
        const known = evaluator.evaluate({
            requirement: tactic.requirement,
            states: tactic.actor === FORCE_ACTORS.HUMAN ? humanKnownStates : objectiveStates
        });
        return {
            tacticId: tactic.tacticId,
            actor: tactic.actor,
            objective,
            known,
            selectionCreated: false,
            successResolved: false
        };
    });
    return {
        objectiveStates,
        humanKnownStates,
        rows
    };
}

function isolationRows(snapshot) {
    return snapshot.forces.map(force => evaluateForceIsolation({
        forceId: force.forceId,
        forces: snapshot.forces,
        relations: snapshot.relations,
        supportScopes: snapshot.supportScopes
    }));
}

function validateTactics(tactics) {
    if (!Array.isArray(tactics)) throw new TypeError("TACTIC_LIST_REQUIRED");
    const ids = new Set();
    for (const tactic of tactics) {
        if (!plainObject(tactic) || !validText(tactic.tacticId) || ids.has(tactic.tacticId)
            || !ACTORS.has(tactic.actor) || !plainObject(tactic.requirement)) {
            throw new TypeError("INVALID_DECLARED_TACTIC");
        }
        ids.add(tactic.tacticId);
    }
}

function validateEvidenceField(field) {
    if (!plainObject(field) || !EVIDENCE_STATUSES.has(field.status)) {
        return ["INVALID_RELATION_EVIDENCE_FIELD"];
    }
    if (field.status !== "UNRESOLVED" && !validText(field.sourceFactId)) {
        return ["GROUNDED_RELATION_EVIDENCE_REQUIRED"];
    }
    if (field.status === "UNRESOLVED" && Object.hasOwn(field, "sourceFactId")) {
        return ["UNRESOLVED_RELATION_EVIDENCE_MUST_NOT_CLAIM_FACT"];
    }
    return [];
}

function assessRelation(assessment, relation, referenceIndex) {
    const reasons = [];
    if (!plainObject(assessment.evidence) || !Array.isArray(assessment.evidence.requiredAxes)
        || assessment.evidence.requiredAxes.length === 0) {
        return { reasons: ["RELATION_REQUIRED_AXES_MISSING"], evidenceFactIds: [] };
    }
    const requiredAxes = [...new Set(assessment.evidence.requiredAxes)];
    if (requiredAxes.length !== assessment.evidence.requiredAxes.length) {
        reasons.push("DUPLICATE_RELATION_EVIDENCE_AXIS");
    }
    if (relation.type === FORCE_RELATIONSHIP_TYPES.SUPPORT
        && (requiredAxes.length !== SUPPORT_DECISION_AXES.length
            || SUPPORT_DECISION_AXES.some(axis => !requiredAxes.includes(axis)))) {
        reasons.push("SUPPORT_DECISION_AXES_REQUIRED");
    }
    if (requiredAxes.includes("distance")) {
        reasons.push("DISTANCE_IS_NOT_A_DECISIVE_SUPPORT_AXIS");
    }
    const fields = requiredAxes.map(axis => assessment.evidence[axis]);
    for (const field of fields) reasons.push(...validateEvidenceField(field));
    const distance = assessment.evidence.distance;
    if (distance !== undefined) {
        reasons.push(...validateEvidenceField(distance));
        if (distance.status === "DENIED") reasons.push("DISTANCE_DENIAL_SEMANTICS_FORBIDDEN");
        if (distance.status !== "UNRESOLVED"
            && (!Number.isFinite(distance.value) || distance.value < 0)) {
            reasons.push("INVALID_DISTANCE_EVIDENCE_VALUE");
        }
    }
    const evidenceFactIds = [...new Set([
        ...fields
        .filter(field => field?.status !== "UNRESOLVED" && validText(field?.sourceFactId))
        .map(field => field.sourceFactId),
        ...(distance?.status !== "UNRESOLVED" && validText(distance?.sourceFactId)
            ? [distance.sourceFactId] : [])
    ])];
    reasons.push(...validateBattleCausalReferences({ sourceFactIds: evidenceFactIds }, referenceIndex));

    let derivedStatus = FORCE_RELATIONSHIP_STATUS.UNRESOLVED;
    if (fields.length > 0 && fields.every(field => field?.status !== "UNRESOLVED")) {
        derivedStatus = fields.some(field => field.status === "DENIED")
            ? FORCE_RELATIONSHIP_STATUS.DENIED
            : FORCE_RELATIONSHIP_STATUS.CONFIRMED;
    }
    if (assessment.status !== derivedStatus) reasons.push("RELATION_ASSESSMENT_NOT_SUPPORTED_BY_EVIDENCE");
    return { reasons, evidenceFactIds, derivedStatus, requiredAxes };
}

function validateActionShape(action, index) {
    if (!plainObject(action) || !validText(action.actionId) || !validText(action.eventId)
        || !validText(action.actionType) || !ACTORS.has(action.actor)
        || !validText(action.forceId) || action.order !== index
        || !plainObject(action.resolutionEvidence) || !plainObject(action.resultingState)
        || !Array.isArray(action.relationAssessments)) {
        throw new TypeError("INVALID_RESOLVED_FORCE_ACTION");
    }
    if (Object.keys(action.resultingState).length === 0) {
        throw new TypeError("EMPTY_FORCE_STATE_TRANSITION");
    }
    if (Object.hasOwn(action.resultingState, "position")) {
        const point = action.resultingState.position;
        if (!plainObject(point) || !Number.isInteger(point.r) || !Number.isInteger(point.c)) {
            throw new TypeError("INVALID_EXPLICIT_FORCE_POSITION");
        }
    }
}

function validateInput(input) {
    if (!plainObject(input)) throw new TypeError("FORCE_CAUSAL_INTEGRATION_INPUT_REQUIRED");
    validateForceRelationshipSnapshot(input.initialSnapshot);
    if (!Array.isArray(input.actions)) throw new TypeError("RESOLVED_ACTION_LIST_REQUIRED");
    input.actions.forEach(validateActionShape);
    validateTactics(input.tactics || []);
    if (!plainObject(input.knownEnemyState)
        || !Array.isArray(input.knownEnemyState.relationIds)
        || !Array.isArray(input.knownEnemyState.isolationForceIds)) {
        throw new TypeError("KNOWN_ENEMY_STATE_BOUNDARY_REQUIRED");
    }
    const forceIds = new Set(input.initialSnapshot.forces.map(row => row.forceId));
    const relationIds = new Set(input.initialSnapshot.relations.map(row => row.relationId));
    if (input.knownEnemyState.relationIds.some(id => !relationIds.has(id))
        || input.knownEnemyState.isolationForceIds.some(id => !forceIds.has(id))) {
        throw new TypeError("UNKNOWN_KNOWN_ENEMY_REFERENCE");
    }
    if (input.maxActions !== undefined
        && (!Number.isInteger(input.maxActions) || input.maxActions < 0)) {
        throw new TypeError("INVALID_ACTION_LIMIT");
    }
}

function actionResolutionReasons(action, forceState, referenceIndex) {
    const force = forceState[action.forceId];
    const evidence = action.resolutionEvidence;
    const reasons = [];
    if (!force) reasons.push("UNKNOWN_FORCE");
    else if (force.actor !== action.actor) reasons.push("FORCE_ACTOR_MISMATCH");
    if (evidence.status !== "RESOLVED" || evidence.outcome !== "CONFIRMED") {
        reasons.push("ACTION_RESOLUTION_NOT_CONFIRMED");
    }
    if (!validText(evidence.source) || !validText(evidence.sourceFactId)
        || !Array.isArray(evidence.verifiedFields)) {
        reasons.push("RESOLUTION_EVIDENCE_SCOPE_REQUIRED");
    } else {
        for (const key of Object.keys(action.resultingState)) {
            if (!evidence.verifiedFields.includes(key)) reasons.push(`UNVERIFIED_RESULT_FIELD:${key}`);
        }
        reasons.push(...validateBattleCausalReferences({
            sourceFactIds: [evidence.sourceFactId],
            sourceActionIds: action.sourceActionIds,
            sourceCauseIds: action.sourceCauseIds,
            sourceEventIds: action.sourceEventIds
        }, referenceIndex));
    }
    return reasons;
}

/**
 * Development-only coordinator connecting already-resolved actions to force
 * state, directed relationships, isolation and declared tactic eligibility.
 * It does not resolve actions, select tactics, mutate production Trial, or use RNG.
 */
export function validateForceRelationshipCausalIntegrationV1(input) {
    validateInput(input);
    const initial = validateForceRelationshipSnapshot(input.initialSnapshot);
    let forceState = createForceScopedBattleState(initial.forces);
    let relationState = createForceRelationshipState(initial.relations);
    const referenceIndex = createBattleCausalReferenceIndex(input.causalBasis || {});
    const seenActions = new Set(referenceIndex.actions);
    const seenEvents = new Set(referenceIndex.events);
    const stateTransitions = [];
    const relationTransitions = [];
    const history = [];
    const initialIsolation = isolationRows(initial);
    const initialEligibility = evaluateTactics(
        initial, initialIsolation, input.tactics || [], input.knownEnemyState
    );
    let stopped = "END_OF_INPUT";
    const maxActions = input.maxActions ?? input.actions.length;

    for (const [index, action] of input.actions.entries()) {
        if (index >= maxActions) {
            stopped = "MAX_ACTIONS_REACHED";
            break;
        }
        const beforeSnapshot = finalSnapshot(initial, forceState, relationState);
        const beforeIsolation = isolationRows(beforeSnapshot);
        const beforeEligibility = evaluateTactics(
            beforeSnapshot, beforeIsolation, input.tactics || [], input.knownEnemyState
        );
        const duplicateAction = seenActions.has(action.actionId);
        const duplicateEvent = seenEvents.has(action.eventId);
        seenActions.add(action.actionId);
        seenEvents.add(action.eventId);
        const reasons = [
            ...(duplicateAction ? ["DUPLICATE_ACTION_ID"] : []),
            ...(duplicateEvent ? ["DUPLICATE_EVENT_ID"] : []),
            ...(!duplicateAction && !duplicateEvent
                ? actionResolutionReasons(action, forceState, referenceIndex) : [])
        ];
        const externalFacts = reasons.length ? [] : createExternalBattleFacts([{
            status: "EXPLICIT_RESOLVED_ACTION_EVIDENCE",
            source: action.resolutionEvidence.source,
            verifiedFields: copy(action.resolutionEvidence.verifiedFields),
            sourceFactId: action.resolutionEvidence.sourceFactId
        }], { actionId: action.actionId, actionOrder: index });
        registerBattleCausalReferences(referenceIndex, { facts: externalFacts });
        const sourceFactIds = [
            ...externalFacts.map(row => row.factId),
            ...(reasons.length ? [] : [action.resolutionEvidence.sourceFactId])
        ];
        const actionStateTransitions = [];
        const relationReevaluations = [];
        let actionProvenance = null;

        if (!reasons.length) {
            const causeId = `dev-force-causal-action-cause:${index}`;
            const consequenceId = `dev-force-causal-action-consequence:${index}`;
            actionProvenance = {
                cause: {
                    causeId,
                    type: "RESOLVED_ACTION_APPLIED_TO_FORCE",
                    sourceAction: action.actionId,
                    sourceFacts: [...sourceFactIds],
                    payload: copy(action.resolutionEvidence)
                },
                consequence: {
                    consequenceId,
                    type: "FORCE_STATE_CHANGED",
                    sourceAction: action.actionId,
                    sourceCause: causeId,
                    resolved: true
                },
                event: {
                    eventId: action.eventId,
                    type: "FORCE_STATE_TRANSITION",
                    sourceAction: action.actionId,
                    sourceCause: causeId,
                    sourceFacts: [...sourceFactIds]
                }
            };
            const applied = applyForceScopedBattleTransition({
                state: forceState,
                update: {
                    forceId: action.forceId,
                    actor: action.actor,
                    resultingState: action.resultingState
                },
                actionId: action.actionId,
                causeId,
                consequenceId,
                eventId: action.eventId,
                sourceFactIds,
                sourceEventIds: [action.eventId, ...(action.sourceEventIds || [])],
                order: stateTransitions.length,
                step: index
            });
            forceState = applied.state;
            actionStateTransitions.push(...applied.transitions);
            stateTransitions.push(...applied.transitions);
            registerBattleCausalReferences(referenceIndex, {
                causes: [actionProvenance.cause],
                events: [actionProvenance.event]
            });

            for (const [assessmentIndex, assessment] of action.relationAssessments.entries()) {
                const relation = relationState[assessment.relationId];
                const assessmentEventDuplicate = seenEvents.has(assessment.eventId);
                if (validText(assessment.eventId)) seenEvents.add(assessment.eventId);
                const relationReasons = [
                    ...(!relation ? ["UNKNOWN_RELATION"] : []),
                    ...(relation && forceState[relation.sourceForceId]?.actor !== action.actor
                        ? ["RELATION_SOURCE_ACTOR_MISMATCH"] : []),
                    ...(!validText(assessment.eventId) ? ["RELATION_EVENT_ID_REQUIRED"] : []),
                    ...(assessmentEventDuplicate ? ["DUPLICATE_EVENT_ID"] : []),
                    ...(!STATUSES.has(assessment.status) ? ["INVALID_RELATION_STATUS"] : []),
                    ...(!validText(assessment.reason) ? ["RELATION_DECISION_REASON_REQUIRED"] : [])
                ];
                const assessed = relationReasons.length
                    ? { reasons: [], evidenceFactIds: [], derivedStatus: null, requiredAxes: [] }
                    : assessRelation(assessment, relation, referenceIndex);
                relationReasons.push(...assessed.reasons);
                const relationFacts = [...sourceFactIds, ...assessed.evidenceFactIds];
                let provenance = null;
                let transitions = [];
                if (!relationReasons.length) {
                    const causeId = `dev-force-causal-relation-cause:${index}:${assessmentIndex}`;
                    const consequenceId = `dev-force-causal-relation-consequence:${index}:${assessmentIndex}`;
                    provenance = {
                        cause: {
                            causeId,
                            type: "FORCE_RELATION_REEVALUATED",
                            sourceAction: action.actionId,
                            sourceFacts: [...relationFacts],
                            payload: {
                                reason: assessment.reason,
                                requiredAxes: assessed.requiredAxes,
                                evidence: copy(assessment.evidence)
                            }
                        },
                        consequence: {
                            consequenceId,
                            type: "FORCE_RELATION_CHANGED",
                            sourceAction: action.actionId,
                            sourceCause: causeId,
                            resolved: true
                        },
                        event: {
                            eventId: assessment.eventId,
                            type: "FORCE_RELATION_TRANSITION",
                            sourceAction: action.actionId,
                            sourceCause: causeId,
                            sourceFacts: [...relationFacts]
                        }
                    };
                    const changed = applyForceRelationshipTransition({
                        relations: relationState,
                        update: {
                            relationId: relation.relationId,
                            type: relation.type,
                            sourceForceId: relation.sourceForceId,
                            targetForceId: relation.targetForceId,
                            status: assessment.status
                        },
                        actionId: action.actionId,
                        causeId,
                        consequenceId,
                        eventId: assessment.eventId,
                        sourceFactIds: relationFacts,
                        sourceEventIds: [action.eventId, assessment.eventId],
                        order: relationTransitions.length,
                        step: assessmentIndex
                    });
                    relationState = changed.relations;
                    transitions = changed.transitions;
                    relationTransitions.push(...transitions);
                    registerBattleCausalReferences(referenceIndex, {
                        causes: [provenance.cause],
                        events: [provenance.event]
                    });
                }
                relationReevaluations.push({
                    relationId: assessment.relationId,
                    eventId: assessment.eventId || null,
                    status: relationReasons.length ? "REJECTED" : "EVALUATED",
                    reasons: relationReasons,
                    derivedStatus: assessed.derivedStatus,
                    requestedStatus: assessment.status,
                    evidenceFactIds: assessed.evidenceFactIds,
                    provenance,
                    transitions
                });
            }
            registerBattleCausalReferences(referenceIndex, {
                actionId: action.actionId,
                executed: true
            });
        }

        const afterSnapshot = finalSnapshot(initial, forceState, relationState);
        const afterIsolation = isolationRows(afterSnapshot);
        const afterEligibility = evaluateTactics(
            afterSnapshot, afterIsolation, input.tactics || [], input.knownEnemyState
        );
        history.push({
            actionId: action.actionId,
            eventId: action.eventId,
            actionType: action.actionType,
            order: index,
            status: reasons.length ? "REJECTED" : "EXECUTED",
            reasons,
            resolutionEvidence: copy(action.resolutionEvidence),
            externalFacts,
            provenance: actionProvenance,
            stateTransitions: actionStateTransitions,
            relationReevaluations,
            beforeSnapshot,
            afterSnapshot,
            beforeIsolation,
            afterIsolation,
            beforeEligibility,
            afterEligibility
        });
    }

    const final = finalSnapshot(initial, forceState, relationState);
    const finalIsolation = isolationRows(final);
    const finalEligibility = evaluateTactics(
        final, finalIsolation, input.tactics || [], input.knownEnemyState
    );
    return freezeBattleResolutionData({
        schema: FORCE_RELATIONSHIP_CAUSAL_INTEGRATION_SCHEMA,
        status: "DEVELOPMENT_ONLY",
        input: copy(input),
        initialSnapshot: initial,
        initialIsolation,
        initialEligibility,
        history,
        finalSnapshot: final,
        finalIsolation,
        finalEligibility,
        stateTransitions,
        relationTransitions,
        knownEnemyProjection: {
            relationIds: [...input.knownEnemyState.relationIds],
            isolationForceIds: [...input.knownEnemyState.isolationForceIds],
            states: finalEligibility.humanKnownStates
        },
        stopped,
        resolutionBoundary: {
            productionTrialChanged: false,
            actionOutcomeResolved: false,
            tacticSelected: false,
            tacticSuccessResolved: false,
            damageChanged: false,
            opportunityChanged: false,
            fortuneChanged: false,
            advisorChanged: false,
            uiChanged: false
        }
    });
}

export function restoreForceRelationshipCausalIntegrationV1(snapshot) {
    if (snapshot?.schema !== FORCE_RELATIONSHIP_CAUSAL_INTEGRATION_SCHEMA) {
        throw new TypeError("INVALID_FORCE_RELATIONSHIP_CAUSAL_INTEGRATION_SCHEMA");
    }
    const restored = validateForceRelationshipCausalIntegrationV1(snapshot.input);
    if (JSON.stringify(restored) !== JSON.stringify(snapshot)) {
        throw new TypeError("FORCE_RELATIONSHIP_CAUSAL_REPLAY_MISMATCH");
    }
    return restored;
}

export default validateForceRelationshipCausalIntegrationV1;
