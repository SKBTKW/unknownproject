function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function freezeList(value) {
    return Object.freeze(Array.isArray(value) ? [...value] : []);
}

function freezeEvent(event) {
    return Object.freeze({
        id: event.id ?? null,
        type: event.type,
        sourceType: event.sourceType ?? null,
        presentationPriority: Number.isFinite(Number(event.presentationPriority))
            ? Number(event.presentationPriority)
            : 0,
        severity: event.severity ?? null,
        sourceAction: event.sourceAction ?? null,
        sourceCauseIds: freezeList(event.sourceCauseIds),
        sourceFactIds: freezeList(event.sourceFactIds),
        derivedFrom: freezeList(event.derivedFrom),
        payload: Object.freeze(cloneData(event.payload || {})),
        emphasis: event.emphasis || null,
        presentationGroup: event.presentationGroup || null
    });
}

function ids(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(id => typeof id === "string" || Number.isInteger(id));
}

function refOf(row, fallbackPrefix, index) {
    return row?.eventId
        ?? row?.consequenceId
        ?? row?.causeId
        ?? row?.actionId
        ?? row?.id
        ?? (row?.type ? `${fallbackPrefix}:${row.type}:${index}` : `${fallbackPrefix}:${index}`);
}

function severityRank(value) {
    if (Number.isFinite(Number(value))) return Number(value);
    switch (value) {
    case "CRITICAL": return 4;
    case "MAJOR": return 3;
    case "NORMAL": return 2;
    case "MINOR": return 1;
    default: return 0;
    }
}

function priorityOf(row) {
    if (Number.isFinite(Number(row?.presentationPriority))) return Number(row.presentationPriority);
    if (Number.isFinite(Number(row?.priority))) return Number(row.priority);
    return 0;
}

function causalRefs(row = {}) {
    return ids(row.sourceCauses ?? row.sourceCauseIds ?? row.causeIds);
}

function factRefs(row = {}) {
    return ids(row.sourceFacts ?? row.sourceFactIds ?? row.factIds);
}

function derivedRefs(row = {}) {
    return ids(row.derivedFrom);
}

function actionEvent(action, index) {
    if (!action || typeof action !== "object") return null;
    return freezeEvent({
        id: refOf(action, "battle-action", index),
        type: action.type || "BATTLE_ACTION",
        sourceType: "ACTION",
        sourceAction: action.actionId ?? null,
        payload: action,
        presentationGroup: "ACTION"
    });
}

function causeEvent(cause, index) {
    if (!cause || typeof cause !== "object") return null;
    return freezeEvent({
        id: refOf(cause, "battle-cause", index),
        type: cause.presentationType ?? cause.semanticType ?? cause.type ?? "BATTLE_CAUSE",
        sourceType: "CAUSE",
        presentationPriority: priorityOf(cause),
        severity: cause.severity ?? null,
        sourceAction: cause.sourceAction ?? null,
        sourceCauseIds: causalRefs(cause),
        sourceFactIds: factRefs(cause),
        derivedFrom: derivedRefs(cause),
        payload: cause.payload ?? {},
        presentationGroup: "CAUSE"
    });
}

function causalEvent(event, index) {
    if (!event || typeof event !== "object") return null;
    return freezeEvent({
        id: refOf(event, "battle-event", index),
        type: event.presentationType ?? event.semanticType ?? event.type ?? "CAUSAL_EVENT",
        sourceType: "CAUSAL_EVENT",
        presentationPriority: priorityOf(event),
        severity: event.severity ?? null,
        sourceAction: event.sourceAction ?? null,
        sourceCauseIds: causalRefs(event),
        sourceFactIds: factRefs(event),
        derivedFrom: derivedRefs(event),
        payload: event.payload ?? event.publicPayload ?? {},
        emphasis: event.emphasis,
        presentationGroup: "CAUSALITY"
    });
}

function consequenceEvent(consequence, index) {
    if (!consequence || typeof consequence !== "object") return null;
    return freezeEvent({
        id: refOf(consequence, "battle-consequence", index),
        type: consequence.type ?? "BATTLE_CONSEQUENCE",
        sourceType: "CONSEQUENCE",
        presentationPriority: priorityOf(consequence),
        severity: consequence.severity ?? null,
        sourceAction: consequence.sourceAction ?? null,
        sourceCauseIds: causalRefs(consequence),
        sourceFactIds: factRefs(consequence),
        derivedFrom: derivedRefs(consequence),
        payload: {
            target: consequence.target ?? null,
            resultingState: cloneData(consequence.resultingState ?? null),
            persistence: consequence.persistence ?? null,
            ...(cloneData(consequence.payload ?? {}))
        },
        presentationGroup: "CONSEQUENCE"
    });
}

