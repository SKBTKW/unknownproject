const ACTOR_KEYS = Object.freeze({ HUMAN: "human", ENEMY: "enemy" });
const DEFAULT_FORCE_IDS = Object.freeze({ HUMAN: "HUMAN_FORCE", ENEMY: "ENEMY_FORCE" });

function copy(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function list(value) {
    return Array.isArray(value) ? value.filter(item => typeof item === "string" && item.length > 0) : [];
}

function actorForTarget(target) {
    return Object.entries(ACTOR_KEYS).find(([, key]) => key === target)?.[0] || null;
}

export function createActorScopedBattleState(initialState = {}) {
    const state = copy(initialState);
    for (const key of Object.values(ACTOR_KEYS)) {
        if (!state?.[key] || typeof state[key] !== "object" || Array.isArray(state[key])) {
            throw new TypeError("ACTOR_SCOPED_STATE_REQUIRED");
        }
    }
    return state;
}

export function createForceScopedBattleState(forces = []) {
    if (!Array.isArray(forces)) throw new TypeError("FORCE_LIST_REQUIRED");
    const state = {};
    for (const force of forces) {
        if (!force || typeof force.forceId !== "string" || !force.forceId
            || !Object.hasOwn(ACTOR_KEYS, force.actor) || state[force.forceId]
            || !force.state || typeof force.state !== "object" || Array.isArray(force.state)) {
            throw new TypeError("INVALID_FORCE_SCOPED_STATE");
        }
        state[force.forceId] = { actor: force.actor, state: copy(force.state) };
    }
    return state;
}

export function createForceRelationshipState(relations = []) {
    if (!Array.isArray(relations)) throw new TypeError("FORCE_RELATIONSHIP_LIST_REQUIRED");
    const state = {};
    for (const relation of relations) {
        if (!relation || typeof relation.relationId !== "string" || !relation.relationId
            || state[relation.relationId]) {
            throw new TypeError("INVALID_FORCE_RELATIONSHIP_STATE");
        }
        state[relation.relationId] = copy(relation);
    }
    return state;
}

export function createBattleCausalReferenceIndex(baseSnapshot = {}) {
    const ids = rows => new Set((Array.isArray(rows) ? rows : [])
        .map(row => row?.actionId || row?.factId || row?.causeId || row?.eventId || row?.type)
        .filter(Boolean));
    return {
        actions: ids(baseSnapshot.actions),
        facts: ids(baseSnapshot.initialFacts),
        causes: ids(baseSnapshot.causes),
        events: ids(baseSnapshot.causalEvents)
    };
}

export function validateBattleCausalReferences(action = {}, referenceIndex = {}) {
    const reasons = [];
    if (action.sourceActionId !== undefined
        && (typeof action.sourceActionId !== "string" || action.sourceActionId.length === 0)) {
        reasons.push("INVALID_CAUSAL_REFERENCE_FORMAT:ACTION");
    }
    for (const [kind, key] of [
        ["ACTION", "sourceActionIds"],
        ["FACT", "sourceFactIds"],
        ["CAUSE", "sourceCauseIds"],
        ["EVENT", "sourceEventIds"]
    ]) {
        if (action[key] !== undefined && !Array.isArray(action[key])) {
            reasons.push(`INVALID_CAUSAL_REFERENCE_FORMAT:${kind}`);
        }
    }
    const checks = [
        ["ACTION", list([action.sourceActionId, ...list(action.sourceActionIds)]), referenceIndex.actions],
        ["FACT", list(action.sourceFactIds), referenceIndex.facts],
        ["CAUSE", list(action.sourceCauseIds), referenceIndex.causes],
        ["EVENT", list(action.sourceEventIds), referenceIndex.events]
    ];
    for (const [kind, values, known] of checks) {
        for (const value of values) {
            if (!known?.has(value)) reasons.push(`INVALID_CAUSAL_REFERENCE:${kind}:${value}`);
        }
    }
    return reasons;
}

export function registerBattleCausalReferences(referenceIndex, {
    actionId = null,
    facts = [],
    causes = [],
    events = [],
    executed = false
} = {}) {
    if (executed && actionId) referenceIndex.actions.add(actionId);
    for (const fact of facts) referenceIndex.facts.add(fact.factId || fact.type);
    for (const cause of causes) referenceIndex.causes.add(cause.causeId || cause.type);
    for (const event of events) referenceIndex.events.add(event.eventId || event.type);
}

export function createExternalBattleFacts(rows = [], { actionId, actionOrder } = {}) {
    return rows.map((row, index) => ({
        ...copy(row),
        factId: `dev-fact:${actionOrder}:${index}`,
        sourceAction: actionId,
        order: index
    }));
}

export function applyActorScopedBattleTransition({
    state,
    update,
    actionId,
    causeId,
    consequenceId,
    eventId,
    sourceFactIds = [],
    sourceEventIds = [],
    order,
    step
} = {}) {
    const actor = actorForTarget(update?.target);
    if (!actor || !update?.resultingState || typeof update.resultingState !== "object") {
        throw new TypeError("INVALID_ACTOR_SCOPED_TRANSITION");
    }
    if (!actionId || !causeId || !consequenceId || !eventId
        || sourceFactIds.length === 0 || sourceEventIds.length === 0) {
        throw new TypeError("UNGROUNDED_STATE_TRANSITION");
    }

    const next = copy(state);
    const transitions = [];
    for (const [stateIndex, [stateKey, after]] of Object.entries(update.resultingState).entries()) {
        const before = state[update.target][stateKey];
        if (Object.is(before, after)) continue;
        next[update.target][stateKey] = copy(after);
        const transitionOrder = order + stateIndex;
        transitions.push({
            transitionId: `dev-transition:${transitionOrder}:${step}:${stateKey}`,
            eventId,
            target: { actor, forceId: update.forceId || DEFAULT_FORCE_IDS[actor] },
            state: stateKey,
            before: copy(before),
            after: copy(after),
            sourceAction: actionId,
            sourceCause: causeId,
            sourceConsequence: consequenceId,
            sourceFacts: [...sourceFactIds],
            sourceEvents: [...sourceEventIds],
            order: transitionOrder
        });
    }
    return { state: next, transitions };
}

export function applyForceScopedBattleTransition({
    state,
    update,
    actionId,
    causeId,
    consequenceId,
    eventId,
    sourceFactIds = [],
    sourceEventIds = [],
    order,
    step
} = {}) {
    const current = state?.[update?.forceId];
    if (!current || current.actor !== update.actor || !update.resultingState
        || typeof update.resultingState !== "object" || Array.isArray(update.resultingState)) {
        throw new TypeError("INVALID_FORCE_SCOPED_TRANSITION");
    }
    if (!actionId || !causeId || !consequenceId || !eventId
        || sourceFactIds.length === 0 || sourceEventIds.length === 0) {
        throw new TypeError("UNGROUNDED_STATE_TRANSITION");
    }

    const next = copy(state);
    const transitions = [];
    for (const [stateIndex, [stateKey, after]] of Object.entries(update.resultingState).entries()) {
        const before = current.state[stateKey];
        if (Object.is(before, after)) continue;
        next[update.forceId].state[stateKey] = copy(after);
        const transitionOrder = order + stateIndex;
        transitions.push({
            transitionId: `dev-force-transition:${transitionOrder}:${step}:${stateKey}`,
            eventId,
            target: { actor: update.actor, forceId: update.forceId },
            state: stateKey,
            before: copy(before),
            after: copy(after),
            sourceAction: actionId,
            sourceCause: causeId,
            sourceConsequence: consequenceId,
            sourceFacts: [...sourceFactIds],
            sourceEvents: [...sourceEventIds],
            order: transitionOrder
        });
    }
    return { state: next, transitions };
}

export function applyForceRelationshipTransition({
    relations,
    update,
    actionId,
    causeId,
    consequenceId,
    eventId,
    sourceFactIds = [],
    sourceEventIds = [],
    order,
    step
} = {}) {
    const current = relations?.[update?.relationId];
    if (!current || current.type !== update.type
        || current.sourceForceId !== update.sourceForceId
        || current.targetForceId !== update.targetForceId
        || typeof update.status !== "string" || !update.status) {
        throw new TypeError("INVALID_FORCE_RELATIONSHIP_TRANSITION");
    }
    if (!actionId || !causeId || !consequenceId || !eventId
        || sourceFactIds.length === 0 || sourceEventIds.length === 0) {
        throw new TypeError("UNGROUNDED_RELATIONSHIP_TRANSITION");
    }
    if (current.status === update.status) return { relations: copy(relations), transitions: [] };

    const next = copy(relations);
    next[update.relationId].status = update.status;
    return {
        relations: next,
        transitions: [{
            transitionId: `dev-relation-transition:${order}:${step}:${update.relationId}`,
            eventId,
            relationId: update.relationId,
            relationType: update.type,
            sourceForceId: update.sourceForceId,
            targetForceId: update.targetForceId,
            before: current.status,
            after: update.status,
            sourceAction: actionId,
            sourceCause: causeId,
            sourceConsequence: consequenceId,
            sourceFacts: [...sourceFactIds],
            sourceEvents: [...sourceEventIds],
            order
        }]
    };
}
