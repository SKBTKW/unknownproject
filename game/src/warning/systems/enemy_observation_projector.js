import { createObservableEnemyProfile } from "../domain/observable_enemy_profile.js";

const DEFAULT_SCALE_BANDS = Object.freeze([
    { maxExclusive: 8, band: "SMALL" },
    { maxExclusive: 16, band: "MEDIUM" },
    { maxExclusive: 28, band: "LARGE" },
    { maxExclusive: Infinity, band: "VERY_LARGE" }
]);

const OBSERVABLE_KEYS = Object.freeze({
    directionHints: "directionHints",
    physiqueTraits: "physiqueTraits",
    equipmentTraits: "equipmentTraits",
    movementTraits: "movementTraits",
    terrainTraits: "terrainTraits"
});

function cloneStringList(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter(entry => typeof entry === "string" && entry.length > 0)
        .map(entry => entry);
}

function finiteNonNegative(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function resolveScaleBand(strategicSuppression, bands) {
    const suppression = finiteNonNegative(strategicSuppression);
    if (suppression === null) return null;

    for (const entry of bands) {
        if (suppression < entry.maxExclusive) return entry.band;
    }
    return null;
}

/**
 * Converts Trial-owned enemy truth into a deliberately lossy observation profile.
 *
 * This is a security/ownership boundary, not a convenience clone:
 * - unknown truth fields are ignored by default;
 * - exact suppression values are reduced to a coarse scale band;
 * - route cells, ingress coordinates, schedule data, combat values and commander
 *   internals are never copied;
 * - traits are only forwarded when Trial truth explicitly marks them observable.
 *
 * Expected optional truth shape:
 * {
 *   trialIndex,
 *   revision | threatRevision,
 *   strategicSuppression,
 *   observable: {
 *     directionHints: string[],
 *     physiqueTraits: string[],
 *     equipmentTraits: string[],
 *     movementTraits: string[],
 *     terrainTraits: string[]
 *   }
 * }
 */
export class EnemyObservationProjector {
    constructor({ scaleBands = DEFAULT_SCALE_BANDS } = {}) {
        this.scaleBands = scaleBands;
    }

    project(truthSnapshot) {
        if (!truthSnapshot || typeof truthSnapshot !== "object") {
            return createObservableEnemyProfile();
        }

        const observable = truthSnapshot.observable && typeof truthSnapshot.observable === "object"
            ? truthSnapshot.observable
            : {};

        const projected = {};
        for (const [outputKey, inputKey] of Object.entries(OBSERVABLE_KEYS)) {
            projected[outputKey] = cloneStringList(observable[inputKey]);
        }

        return createObservableEnemyProfile({
            trialIndex: Number.isInteger(truthSnapshot.trialIndex)
                ? truthSnapshot.trialIndex
                : null,
            threatRevision: Number.isInteger(truthSnapshot.threatRevision)
                ? truthSnapshot.threatRevision
                : (Number.isInteger(truthSnapshot.revision) ? truthSnapshot.revision : null),
            scaleBand: typeof observable.scaleBand === "string" && observable.scaleBand.length > 0
                ? observable.scaleBand
                : resolveScaleBand(truthSnapshot.strategicSuppression, this.scaleBands),
            ...projected
        });
    }
}

export { DEFAULT_SCALE_BANDS };
export default EnemyObservationProjector;
