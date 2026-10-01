function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Pure compatibility projection from the existing GlobalEventChoiceSystem
 * presentation into the Common GE Presentation contract.
 *
 * This adapter does not resolve choices, emit facts, mutate Chronicle, or own
 * any DOM. The existing Choice runtime may keep its current component until a
 * later visual migration explicitly adopts the Common GE shell.
 */
export function projectGlobalEventChoiceToCommonPresentation(presentation = null) {
    if (!presentation || typeof presentation.eventId !== "string") return null;
    if (!Array.isArray(presentation.choices) || presentation.choices.length === 0) return null;

    return Object.freeze({
        eventId: presentation.eventId,
        presentationKind: "CHOICE_EVENT",
        presentationMode: "CHOICE",
        titleKey: presentation.nameKey || null,
        descriptionKey: presentation.descKey || null,
        stillId: presentation.stillId || null,
        assetReference: presentation.assetReference || null,
        category: presentation.category || null,
        importance: presentation.importance || null,
        turn: Number.isInteger(presentation.turn) ? presentation.turn : null,
        actionKind: "CHOICE",
        publicContext: clone(presentation.publicContext || {}),
        actions: Object.freeze(presentation.choices.map(choice => Object.freeze({
            id: choice.id,
            labelKey: choice.labelKey || null
        })))
    });
}

export default projectGlobalEventChoiceToCommonPresentation;
