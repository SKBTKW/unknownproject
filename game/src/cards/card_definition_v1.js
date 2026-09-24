/* =============================================================
   game/src/cards/card_definition_v1.js
   Card Definition v1 adapter. Legacy masters stay authoritative while
   callers can consume a stable, minimal normalized view.
   ============================================================= */

const CARD_DEFINITION_VERSION = 1;

function freezeArray(value) {
    return Object.freeze(Array.isArray(value) ? [...value] : []);
}

function normalizeRequirementList(value) {
    if (!Array.isArray(value)) return Object.freeze([]);
    return Object.freeze(value.filter(Boolean).map(requirement =>
        Object.freeze({ ...requirement })
    ));
}

function normalizeCardDefinitionV1(source) {
    if (!source || typeof source !== "object") return null;

    const authoredOffering = source.offering && typeof source.offering === "object"
        ? source.offering
        : {};
    const authoredExecution = source.execution && typeof source.execution === "object"
        ? source.execution
        : {};

    return Object.freeze({
        schemaVersion: CARD_DEFINITION_VERSION,
        id: source.id || null,
        category: source.category || "LAND",
        rarity: source.rarity || "C",
        tags: freezeArray(source.tags),
        offering: Object.freeze({
            category: authoredOffering.category ?? source.offeringCategory ?? source.category ?? "LAND",
            requirements: normalizeRequirementList(authoredOffering.requirements),
            weight: authoredOffering.weight ?? source.weight ?? 0.1
        }),
        execution: Object.freeze({
            requirements: normalizeRequirementList(authoredExecution.requirements),
            targeting: authoredExecution.targeting ?? source.targeting ?? null
        }),
        effects: freezeArray(source.effects),
        lifecycle: Object.freeze({
            cyclePolicy: source.lifecycle?.cyclePolicy ?? source.cyclePolicy ?? null,
            minStage: source.lifecycle?.minStage ?? source.minStage ?? 1
        }),
        presentation: Object.freeze({
            nameKey: source.presentation?.nameKey ?? source.nameKey ?? null,
            descriptionKey: source.presentation?.descriptionKey ?? source.descriptionKey ?? null
        }),
        legacy: source
    });
}

function unwrapCardDefinition(source) {
    if (!source) return null;
    if (source.schemaVersion === CARD_DEFINITION_VERSION && source.legacy) {
        return source.legacy;
    }
    return source.terrain || source;
}

export {
    CARD_DEFINITION_VERSION,
    normalizeCardDefinitionV1,
    unwrapCardDefinition
};

export default normalizeCardDefinitionV1;
