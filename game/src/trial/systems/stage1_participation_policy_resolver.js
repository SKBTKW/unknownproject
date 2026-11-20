function nonNegative(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label}_INVALID`);
    return number;
}

export function validateStage1ParticipationPolicy(policy) {
    if (!policy || policy.enabled !== true || typeof policy.id !== "string" || !policy.id
        || !Number.isSafeInteger(policy.version) || policy.version < 1
        || policy.stageId !== 1 || policy.trialIndex !== 1
        || policy.sourceDisposition !== "CONSOLIDATE_ALL_SOURCES"
        || policy.runtimeProfileSource !== "PRIMARY_SOURCE"
        || !Array.isArray(policy.participantBands) || policy.participantBands.length !== 3
        || !policy.sourceWeights || !Array.isArray(policy.ingressDirectionPriority)) {
        throw new TypeError("STAGE1_PARTICIPATION_POLICY_INVALID");
    }
    const bands = policy.participantBands.map((band, index) => ({
        participantCount: band?.participantCount,
        minInclusive: nonNegative(band?.minInclusive, "STAGE1_PARTICIPATION_BAND_MIN"),
        maxExclusive: band?.maxExclusive === null || band?.maxExclusive === Number.POSITIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : nonNegative(band?.maxExclusive, "STAGE1_PARTICIPATION_BAND_MAX")
    }));
    if (bands.some((band, index) => band.participantCount !== index + 1
        || band.maxExclusive <= band.minInclusive)
        || bands[0].minInclusive !== 0 || bands[2].maxExclusive !== Number.POSITIVE_INFINITY
        || bands[1].minInclusive !== bands[0].maxExclusive
        || bands[2].minInclusive !== bands[1].maxExclusive) {
        throw new TypeError("STAGE1_PARTICIPATION_BANDS_INVALID");
    }
    for (const slot of ["A", "B", "C"]) nonNegative(policy.sourceWeights[slot], `STAGE1_PARTICIPATION_WEIGHT_${slot}`);
    if (["A", "B", "C"].every(slot => Number(policy.sourceWeights[slot]) === 0)) {
        throw new TypeError("STAGE1_PARTICIPATION_WEIGHTS_EMPTY");
    }
    const directions = ["NORTH", "EAST", "SOUTH", "WEST"];
    if (policy.ingressDirectionPriority.length !== 4
        || new Set(policy.ingressDirectionPriority).size !== 4
        || policy.ingressDirectionPriority.some(value => !directions.includes(value))) {
        throw new TypeError("STAGE1_PARTICIPATION_DIRECTION_PRIORITY_INVALID");
    }
    return { ...structuredClone(policy), participantBands: bands };
}

export class Stage1ParticipationPolicyResolver {
    constructor(policy) {
        this.policy = validateStage1ParticipationPolicy(policy);
    }

    resolve({ strategicSuppression, stageId = 1, trialIndex = 1 } = {}) {
        const suppression = nonNegative(strategicSuppression, "STAGE1_PARTICIPATION_SUPPRESSION");
        if (stageId !== this.policy.stageId || trialIndex !== this.policy.trialIndex) return null;
        const band = this.policy.participantBands.find(entry =>
            suppression >= entry.minInclusive && suppression < entry.maxExclusive
        );
        if (!band) throw new RangeError("STAGE1_PARTICIPATION_BAND_NOT_FOUND");
        return {
            participantCount: band.participantCount,
            policy: {
                enabled: true,
                id: this.policy.id,
                version: this.policy.version,
                sourceDisposition: this.policy.sourceDisposition,
                runtimeProfileSource: this.policy.runtimeProfileSource
            }
        };
    }
}

export default Stage1ParticipationPolicyResolver;
