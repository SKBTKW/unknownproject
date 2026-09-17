import { EnemyForceTerrainInteractionResolver } from "../systems/enemy_force_terrain_interaction_resolver.js";

function terrainId(cell) {
    const terrain = cell?.terrain || cell || {};
    return terrain.terrainId || terrain.id || cell?.terrainId || null;
}

function positive(value, fallback = 1) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
}

export const DEFAULT_TRIAL_ROUTE_COST_POLICY = Object.freeze({
    terrainCost: Object.freeze({
        GL1_PLAINS: 1,
        E1_RECLAIMED_LAND: 1,
        GL0_DESERT: 1.4,
        GL2_FOREST: 2,
        GL3_DEEP_FOREST: 3,
        E0_WETLAND: 2.4,
        E2_HILL: 1.8,
        E2_DESERT_HILL: 2,
        E2_FOREST_HILL: 2.5,
        E2_DEEP_HILL: 3.2,
        E2_DEEP_FOREST_HILL: 3.2,
        E3_MOUNTAIN: 4
    }),
    bodyMobilityMultiplier: Object.freeze({
        ADVANTAGE: 0.85,
        NEUTRAL: 1,
        DISADVANTAGE: 1.25
    }),
    equipmentMobilityMultiplier: Object.freeze({
        ADVANTAGE: 0.85,
        NEUTRAL: 1,
        DISADVANTAGE: 1.25
    }),
    affinityMultiplier: Object.freeze({
        HIGH: 0.75,
        NORMAL: 1,
        LOW: 1.35
    }),
    roadMultiplier: 0.6,
    minimumStepCost: 0.25
});

function normalizeAffinity(value) {
    if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
    const normalized = String(value || "NORMAL").toUpperCase();
    if (["HIGH", "NORMAL", "LOW"].includes(normalized)) return normalized;
    return "NORMAL";
}

function affinityFor(profile, interaction, id) {
    const affinity = profile?.terrainAffinity;
    if (!affinity || typeof affinity !== "object") return "NORMAL";
    return normalizeAffinity(
        affinity[id]
        ?? affinity[interaction?.terrainFamily]
        ?? affinity.default
        ?? "NORMAL"
    );
}

function multiplier(table, key, fallback = 1) {
    const value = table?.[key];
    return positive(value, fallback);
}

/**
 * Production route-cost policy for demi-human forces.
 *
 * Body/equipment are baseline tendencies, not absolute species laws.
 * terrainAffinity may counteract them, allowing unusual demi-human armies to
 * move naturally through terrain that would hinder a conventional force.
 * Roads are intentionally injected through roadResolver because GameState does
 * not yet own a canonical road representation.
 */
export class TrialRouteCostPolicy {
    constructor({
        policy = {},
        interactionResolver = new EnemyForceTerrainInteractionResolver(),
        roadResolver = null
    } = {}) {
        this.policy = {
            ...DEFAULT_TRIAL_ROUTE_COST_POLICY,
            ...policy,
            terrainCost: {
                ...DEFAULT_TRIAL_ROUTE_COST_POLICY.terrainCost,
                ...(policy.terrainCost || {})
            },
            bodyMobilityMultiplier: {
                ...DEFAULT_TRIAL_ROUTE_COST_POLICY.bodyMobilityMultiplier,
                ...(policy.bodyMobilityMultiplier || {})
            },
            equipmentMobilityMultiplier: {
                ...DEFAULT_TRIAL_ROUTE_COST_POLICY.equipmentMobilityMultiplier,
                ...(policy.equipmentMobilityMultiplier || {})
            },
            affinityMultiplier: {
                ...DEFAULT_TRIAL_ROUTE_COST_POLICY.affinityMultiplier,
                ...(policy.affinityMultiplier || {})
            }
        };
        this.interactionResolver = interactionResolver;
        this.roadResolver = roadResolver;
    }

    resolve({ gameState = null, fromCell = null, toCell = null, from = null, to = null, force = null } = {}) {
        const id = terrainId(toCell);
        const baseCost = positive(this.policy.terrainCost[id], 1);
        const profile = force?.profile || force?.forceProfile || {};
        const interaction = this.interactionResolver.resolve({
            bodySize: profile.bodySize || "MEDIUM",
            equipment: profile.equipment || ["STANDARD"],
            terrainId: id
        });

        const bodyMultiplier = multiplier(
            this.policy.bodyMobilityMultiplier,
            interaction.mobility,
            1
        );
        const equipmentMultiplier = multiplier(
            this.policy.equipmentMobilityMultiplier,
            interaction.equipmentMobility,
            1
        );
        const affinity = affinityFor(profile, interaction, id);
        const affinityMultiplier = typeof affinity === "number"
            ? affinity
            : multiplier(this.policy.affinityMultiplier, affinity, 1);
        const usesRoad = typeof this.roadResolver === "function"
            ? Boolean(this.roadResolver({ gameState, fromCell, toCell, from, to, force }))
            : false;
        const roadMultiplier = usesRoad ? positive(this.policy.roadMultiplier, 1) : 1;

        return Math.max(
            positive(this.policy.minimumStepCost, 0.25),
            baseCost * bodyMultiplier * equipmentMultiplier * affinityMultiplier * roadMultiplier
        );
    }
}

export default TrialRouteCostPolicy;
