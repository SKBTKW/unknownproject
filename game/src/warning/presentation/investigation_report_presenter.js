const FACET_LABEL_KEYS = Object.freeze({
    DIRECTION: "INVESTIGATION_FACET_DIRECTION",
    SCALE: "INVESTIGATION_FACET_SCALE",
    PHYSIQUE: "INVESTIGATION_FACET_PHYSIQUE",
    EQUIPMENT: "INVESTIGATION_FACET_EQUIPMENT",
    MOVEMENT: "INVESTIGATION_FACET_MOVEMENT",
    TERRAIN: "INVESTIGATION_FACET_TERRAIN"
});

const FACET_GROUPS = Object.freeze({
    SCALE: "ENEMY",
    PHYSIQUE: "ENEMY",
    EQUIPMENT: "ENEMY",
    DIRECTION: "APPROACH",
    MOVEMENT: "APPROACH",
    TERRAIN: "ENVIRONMENT"
});

const GROUP_LABEL_KEYS = Object.freeze({
    ENEMY: "INVESTIGATION_GROUP_ENEMY",
    APPROACH: "INVESTIGATION_GROUP_APPROACH",
    ENVIRONMENT: "INVESTIGATION_GROUP_ENVIRONMENT",
    OTHER: "INVESTIGATION_GROUP_OTHER"
});

const STATUS_KEYS = Object.freeze({
    NEW: "INVESTIGATION_STATUS_NEW",
    RECONFIRMED: "INVESTIGATION_STATUS_RECONFIRMED",
    OBSERVED: "INVESTIGATION_STATUS_OBSERVED"
});

function normalizeTag(tag) {
    return typeof tag === "string" && tag.length > 0 ? tag : null;
}

function normalizeRoll(roll) {
    const total = Number.isInteger(roll?.total) ? roll.total : null;
    const dice = Array.isArray(roll?.dice)
        ? roll.dice.filter(value => Number.isInteger(value)).slice(0, 2)
        : [];
    return total === null ? null : { total, dice };
}

function observationVolume(roll, critical) {
    const total = Number.isInteger(roll?.total) ? roll.total : null;
    if (critical === true || total === 12) {
        return { band: "CRITICAL", key: "INVESTIGATION_VOLUME_CRITICAL" };
    }
    if (total === null) {
        return { band: "UNROLLED", key: "INVESTIGATION_VOLUME_UNROLLED" };
    }
    if (total >= 9) return { band: "MULTIPLE", key: "INVESTIGATION_VOLUME_MULTIPLE" };
    if (total >= 5) return { band: "ONE_CLUE", key: "INVESTIGATION_VOLUME_ONE_CLUE" };
    return { band: "LIMITED", key: "INVESTIGATION_VOLUME_LIMITED" };
}

function statusFor(tag, comparison, firstObservation) {
    const newTags = new Set(Array.isArray(comparison?.newTags) ? comparison.newTags : []);
    const repeatedTags = new Set(Array.isArray(comparison?.repeatedTags) ? comparison.repeatedTags : []);
    if (newTags.has(tag) || firstObservation === true) return "NEW";
    if (repeatedTags.has(tag)) return "RECONFIRMED";
    return "OBSERVED";
}

function summaryKey(observations) {
    const statuses = new Set(observations.map(item => item.status));
    if (observations.length === 0) return "INVESTIGATION_SUMMARY_EMPTY";
    if (statuses.has("NEW") && statuses.has("RECONFIRMED")) return "INVESTIGATION_SUMMARY_MIXED";
    if (statuses.has("NEW")) return "INVESTIGATION_SUMMARY_NEW";
    if (statuses.has("RECONFIRMED")) return "INVESTIGATION_SUMMARY_RECONFIRMED";
    return "INVESTIGATION_SUMMARY_OBSERVED";
}

export class InvestigationReportPresenter {
    present(report, {
        roll = null,
        critical = false,
        comparison = null,
        firstObservation = false
    } = {}) {
        const sourceType = typeof report?.sourceType === "string" && report.sourceType.length > 0
            ? report.sourceType
            : "UNKNOWN";

        const observations = Array.isArray(report?.observations)
            ? report.observations
                .map(observation => {
                    const tag = normalizeTag(observation?.tag);
                    if (!tag) return null;
                    const facet = typeof observation?.facet === "string" && observation.facet.length > 0
                        ? observation.facet
                        : "UNKNOWN";
                    const group = FACET_GROUPS[facet] || "OTHER";
                    const status = statusFor(tag, comparison, firstObservation);
                    return {
                        facet,
                        group,
                        groupLabelKey: GROUP_LABEL_KEYS[group],
                        tag,
                        status,
                        statusKey: STATUS_KEYS[status],
                        labelKey: FACET_LABEL_KEYS[facet] || "INVESTIGATION_FACET_UNKNOWN",
                        valueKey: `INVESTIGATION_TAG_${tag}`,
                        highlightToken: tag
                    };
                })
                .filter(Boolean)
            : [];

        const normalizedRoll = normalizeRoll(roll);
        const volume = observationVolume(normalizedRoll, critical);

        return {
            reportId: report?.id || null,
            observedAtVerse: Number.isInteger(report?.observedAtVerse)
                ? report.observedAtVerse
                : null,
            trialIndex: Number.isInteger(report?.trialIndex)
                ? report.trialIndex
                : null,
            sourceType,
            sourceTitleKey: `INVESTIGATION_SOURCE_${sourceType}_TITLE`,
            sourceBodyKey: report?.textKey || `INVESTIGATION_SOURCE_${sourceType}_BODY`,
            summaryKey: summaryKey(observations),
            preparationHintKey: "INVESTIGATION_REPORT_USE_FOR_TRIAL_PREP",
            roll: normalizedRoll,
            observationVolumeBand: volume.band,
            observationVolumeKey: volume.key,
            observations,
            hasObservations: observations.length > 0
        };
    }

    presentResult(result) {
        const report = result?.report || null;
        return this.present(report, {
            roll: result?.roll || null,
            critical: result?.critical === true,
            comparison: result?.comparison || null,
            firstObservation: Boolean(report) && !result?.previousReport
        });
    }
}

export default InvestigationReportPresenter;
