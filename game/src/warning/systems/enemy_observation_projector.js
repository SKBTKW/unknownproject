import { createObservableEnemyProfile } from "../domain/observable_enemy_profile.js";

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

/**
 * Converts Trial-owned enemy truth into a deliberately lossy observation profile.
 *
 * This is an ownership boundary, not a convenience clone:
 * - unknown truth fields are ignored by default;
 * - exact suppression values are never copied or interpreted here;
 * - route cells, ingress coordinates, schedule data, combat values and commander
 *   internals are never copied;
 * - traits are only forwarded when Trial truth explicitly marks them observable.
 *
 * Expected optional truth shape:
 * {
 *   trialIndex,
 *   revision | threatRevision,
 *   observable: {
 *     scaleBand: string,
 *     directionHints: string[],
 *     physiqueTraits: string[],
 *     equipmentTraits: string[],
 *     movementTraits: string[],
 *     terrainTraits: string[]
 *   }
 * }
 *
 * If Trial later wants strategicSuppression translated into a visible scale band,
 * that translation belongs on the Trial/Truth side (or in an explicitly injected
 * observation policy), not in Warning.
 */
export class EnemyObservationProjector {
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
                : null,
            ...projected
        });
    }
}

export default EnemyObservationProjector;
