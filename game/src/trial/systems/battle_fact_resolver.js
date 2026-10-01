import { BATTLE_FACT_TYPES } from "../domain/battle_causality_types.js";

const TERRAIN_FACTS = Object.freeze({
    GL2_FOREST: BATTLE_FACT_TYPES.TERRAIN_FOREST,
    E2_FOREST_HILL: BATTLE_FACT_TYPES.TERRAIN_FOREST,
    GL3_DEEP_FOREST: BATTLE_FACT_TYPES.TERRAIN_DEEP_FOREST,
    E2_DEEP_HILL: BATTLE_FACT_TYPES.TERRAIN_DEEP_FOREST,
    E2_DEEP_FOREST_HILL: BATTLE_FACT_TYPES.TERRAIN_DEEP_FOREST,
    E0_WETLAND: BATTLE_FACT_TYPES.TERRAIN_WETLAND,
    E2_HILL: BATTLE_FACT_TYPES.TERRAIN_HILL,
    E2_DESERT_HILL: BATTLE_FACT_TYPES.TERRAIN_HILL
});

function fact(type, payload = {}, tags = []) {
    return { type, payload, tags: [...tags] };
}

function pushTerrainFact(facts, cell, role) {
    const type = TERRAIN_FACTS[String(cell?.terrainId || "").toUpperCase()];
    if (type) facts.push(fact(type, { role, terrainId: cell.terrainId, cellId: cell.cellId || null }, ["TERRAIN"]));
}

function hasHighGround(context) {
    return (context.combat?.appliedModifiers || []).some(row => row?.source === "HIGH_GROUND");
}

export class BattleFactResolver {
    resolve(context = {}) {
        const facts = [];
        pushTerrainFact(facts, context.interceptTerrain, "INTERCEPT");
        pushTerrainFact(facts, context.approachTerrain, "APPROACH");

        if (hasHighGround(context)) {
            facts.push(fact(BATTLE_FACT_TYPES.HIGH_GROUND, {
                interceptElevation: context.interceptTerrain?.elevation ?? null,
                approachElevation: context.approachTerrain?.elevation ?? null
            }, ["TERRAIN", "FAVORABLE"]));
        }

        if (context.enemy?.bodySize === "LARGE") {
            facts.push(fact(BATTLE_FACT_TYPES.ENEMY_LARGE_BODY, {}, ["ENEMY_PROFILE"]));
        }
        if (context.enemy?.equipmentClass === "HEAVY") {
            facts.push(fact(BATTLE_FACT_TYPES.ENEMY_HEAVY_EQUIPMENT, {}, ["ENEMY_PROFILE"]));
        }

        const interaction = context.enemy?.terrainInteraction;
        const constrained = ["CONSTRAINED", "SEVERELY_CONSTRAINED"].includes(interaction?.deployment)
            || interaction?.equipmentDeployment === "CONSTRAINED"
            || (Number.isFinite(context.enemy?.deploymentRatio) && context.enemy.deploymentRatio < 1);
        if (constrained) {
            facts.push(fact(BATTLE_FACT_TYPES.ENEMY_DEPLOYMENT_CONSTRAINED, {
                deployment: interaction?.deployment || null,
                equipmentDeployment: interaction?.equipmentDeployment || null,
                deploymentRatio: context.enemy?.deploymentRatio ?? null
            }, ["DEPLOYMENT", "FAVORABLE"]));
        }

        if ((context.enemy?.reserveSuppression ?? 0) > 0) {
            facts.push(fact(BATTLE_FACT_TYPES.ENEMY_RESERVE_PRESENT, {
                reserveSuppression: context.enemy.reserveSuppression
            }, ["RESERVE"]));
        }
        if ((context.human?.finalPower ?? 0) > 0) {
            facts.push(fact(BATTLE_FACT_TYPES.HUMAN_LOCAL_POWER_PRESENT, {
                finalPower: context.human.finalPower
            }, ["LOCAL_POWER"]));
        }
        if ((context.combat?.enemyFinalPower ?? 0) > 0) {
            facts.push(fact(BATTLE_FACT_TYPES.ENEMY_LOCAL_POWER_PRESENT, {
                finalPower: context.combat.enemyFinalPower
            }, ["LOCAL_POWER"]));
        }

        return facts;
    }
}

export default BattleFactResolver;
