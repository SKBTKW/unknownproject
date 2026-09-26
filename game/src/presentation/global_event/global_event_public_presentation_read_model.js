const EVENT_PUBLIC_PRESENTATION_POLICIES = Object.freeze({
    EVENT_DEMIHUMAN_TRACES: Object.freeze({
        presentationKind: "MAJOR_EVENT",
        titleKey: "EVENT_UNKNOWN_TRACES_NAME",
        descriptionKey: "EVENT_UNKNOWN_TRACES_DESC",
        stillId: "STILL_UNKNOWN_TRACES",
        publicKnowledge: "ANOMALY_ONLY"
    })
});

/**
 * Read-only projection from a public Global Event lifecycle notification into
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
        if (!policy) return null;

        return Object.freeze({
            eventId: notification.eventId,
            turn: Number.isInteger(notification.turn) ? notification.turn : null,
            category: typeof notification.category === "string" ? notification.category : null,
            importance: typeof notification.importance === "string" ? notification.importance : null,
            presentationKind: policy.presentationKind,
            titleKey: policy.titleKey,
            descriptionKey: policy.descriptionKey,
            stillId: policy.stillId,
            publicKnowledge: policy.publicKnowledge
        });
    }
}

export { EVENT_PUBLIC_PRESENTATION_POLICIES };
export default GlobalEventPublicPresentationReadModel;