function dependencyKeys(event) {
    return new Set([
        ...(event.sourceAction ? [event.sourceAction] : []),
        ...event.sourceCauseIds,
        ...event.derivedFrom
    ]);
}

function orderByProvenance(events) {
    const remaining = [...events];
    const emitted = [];
    const emittedIds = new Set();

    while (remaining.length > 0) {
        const readyIndex = remaining.findIndex(event => {
            const deps = dependencyKeys(event);
            if (deps.size === 0) return true;
            for (const dep of deps) {
                const existsInRemaining = remaining.some(candidate => candidate.id === dep);
                if (existsInRemaining && !emittedIds.has(dep)) return false;
            }
            return true;
        });
        const index = readyIndex >= 0 ? readyIndex : 0;
        const [event] = remaining.splice(index, 1);
        emitted.push(event);
        if (event.id) emittedIds.add(event.id);
    }
    return emitted;
}

function highlightCauses(snapshot, limit = 3) {
    return Object.freeze((snapshot?.causes || [])
        .filter(row => row && typeof row === "object")
        .map((row, index) => ({
            row,
            index,
            priority: priorityOf(row),
            severity: severityRank(row.severity)
        }))
        .sort((a, b) =>
            b.priority - a.priority
            || b.severity - a.severity
            || a.index - b.index
        )
        .slice(0, limit)
        .map(({ row, index }) => causeEvent(row, index)));
}

function fixedEvent(type, payload, presentationGroup, emphasis = null) {
    if (payload === null || payload === undefined) return null;
    return freezeEvent({
        type,
        sourceType: presentationGroup,
        payload: cloneData(payload),
        presentationGroup,
        emphasis
    });
}

function resultSummary(snapshot) {
    const outcome = snapshot?.normalOutcome || null;
    return Object.freeze({
        battleControl: cloneData(outcome?.battleControl ?? outcome?.outcome ?? null),
        enemyLoss: cloneData(outcome?.enemyLoss ?? null),
        humanLoss: cloneData(outcome?.humanLoss ?? null),
        postBattleState: cloneData(outcome?.postBattleState ?? snapshot?.battleState ?? null),
        reserveState: cloneData(outcome?.reserveState ?? null),
        exploitationPotential: cloneData(outcome?.exploitationPotential ?? null),
        finalCombatResult: cloneData(snapshot?.finalCombatResult ?? null)
    });
}

function buildFullTimeline(snapshot) {
    const causal = orderByProvenance([
        ...(snapshot.actions || []).map(actionEvent).filter(Boolean),
        ...(snapshot.causes || []).map(causeEvent).filter(Boolean),
        ...(snapshot.causalEvents || []).map(causalEvent).filter(Boolean),
        ...(snapshot.consequences || []).map(consequenceEvent).filter(Boolean)
    ]);

    const events = [];
    const contact = fixedEvent(
        "CONTACT",
        snapshot.contact ?? snapshot.battlefieldContext?.contact ?? null,
        "CONTACT"
    );
    if (contact) events.push(contact);
    events.push(...causal);

    const battleState = fixedEvent("BATTLE_STATE_CONFIRMED", snapshot.battleState, "STATE", "TURNING_POINT");
    if (battleState) events.push(battleState);
    const normal = fixedEvent("NORMAL_OUTCOME_CONFIRMED", snapshot.normalOutcome, "OUTCOME", "RESULT");
    if (normal) events.push(normal);
    const opportunity = fixedEvent("OPPORTUNITY_OPENED", snapshot.opportunity, "OPPORTUNITY", "TURNING_POINT");
    if (opportunity) events.push(opportunity);
    const ember = fixedEvent("EMBER_COMMITTED", snapshot.emberCommit, "OPPORTUNITY");
    if (ember) events.push(ember);
    const fortune = fixedEvent("FORTUNE_ROLLED", snapshot.fortuneRoll, "FORTUNE");
    if (fortune) events.push(fortune);
    const decisive = fixedEvent("DECISIVE_EVENT_CONFIRMED", snapshot.decisiveEvent, "DECISIVE", "DECISIVE");
    if (decisive) events.push(decisive);
    const finalResult = fixedEvent("FINAL_RESULT_CONFIRMED", snapshot.finalCombatResult, "RESULT", "RESULT");
    if (finalResult) events.push(finalResult);
    return Object.freeze(events);
}

