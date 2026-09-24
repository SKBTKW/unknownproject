/**
 * Economy authoring anchors v1.
 *
 * Design-only guardrails. These values do NOT price runtime actions and are not
 * consumed by gameplay logic. They simply preserve the current economic
 * hierarchy while Card / GE / Project prices are still being authored.
 *
 * Evidence at introduction (Stage1, 8 seeded live Verse15 runs):
 * - current Stage1 food/material card max recovery PVE: 0.83
 * - FirstRun Trial1 heavy (80% defense, far) recovery PVE: 5.87..7.91
 * - FirstRun Trial1 all-in (100% defense, far) recovery PVE: 6.63..8.89
 *
 * Rounded guardrails intentionally leave a large unallocated middle band for
 * future GE / Project / special-development costs instead of inventing those
 * prices prematurely.
 */
export const ECONOMY_COST_AUTHORING_ANCHORS_V1 = Object.freeze({
    bve: Object.freeze({
        foodPerBve: 4,
        materialPerBve: 3,
        foodSourceTerrainId: "GL1_PLAINS",
        materialSourceTerrainId: "E3_MOUNTAIN"
    }),
    pve: Object.freeze({
        routineStage1CardMax: 1.0,
        strategicAuthoringSpace: Object.freeze({
            min: 1.0,
            maxExclusive: 5.5
        }),
        firstRunTrial1Heavy: Object.freeze({
            min: 5.5,
            max: 8.0
        }),
        firstRunTrial1AllIn: Object.freeze({
            min: 6.5,
            max: 9.0
        })
    })
});

export function classifyEconomyPveForAuthoring(pve) {
    const value = Number(pve);
    if (!Number.isFinite(value) || value < 0) return "UNRESOLVED";

    const anchors = ECONOMY_COST_AUTHORING_ANCHORS_V1.pve;
    if (value <= anchors.routineStage1CardMax) return "ROUTINE_CARD";
    if (value < anchors.strategicAuthoringSpace.maxExclusive) return "STRATEGIC_OPEN";
    if (value <= anchors.firstRunTrial1Heavy.max) return "TRIAL_SCALE";
    return "ABOVE_CURRENT_TRIAL_SCALE";
}

export default ECONOMY_COST_AUTHORING_ANCHORS_V1;
