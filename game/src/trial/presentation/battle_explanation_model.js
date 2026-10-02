function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function freezeClone(value) {
    if (value === null || value === undefined) return value ?? null;
    if (Array.isArray(value)) return Object.freeze(value.map(freezeClone));
    if (typeof value !== "object") return value;
    const copy = {};
    for (const [key, item] of Object.entries(value)) copy[key] = freezeClone(item);
    return Object.freeze(copy);
}

function opportunityStatus(snapshot) {
    const opportunity = snapshot?.opportunity;
    if (!opportunity || typeof opportunity !== "object") return "NONE";
    if (opportunity.declined === true || opportunity.state === "DECLINED") return "DECLINED";
    if (snapshot?.fortuneRoll) return "RESOLVED";
    if (snapshot?.emberCommit) return "COMMITTED";
    return "PENDING";
}

function sourceOfWhat(snapshot) {
    return snapshot?.finalCombatResult ? "FINAL_COMBAT_RESULT" : "NORMAL_OUTCOME";
}

/**
 * Presentation-only explanation model.
 *
 * The model deliberately preserves the canonical split between normalOutcome
 * and finalCombatResult. It does not infer causes, eligibility, Fortune
 * meaning, Decisive Event selection, or counterfactual outcomes.
 */
export function buildBattleExplanationModel(snapshot, { highlightedCauses = [] } = {}) {
    if (!snapshot || typeof snapshot !== "object") return null;

    const normalResult = freezeClone(snapshot.normalOutcome ?? null);
    const finalResult = freezeClone(snapshot.finalCombatResult ?? null);
    const decisiveEvent = freezeClone(snapshot.decisiveEvent ?? null);
    const consequences = freezeClone(snapshot.consequences ?? []);
    const why = freezeClone((Array.isArray(highlightedCauses) ? highlightedCauses : []).map(row => ({
        causeId: row?.id ?? null,
        type: row?.type ?? null,
        presentationPriority: row?.presentationPriority ?? 0,
        severity: row?.severity ?? null,
        sourceAction: row?.sourceAction ?? null,
        sourceCauseIds: row?.sourceCauseIds ?? [],
        sourceFactIds: row?.sourceFactIds ?? [],
        derivedFrom: row?.derivedFrom ?? [],
        whyRefs: row?.whyRefs ?? [],
        payload: cloneData(row?.payload ?? {})
    })));

    const fortuneStatus = opportunityStatus(snapshot);
    const fortune = Object.freeze({
        present: fortuneStatus !== "NONE",
        status: fortuneStatus,
        opportunity: freezeClone(snapshot.opportunity ?? null),
        intervention: freezeClone(snapshot.emberCommit ?? null),
        roll: freezeClone(snapshot.fortuneRoll ?? null),
        decisiveEvent,
        finalResult
    });

    return Object.freeze({
        what: Object.freeze({
            source: sourceOfWhat(snapshot),
            result: finalResult ?? normalResult
        }),
        normalResult,
        why,
        decisive: decisiveEvent,
        consequences,
        fortune,
        finalResult
    });
}

export default buildBattleExplanationModel;
