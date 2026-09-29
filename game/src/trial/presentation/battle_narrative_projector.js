function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function freezeEvent(event) {
    return Object.freeze({
        type: event.type,
        importance: Number.isFinite(Number(event.importance)) ? Number(event.importance) : 0,
        sourceCauseIds: Object.freeze([...(event.sourceCauseIds || [])]),
        sourceFactIds: Object.freeze([...(event.sourceFactIds || [])]),
        payload: Object.freeze(cloneData(event.payload || {})),
        emphasis: event.emphasis || null,
        presentationGroup: event.presentationGroup || null
    });
}

function semanticType(source, fallback) {
    const value = source?.presentationType ?? source?.semanticType ?? source?.type;
    return typeof value === "string" && value.length > 0 ? value : fallback;
}

function ids(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(id => typeof id === "string" || Number.isInteger(id));
}

function causalRows(snapshot) {
    const rows = [];
    for (const event of snapshot?.causalEvents || []) {
        if (!event || typeof event !== "object") continue;
        rows.push(freezeEvent({
            type: semanticType(event, "CAUSAL_EVENT"),
            importance: event.importance ?? event.priority ?? 0,
            sourceCauseIds: ids(event.sourceCauseIds ?? event.causeIds),
            sourceFactIds: ids(event.sourceFactIds ?? event.factIds),
            payload: event.payload ?? event.publicPayload ?? {},
            emphasis: event.emphasis,
            presentationGroup: event.presentationGroup ?? "CAUSALITY"
        }));
    }
    return rows.sort((a, b) => b.importance - a.importance);
}

function fixedEvent(type, payload, presentationGroup, importance = 100, emphasis = null) {
    if (payload === null || payload === undefined) return null;
    return freezeEvent({
        type,
        importance,
        payload: cloneData(payload),
        presentationGroup,
        emphasis
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
            return Object.freeze({ available: false, mode, events: Object.freeze([]), gameplay: null });
        }
        if (!Object.values(BATTLE_PRESENTATION_MODES).includes(mode)) {
            throw new Error(`INVALID_BATTLE_PRESENTATION_MODE:${mode}`);
        }

        const causal = causalRows(snapshot);
        const causalLimit = mode === BATTLE_PRESENTATION_MODES.FULL ? 3
            : mode === BATTLE_PRESENTATION_MODES.COMPACT ? 2 : 1;
        const selectedCausal = causal.slice(0, causalLimit);

        const events = [];
        const contact = fixedEvent("CONTACT", snapshot.contact ?? snapshot.battlefieldContext?.contact ?? null, "CONTACT", 120);
        if (contact) events.push(contact);
        events.push(...selectedCausal);

        if (mode !== BATTLE_PRESENTATION_MODES.INSTANT) {
            const normal = fixedEvent("NORMAL_OUTCOME_CONFIRMED", snapshot.normalOutcome, "OUTCOME", 110, "RESULT");
            if (normal) events.push(normal);
            const opportunity = fixedEvent(
                "OPPORTUNITY_OPENED",
                snapshot.opportunity,
                "OPPORTUNITY",
                115,
                snapshot.opportunity ? "TURNING_POINT" : null
            );
            if (opportunity) events.push(opportunity);
            const ember = fixedEvent("EMBER_COMMITTED", snapshot.emberCommit, "OPPORTUNITY", 100);
            if (ember) events.push(ember);
            const fortune = fixedEvent("FORTUNE_ROLLED", snapshot.fortuneRoll, "FORTUNE", 100);
            if (fortune) events.push(fortune);
        }

        const decisive = fixedEvent("DECISIVE_EVENT_CONFIRMED", snapshot.decisiveEvent, "DECISIVE", 130, "DECISIVE");
        if (decisive) events.push(decisive);
        const finalResult = fixedEvent("FINAL_RESULT_CONFIRMED", snapshot.finalCombatResult, "RESULT", 140, "RESULT");
        if (finalResult) events.push(finalResult);

        const gameplay = Object.freeze({
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
            mode,
            events: Object.freeze(events),
            gameplay
        });
    }
}

export default BattleNarrativeProjector;
