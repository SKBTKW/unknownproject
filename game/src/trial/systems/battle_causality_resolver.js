import {
    BATTLE_FACT_TYPES,
    BATTLE_CAUSE_CATEGORIES,
    BATTLE_CAUSE_TYPES,
    BATTLE_CONSEQUENCE_TYPES
} from "../domain/battle_causality_types.js";

const ROUGH_TERRAIN_FACTS = new Set([
    BATTLE_FACT_TYPES.TERRAIN_FOREST,
    BATTLE_FACT_TYPES.TERRAIN_DEEP_FOREST,
    BATTLE_FACT_TYPES.TERRAIN_WETLAND,
    BATTLE_FACT_TYPES.TERRAIN_HILL
]);

const CATEGORY_BY_CAUSE = Object.freeze({
    [BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED]: BATTLE_CAUSE_CATEGORIES.DEPLOYMENT,
    [BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED]: BATTLE_CAUSE_CATEGORIES.MOBILITY,
    [BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK]: BATTLE_CAUSE_CATEGORIES.DEPLOYMENT,
    [BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE]: BATTLE_CAUSE_CATEGORIES.POSITIONING,
    [BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY]: BATTLE_CAUSE_CATEGORIES.POSITIONING,
    [BATTLE_CAUSE_TYPES.HUMAN_PRESSURE_ADVANTAGE]: BATTLE_CAUSE_CATEGORIES.INITIATIVE,
    [BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED]: BATTLE_CAUSE_CATEGORIES.COHESION
});

function byType(rows, type) {
    return rows.filter(row => row?.type === type);
}

function sourceTypes(rows) {
    return [...new Set(rows.map(row => row?.causeId || row?.type).filter(Boolean))];
}

function cause(type, {
    facts = [],
    causes = [],
    actions = [],
    derivedFrom = [],
    tags = [],
    payload = {},
    target = "ENEMY_FORCE",
    phase = "NORMAL_BATTLE",
    severity = 1,
    state = "ACTIVE",
    presentationPriority = 0,
    index = 0
} = {}) {
    return {
        causeId: `battle-cause:${type}:${index}`,
        type,
        category: CATEGORY_BY_CAUSE[type] || null,
        phase,
        target,
        sourceFacts: sourceTypes(facts),
        sourceAction: actions.length > 0 ? (actions[0]?.actionId || actions[0]?.type || null) : null,
        sourceCauses: sourceTypes(causes),
        derivedFrom: [...new Set(derivedFrom.filter(Boolean))],
        payload,
        severity,
        state,
        tags: [...tags],
        presentationPriority
    };
}

function hasConsequence(consequences, type) {
    return consequences.some(row => row?.type === type);
}

