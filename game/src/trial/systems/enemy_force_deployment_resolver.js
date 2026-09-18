function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

export const DEFAULT_ENEMY_FORCE_DEPLOYMENT_POLICY = Object.freeze({
    bodyDeploymentRatio: Object.freeze({
        FULL: 1,
        CONSTRAINED: 0.8,
        SEVERELY_CONSTRAINED: 0.6
    }),
    equipmentDeploymentAdjustment: Object.freeze({
        FLEXIBLE: 0.1,
        STANDARD: 0,
        CONSTRAINED: -0.15
    }),
    bodyMobilityAdjustment: Object.freeze({
        ADVANTAGE: 0.05,
        NEUTRAL: 0,
        DISADVANTAGE: -0.1
    }),
    equipmentMobilityAdjustment: Object.freeze({
        ADVANTAGE: 0.05,
        NEUTRAL: 0,
        DISADVANTAGE: -0.1
    }),
    minimumDeploymentRatio: 0.25,
    maximumDeploymentRatio: 1
});

function policyValue(table, key, fallback = 0) {
    if (!table || !Object.prototype.hasOwnProperty.call(table, key)) return fallback;
    return Number(table[key]) || 0;
}

/**
 * Converts semantic terrain interaction into the share of a force that can be
 * committed at the interception point at once.
 *
 * This does NOT destroy or multiply StrategicSuppression. Any suppression that
 * cannot deploy remains reserveSuppression, preserving army scale while making
 * terrain/body/equipment matter through frontage and maneuver limits.
 */
export class EnemyForceDeploymentResolver {
    constructor({ policy = {} } = {}) {
        this.policy = {
            ...DEFAULT_ENEMY_FORCE_DEPLOYMENT_POLICY,
            ...policy,
            bodyDeploymentRatio: {
                ...DEFAULT_ENEMY_FORCE_DEPLOYMENT_POLICY.bodyDeploymentRatio,
                ...(policy.bodyDeploymentRatio || {})
            },
            equipmentDeploymentAdjustment: {
                ...DEFAULT_ENEMY_FORCE_DEPLOYMENT_POLICY.equipmentDeploymentAdjustment,
                ...(policy.equipmentDeploymentAdjustment || {})
            },
            bodyMobilityAdjustment: {
                ...DEFAULT_ENEMY_FORCE_DEPLOYMENT_POLICY.bodyMobilityAdjustment,
                ...(policy.bodyMobilityAdjustment || {})
            },
            equipmentMobilityAdjustment: {
                ...DEFAULT_ENEMY_FORCE_DEPLOYMENT_POLICY.equipmentMobilityAdjustment,
                ...(policy.equipmentMobilityAdjustment || {})
            }
        };
    }

    resolve({ forceSuppression = 0, interaction = null } = {}) {
        const total = nonNegative(forceSuppression);
        if (!(total > 0)) {
            return {
                totalSuppression: 0,
                deploymentRatio: 0,
                deployedSuppression: 0,
                reserveSuppression: 0,
                reasons: []
            };
        }

        const bodyDeployment = interaction?.deployment || "FULL";
        const equipmentDeployment = interaction?.equipmentDeployment || "STANDARD";
        const bodyMobility = interaction?.mobility || "NEUTRAL";
        const equipmentMobility = interaction?.equipmentMobility || "NEUTRAL";

        const baseRatio = policyValue(
            this.policy.bodyDeploymentRatio,
            bodyDeployment,
            1
        );
        const equipmentDeploymentDelta = policyValue(
            this.policy.equipmentDeploymentAdjustment,
            equipmentDeployment,
            0
        );
        const bodyMobilityDelta = policyValue(
            this.policy.bodyMobilityAdjustment,
            bodyMobility,
            0
        );
        const equipmentMobilityDelta = policyValue(
            this.policy.equipmentMobilityAdjustment,
            equipmentMobility,
            0
        );

        const deploymentRatio = clamp(
            baseRatio
                + equipmentDeploymentDelta
                + bodyMobilityDelta
                + equipmentMobilityDelta,
            Number(this.policy.minimumDeploymentRatio) || 0.25,
            Number(this.policy.maximumDeploymentRatio) || 1
        );

        const deployedSuppression = total * deploymentRatio;
        const reserveSuppression = total - deployedSuppression;
        const reasons = [];
        if (bodyDeployment !== "FULL") reasons.push(`BODY_DEPLOYMENT_${bodyDeployment}`);
        if (equipmentDeployment !== "STANDARD") reasons.push(`EQUIPMENT_DEPLOYMENT_${equipmentDeployment}`);
        if (bodyMobility !== "NEUTRAL") reasons.push(`BODY_MOBILITY_${bodyMobility}`);
        if (equipmentMobility !== "NEUTRAL") reasons.push(`EQUIPMENT_MOBILITY_${equipmentMobility}`);

        return {
            totalSuppression: total,
            deploymentRatio,
            deployedSuppression,
            reserveSuppression,
            reasons
        };
    }
}

export default EnemyForceDeploymentResolver;
