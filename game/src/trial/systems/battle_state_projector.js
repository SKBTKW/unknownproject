import {
    BATTLE_CAUSE_TYPES,
    BATTLE_CONSEQUENCE_TYPES
} from "../domain/battle_causality_types.js";

function hasType(rows, type) {
    return Array.isArray(rows) && rows.some(row => row?.type === type);
}

export class BattleStateProjector {
    project({ battlefieldContext = {}, causes = [], consequences = [] } = {}) {
        const interaction = battlefieldContext.enemy?.terrainInteraction || {};
        const reserve = Number(battlefieldContext.enemy?.reserveSuppression) || 0;
        const humanPower = Number(battlefieldContext.human?.finalPower);
        const enemyPower = Number(battlefieldContext.combat?.enemyFinalPower);

        return {
            deployment: interaction.deployment === "SEVERELY_CONSTRAINED"
                ? "SEVERELY_CONSTRAINED"
                : hasType(causes, BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED)
                    ? "CONSTRAINED"
                    : "NORMAL",
            cohesion: "ORDERED",
            reserveAvailability: reserve > 0 ? "AVAILABLE" : "NONE",
            localSuperiority: Number.isFinite(humanPower) && Number.isFinite(enemyPower)
                ? (humanPower > enemyPower ? "HUMAN" : humanPower < enemyPower ? "ENEMY" : "EVEN")
                : "UNKNOWN",
            supportDelay: hasType(consequences, BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED)
                ? "DELAYED"
                : "NONE",
            withdrawal: "NONE",
            collapse: "STABLE"
        };
    }
}

export default BattleStateProjector;
