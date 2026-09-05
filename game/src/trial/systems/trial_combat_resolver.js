import { MODIFIER_TARGETS } from "../domain/trial_types.js";
import { TrialModifierCalculator } from "./trial_modifier_calculator.js";
import { TrialTerrainEffectResolver } from "./trial_terrain_effect_resolver.js";

export class TrialCombatResolver {
    constructor({ terrainResolver = new TrialTerrainEffectResolver(), modifierCalculator = new TrialModifierCalculator() } = {}) {
        this.terrainResolver = terrainResolver;
        this.modifierCalculator = modifierCalculator;
    }

    resolve(context) {
        const terrain = this.terrainResolver.resolve(context);
        if (!terrain.canIntercept) {
            return { success: false, reason: "INTERCEPTION_TERRAIN_FORBIDDEN", context, terrain };
        }
        if (!terrain.canEnterApproachRoute) {
            return { success: false, reason: "APPROACH_ROUTE_FORBIDDEN", context, terrain };
        }

        const human = this.modifierCalculator.apply(
            context.human.baseInterceptionPower,
            terrain.modifiers.filter(item => item.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION)
        );
        const enemy = this.modifierCalculator.apply(
            context.enemy.suppression,
            terrain.modifiers.filter(item => item.target === MODIFIER_TARGETS.ENEMY_SUPPRESSION)
        );
        const damageToSuppression = Math.min(human.value, enemy.value);

        return {
            success: true,
            humanInterception: human.value,
            enemySuppression: enemy.value,
            damageToSuppression,
            remainingSuppression: Math.max(0, enemy.value - damageToSuppression),
            humanBreakdown: human.breakdown,
            enemyBreakdown: enemy.breakdown,
            modifiers: terrain.modifiers,
            events: terrain.events
        };
    }
}