export class BattleCausalityResolver {
    resolve({ battlefieldContext = {}, facts = [], actions = [], consequences = [] } = {}) {
        const causes = [];
        const constrainedFacts = byType(facts, BATTLE_FACT_TYPES.ENEMY_DEPLOYMENT_CONSTRAINED);
        if (constrainedFacts.length > 0) {
            const supporting = facts.filter(row =>
                ROUGH_TERRAIN_FACTS.has(row.type)
                || row.type === BATTLE_FACT_TYPES.ENEMY_LARGE_BODY
                || row.type === BATTLE_FACT_TYPES.ENEMY_HEAVY_EQUIPMENT
            );
            causes.push(cause(BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED, {
                facts: [...supporting, ...constrainedFacts],
                actions,
                tags: ["FAVORABLE", "DEPLOYMENT"],
                payload: {
                    deployedSuppression: battlefieldContext.enemy?.deployedSuppression ?? null,
                    strategicSuppression: battlefieldContext.enemy?.strategicSuppression ?? null,
                    deploymentRatio: battlefieldContext.enemy?.deploymentRatio ?? null
                },
                severity: battlefieldContext.enemy?.terrainInteraction?.deployment === "SEVERELY_CONSTRAINED" ? 3 : 2,
                index: causes.length
            }));
        }

        const interaction = battlefieldContext.enemy?.terrainInteraction;
        const movementConstrained = interaction?.mobility === "DISADVANTAGE"
            || interaction?.equipmentMobility === "DISADVANTAGE";
        if (movementConstrained && actions.length > 0) {
            causes.push(cause(BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED, {
                facts: facts.filter(row => ROUGH_TERRAIN_FACTS.has(row.type)),
                actions,
                tags: ["FAVORABLE", "MOBILITY"],
                payload: {
                    mobility: interaction?.mobility || null,
                    equipmentMobility: interaction?.equipmentMobility || null
                },
                severity: 2,
                index: causes.length
            }));
        }

        const reserveFacts = byType(facts, BATTLE_FACT_TYPES.ENEMY_RESERVE_PRESENT);
        if (reserveFacts.length > 0) {
            const deploymentCause = byType(causes, BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED);
            causes.push(cause(BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK, {
                facts: reserveFacts,
                causes: deploymentCause,
                actions,
                tags: ["FAVORABLE", "RESERVE"],
                payload: {
                    reserveSuppression: battlefieldContext.enemy?.reserveSuppression ?? null
                },
                index: causes.length
            }));
        }

        const terrainAdvantageFacts = byType(facts, BATTLE_FACT_TYPES.HIGH_GROUND);
        const favorableTerrainModifier = (battlefieldContext.combat?.appliedModifiers || []).some(row => {
            const before = Number(row?.before);
            const after = Number(row?.after);
            if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
            return row.target === "HUMAN_INTERCEPTION"
                ? after > before
                : row.target === "ENEMY_SUPPRESSION" && after < before;
        });
        if (terrainAdvantageFacts.length > 0 || favorableTerrainModifier) {
            causes.push(cause(BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE, {
                facts: terrainAdvantageFacts,
                actions,
                tags: ["FAVORABLE", "TERRAIN"],
                payload: {
                    modifierSources: (battlefieldContext.combat?.appliedModifiers || [])
                        .map(row => row?.source)
                        .filter(Boolean)
                },
                index: causes.length
            }));
        }

        const humanPower = Number(battlefieldContext.human?.finalPower);
        const enemyPower = Number(battlefieldContext.combat?.enemyFinalPower);
        if (Number.isFinite(humanPower) && Number.isFinite(enemyPower) && humanPower > enemyPower) {
            causes.push(cause(BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY, {
                facts: facts.filter(row =>
                    row.type === BATTLE_FACT_TYPES.HUMAN_LOCAL_POWER_PRESENT
                    || row.type === BATTLE_FACT_TYPES.ENEMY_LOCAL_POWER_PRESENT
                ),
                actions,
                tags: ["FAVORABLE", "LOCAL_POWER"],
                payload: { humanPower, enemyPower, localMargin: humanPower - enemyPower },
                index: causes.length
            }));
        }

        const localSuperiority = byType(causes, BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY);
        if (localSuperiority.length > 0 && Number(battlefieldContext.combat?.margin) > 0) {
            causes.push(cause(BATTLE_CAUSE_TYPES.HUMAN_PRESSURE_ADVANTAGE, {
                causes: localSuperiority,
                actions,
                tags: ["FAVORABLE", "PRESSURE"],
                payload: { margin: battlefieldContext.combat.margin },
                index: causes.length
            }));
        }

        if (
            hasConsequence(consequences, BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED)
            && battlefieldContext.futureInputs?.formationStretch
        ) {
            const supportDelay = consequences.find(row => row?.type === BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED);
            causes.push(cause(BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED, {
                actions,
                derivedFrom: [
                    ...(supportDelay?.sourceCauses || []),
                    supportDelay?.consequenceId
                ],
                tags: ["FAVORABLE", "COHESION"],
                payload: {
                    formationStretch: battlefieldContext.futureInputs.formationStretch
                },
                severity: 2,
                index: causes.length
            }));
        }

        return causes;
    }
}

export default BattleCausalityResolver;