function buildCompactTimeline(snapshot, highlights) {
    const events = [];
    const contact = fixedEvent(
        "CONTACT",
        snapshot.contact ?? snapshot.battlefieldContext?.contact ?? null,
        "CONTACT"
    );
    if (contact) events.push(contact);
    events.push(...highlights.slice(0, 2));
    const state = fixedEvent("BATTLE_STATE_CONFIRMED", snapshot.battleState, "STATE", "TURNING_POINT");
    if (state) events.push(state);
    const normal = fixedEvent("NORMAL_OUTCOME_CONFIRMED", snapshot.normalOutcome, "OUTCOME", "RESULT");
    if (normal) events.push(normal);
    const opportunity = fixedEvent("OPPORTUNITY_OPENED", snapshot.opportunity, "OPPORTUNITY", "TURNING_POINT");
    if (opportunity) events.push(opportunity);
    const finalResult = fixedEvent("FINAL_RESULT_CONFIRMED", snapshot.finalCombatResult, "RESULT", "RESULT");
    if (finalResult) events.push(finalResult);
    return Object.freeze(events);
}

function buildInstantTimeline(snapshot, highlights) {
    const events = [...highlights];
    const normal = fixedEvent("NORMAL_OUTCOME_CONFIRMED", snapshot.normalOutcome, "OUTCOME", "RESULT");
    if (normal) events.push(normal);
    const opportunity = fixedEvent("OPPORTUNITY_OPENED", snapshot.opportunity, "OPPORTUNITY", "TURNING_POINT");
    if (opportunity) events.push(opportunity);
    const finalResult = fixedEvent("FINAL_RESULT_CONFIRMED", snapshot.finalCombatResult, "RESULT", "RESULT");
    if (finalResult) events.push(finalResult);
    return Object.freeze(events);
}

function chronicleProjection(snapshot, highlights) {
    return Object.freeze({
        battleId: snapshot?.battleId ?? null,
        routeId: snapshot?.routeId ?? null,
        majorCauseRefs: Object.freeze(highlights.map(row => row.id).filter(Boolean)),
        normalOutcome: cloneData(snapshot?.normalOutcome ?? null),
        decisiveEvent: cloneData(snapshot?.decisiveEvent ?? null),
        flavorRefs: Object.freeze((snapshot?.flavorEvents || [])
            .map(row => row?.id)
            .filter(Boolean))
    });
}

export const BATTLE_PRESENTATION_MODES = Object.freeze({
    FULL: "FULL",
    COMPACT: "COMPACT",
    INSTANT: "INSTANT"
});

export class BattleNarrativeProjector {
    project(snapshot, { mode = BATTLE_PRESENTATION_MODES.FULL } = {}) {
        if (!snapshot || typeof snapshot !== "object") {
            return Object.freeze({
                available: false,
                mode,
                events: Object.freeze([]),
                fullTimeline: Object.freeze([]),
                compactTimeline: Object.freeze([]),
                instantSummary: Object.freeze([]),
                highlightedCauses: Object.freeze([]),
                resultSummary: null,
                gameplay: null
            });
        }
        if (!Object.values(BATTLE_PRESENTATION_MODES).includes(mode)) {
            throw new Error(`INVALID_BATTLE_PRESENTATION_MODE:${mode}`);
        }

        const highlightedCauses = highlightCauses(snapshot, 3);
        const fullTimeline = buildFullTimeline(snapshot);
        const compactTimeline = buildCompactTimeline(snapshot, highlightedCauses);
        const instantSummary = buildInstantTimeline(snapshot, highlightedCauses);
        const events = mode === BATTLE_PRESENTATION_MODES.FULL
            ? fullTimeline
            : mode === BATTLE_PRESENTATION_MODES.COMPACT
                ? compactTimeline
                : instantSummary;

        const gameplay = Object.freeze({
            causes: cloneData(snapshot.causes || []),
            consequences: cloneData(snapshot.consequences || []),
            normalOutcome: cloneData(snapshot.normalOutcome ?? null),
            opportunity: cloneData(snapshot.opportunity ?? null),
            emberCommit: cloneData(snapshot.emberCommit ?? null),
            fortuneRoll: cloneData(snapshot.fortuneRoll ?? null),
            decisiveEvent: cloneData(snapshot.decisiveEvent ?? null),
            finalCombatResult: cloneData(snapshot.finalCombatResult ?? null)
        });

        return Object.freeze({
            available: true,
            battleId: snapshot.battleId ?? snapshot.id ?? null,
            routeId: snapshot.routeId ?? null,
            mode,
            events,
            fullTimeline,
            compactTimeline,
            instantSummary,
            highlightedCauses,
            resultSummary: resultSummary(snapshot),
            opportunity: cloneData(snapshot.opportunity ?? null),
            chronicleProjection: chronicleProjection(snapshot, highlightedCauses),
            gameplay
        });
    }
}

export default BattleNarrativeProjector;
