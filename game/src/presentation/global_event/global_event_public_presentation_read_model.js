const EVENT_PUBLIC_PRESENTATION_POLICIES = Object.freeze({
    EVENT_DEMIHUMAN_TRACES: Object.freeze({
        presentationKind: "MAJOR_EVENT",
        titleKey: "EVENT_UNKNOWN_TRACES_NAME",
        descriptionKey: "EVENT_UNKNOWN_TRACES_DESC",
        stillId: "STILL_UNKNOWN_TRACES",
        publicKnowledge: "ANOMALY_ONLY"
    })
});

const EVENT_PUBLIC_PRESENTATION_CONTRACTS = Object.freeze({
    EVENT_DEMIHUMAN_TRACES: Object.freeze({
        presentationMode: "NOTICE",
        actionKind: "CONFIRM",
        assetReference: null
    })
});

function buildProjection(eventId, policy, contract, {
    turn = null,
    category = null,
    importance = null
} = {}) {
    return Object.freeze({
        eventId,
        presentationKind: policy.presentationKind,
        presentationMode: contract.presentationMode,
        titleKey: policy.titleKey,
        descriptionKey: policy.descriptionKey,
        stillId: policy.stillId || null,
        assetReference: contract.assetReference || null,
        category: typeof category === "string" ? category : null,
        importance: typeof importance === "string" ? importance : null,
        turn: Number.isInteger(turn) ? turn : null,
        actionKind: contract.actionKind,
        publicKnowledge: policy.publicKnowledge || null
    });
}

/**
 * Read-only projection from public Global Event lifecycle data into
 * presentation-safe metadata.
 *
 * This layer owns no Global Event, Warning, Investigation, Advisor, Tutorial,
 * or board mutation. Unknown events deliberately return null until a public
 * presentation policy is defined for them.
 */
export class GlobalEventPublicPresentationReadModel {
    project(notification = null) {
        if (!notification || notification.timing !== "START") return null;
        if (typeof notification.eventId !== "string") return null;

        const policy = EVENT_PUBLIC_PRESENTATION_POLICIES[notification.eventId];
        const contract = EVENT_PUBLIC_PRESENTATION_CONTRACTS[notification.eventId];
        if (!policy || !contract) return null;

        return buildProjection(notification.eventId, policy, contract, {
            turn: notification.turn,
            category: notification.category,
            importance: notification.importance
        });
    }

    /**
     * Restore-only projection from persisted active event identity.
     * It intentionally does not emit or replay a Global Event lifecycle event.
     */
    projectActive(activeEvent = null, { turn = null } = {}) {
        const eventId = activeEvent?.definitionId || activeEvent?.eventId || null;
        if (typeof eventId !== "string") return null;
        const policy = EVENT_PUBLIC_PRESENTATION_POLICIES[eventId];
        const contract = EVENT_PUBLIC_PRESENTATION_CONTRACTS[eventId];
        if (!policy || !contract) return null;
        return buildProjection(eventId, policy, contract, { turn });
    }
}

export {
    EVENT_PUBLIC_PRESENTATION_POLICIES,
    EVENT_PUBLIC_PRESENTATION_CONTRACTS
};
export default GlobalEventPublicPresentationReadModel;
