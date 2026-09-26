/**
 * Economy authoring anchors v1.
 *
 * Design-only guardrails. These values do NOT price runtime actions and are not
 * consumed by gameplay logic. They simply preserve the current economic
 * hierarchy while Card / GE / Project prices are still being authored.
 *
 * Evidence after the paid Board Investment envelope and FirstRun Trial1
 * portfolio retuning (8 seeded live Verse15 runs):
 * - current Stage1 food/material card max recovery PVE at Verse15: 0.80
 * - FirstRun Trial1 heavy (80% defense, far) recovery PVE: 4.69..6.56
 * - FirstRun Trial1 all-in (100% defense, far) recovery PVE: 5.28..7.36
 *
 * Rounded guardrails intentionally leave a large unallocated middle band for
 * future GE / Project / special-development costs instead of inventing those
 * prices prematurely. The <=1 PVE card anchor is explicitly a mature Stage1
 * Verse15 reference, not a claim that every live card should cost <=1 PVE at
 * its actual first-availability Verse. Upper Trial guardrails are rounded
 * outward to contain the current seeded runtime envelope.
 */
export const ECONOMY_COST_AUTHORING_ANCHORS_V1 = Object.freeze({
    bve: Object.freeze({
        foodPerBve: 4,
        materialPerBve: 3,
        foodSourceTerrainId: "GL1_PLAINS",
        materialSourceTerrainId: "E3_MOUNTAIN"
    }),
    pve: Object.freeze({
        matureStage1CardReferenceMax: 1.0,
        strategicAuthoringSpace: Object.freeze({
            min: 1.0,
            maxExclusive: 4.5
        }),
        firstRunTrial1Heavy: Object.freeze({
            min: 4.5,
            max: 6.8
        }),
        firstRunTrial1AllIn: Object.freeze({
            min: 5.0,
            max: 7.6
        })
    })
});

export function classifyEconomyPveForAuthoring(pve) {
    const value = Number(pve);
    if (!Number.isFinite(value) || value < 0) return "UNRESOLVED";

    const anchors = ECONOMY_COST_AUTHORING_ANCHORS_V1.pve;
    if (value <= anchors.matureStage1CardReferenceMax) return "MATURE_STAGE1_REFERENCE";
    if (value < anchors.strategicAuthoringSpace.maxExclusive) return "STRATEGIC_OPEN";
    if (value <= anchors.firstRunTrial1Heavy.max) return "TRIAL_SCALE";
    return "ABOVE_CURRENT_TRIAL_SCALE";
}

export default ECONOMY_COST_AUTHORING_ANCHORS_V1;
