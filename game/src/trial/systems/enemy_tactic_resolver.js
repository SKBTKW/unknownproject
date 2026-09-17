import { EnemyForceTerrainInteractionResolver } from "./enemy_force_terrain_interaction_resolver.js";

export const ENEMY_TACTICS = Object.freeze({
    FRONTAL_BREAKTHROUGH: "FRONTAL_BREAKTHROUGH",
    DISPERSED_INFILTRATION: "DISPERSED_INFILTRATION",
    FLANKING: "FLANKING",
    AMBUSH_CAUTION: "AMBUSH_CAUTION",
    MAIN_FEINT: "MAIN_FEINT"
});

export const ENEMY_TACTIC_SCOPES = Object.freeze({
    FORCE: "FORCE",
    ARMY: "ARMY"
});

export const DEFAULT_ENEMY_TACTIC_POLICY = Object.freeze({
    flankingCommanderMinLevel: 2,
    ambushCautionCommanderMinLevel: 3,
    mainFeintCommanderMinLevel: 4,
    mainFeintMinForces: 2
});

function positiveInt(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function commanderLevel(force, armyStructure) {
    return positiveInt(
        force?.commander?.level
        ?? armyStructure?.commander?.level,
        1
    );
}

function tactic(id, scope, reasons) {
    return Object.freeze({
        id,
        scope,
        reasons: Object.freeze([...reasons])
    });
}

/**
 * Resolves enemy tactic eligibility only.
 *
 * This layer intentionally does not apply combat multipliers, damage, reserve
 * mutation or route changes. It translates existing force/terrain/command
 * semantics into available tactic identities so later execution can have its
 * own explicit costs and consequences.
 */
export class EnemyTacticResolver {
    constructor({
        policy = {},
        interactionResolver = new EnemyForceTerrainInteractionResolver()
    } = {}) {
        this.policy = {
            ...DEFAULT_ENEMY_TACTIC_POLICY,
            ...policy
        };
        this.interactionResolver = interactionResolver;
    }

    resolve({ force = null, armyStructure = null, terrainId = null } = {}) {
        const profile = force?.profile || force?.forceProfile || {};
        const interaction = this.interactionResolver.resolve({
            bodySize: profile.bodySize || "MEDIUM",
            equipment: profile.equipment || ["STANDARD"],
            terrainId
        });
        const level = commanderLevel(force, armyStructure);
        const combatTraits = new Set(interaction.combatTraits || []);
        const tactics = [];

        if (
            interaction.terrainFamily === "OPEN"
            && interaction.equipmentClass === "HEAVY"
            && combatTraits.has("FRONTAL_BREAKTHROUGH")
        ) {
            tactics.push(tactic(
                ENEMY_TACTICS.FRONTAL_BREAKTHROUGH,
                ENEMY_TACTIC_SCOPES.FORCE,
                ["OPEN_TERRAIN", "HEAVY_EQUIPMENT"]
            ));
        }

        if (
            ["FOREST", "DEEP_FOREST"].includes(interaction.terrainFamily)
            && interaction.bodySize === "SMALL"
            && interaction.equipmentClass === "LIGHT"
            && combatTraits.has("INFILTRATION_FRIENDLY")
        ) {
            tactics.push(tactic(
                ENEMY_TACTICS.DISPERSED_INFILTRATION,
                ENEMY_TACTIC_SCOPES.FORCE,
                ["SMALL_BODY", "LIGHT_EQUIPMENT", "FOREST_TERRAIN"]
            ));
        }

        if (
            level >= positiveInt(this.policy.flankingCommanderMinLevel, 2)
            && interaction.equipmentClass === "LIGHT"
            && (interaction.mobility === "ADVANTAGE" || interaction.equipmentMobility === "ADVANTAGE")
        ) {
            tactics.push(tactic(
                ENEMY_TACTICS.FLANKING,
                ENEMY_TACTIC_SCOPES.FORCE,
                ["LIGHT_EQUIPMENT", "MOBILITY_ADVANTAGE", `COMMANDER_LEVEL_${level}`]
            ));
        }

        if (
            level >= positiveInt(this.policy.ambushCautionCommanderMinLevel, 3)
            && ["FOREST", "DEEP_FOREST"].includes(interaction.terrainFamily)
        ) {
            tactics.push(tactic(
                ENEMY_TACTICS.AMBUSH_CAUTION,
                ENEMY_TACTIC_SCOPES.FORCE,
                ["FOREST_TERRAIN", `COMMANDER_LEVEL_${level}`]
            ));
        }

        const forceCount = positiveInt(
            armyStructure?.forceCount ?? armyStructure?.forces?.length,
            1
        );
        if (
            level >= positiveInt(this.policy.mainFeintCommanderMinLevel, 4)
            && forceCount >= positiveInt(this.policy.mainFeintMinForces, 2)
        ) {
            tactics.push(tactic(
                ENEMY_TACTICS.MAIN_FEINT,
                ENEMY_TACTIC_SCOPES.ARMY,
                [`FORCE_COUNT_${forceCount}`, `COMMANDER_LEVEL_${level}`]
            ));
        }

        return Object.freeze({
            terrainId,
            terrainFamily: interaction.terrainFamily,
            commanderLevel: level,
            forceId: force?.id || null,
            tactics: Object.freeze(tactics)
        });
    }
}

export default EnemyTacticResolver;
