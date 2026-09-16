import {
    DEFAULT_TRIAL_RULES,
    MODIFIER_OPERATIONS,
    MODIFIER_PHASES,
    MODIFIER_TARGETS,
    TRIAL_TERRAIN_EFFECTS
} from "../domain/trial_types.js";

const MOUNTAIN_IDS = new Set(["E3_MOUNTAIN"]);
const WETLAND_IDS = new Set(["E0_WETLAND"]);
const DESERT_IDS = new Set(["GL0_DESERT"]);
const FOREST_IDS = new Set(["GL2_FOREST", "E2_FOREST_HILL"]);
const DEEP_FOREST_IDS = new Set(["GL3_DEEP_FOREST", "E2_DEEP_HILL", "E2_DEEP_FOREST_HILL"]);

function terrainId(cell) {
    return cell?.terrainId || cell?.terrain?.id || cell?.terrain?.terrainId || null;
}

function deploymentModifier(source, target, config) {
    return {
        source,
        target,
        operation: MODIFIER_OPERATIONS.LIMIT_OVERFLOW,
        phase: MODIFIER_PHASES.DEPLOYMENT_LIMIT,
        priority: 0,
        threshold: config.threshold,
        overflowEfficiency: config.overflowEfficiency
    };
}

function multiplierModifier(source, target, value, priority = 0) {
    return {
        source,
        target,
        operation: MODIFIER_OPERATIONS.MULTIPLY,
        phase: MODIFIER_PHASES.MULTIPLIER,
        priority,
        value
    };
}

export class TrialTerrainEffectResolver {
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_TRIAL_RULES,
            ...config,
            forestDeployment: { ...DEFAULT_TRIAL_RULES.forestDeployment, ...config.forestDeployment },
            deepForestDeployment: { ...DEFAULT_TRIAL_RULES.deepForestDeployment, ...config.deepForestDeployment }
        };
    }

    canInterceptAt(cell) {
        const id = terrainId(cell);
        return !!id && !WETLAND_IDS.has(id) && !MOUNTAIN_IDS.has(id);
    }

    canEnterNormalRoute(cell) {
        return !MOUNTAIN_IDS.has(terrainId(cell));
    }

    resolve(context) {
        const modifiers = [];
        const events = [];
        const interceptId = terrainId(context.interceptCell);
        const approachId = terrainId(context.approachCell);

        const deployment = DEEP_FOREST_IDS.has(interceptId)
            ? { id: TRIAL_TERRAIN_EFFECTS.DEEP_FOREST_DEPLOYMENT, config: this.config.deepForestDeployment }
            : FOREST_IDS.has(interceptId)
                ? { id: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT, config: this.config.forestDeployment }
                : null;

        if (deployment) {
            modifiers.push(deploymentModifier(deployment.id, MODIFIER_TARGETS.HUMAN_INTERCEPTION, deployment.config));
            modifiers.push(deploymentModifier(deployment.id, MODIFIER_TARGETS.ENEMY_SUPPRESSION, deployment.config));
            events.push({ type: "TERRAIN_EFFECT_APPLIED", effectId: deployment.id, sourceCell: context.interceptCell?.cellId || null });
        }

        if (WETLAND_IDS.has(approachId)) {
            modifiers.push(multiplierModifier(
                TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT,
                MODIFIER_TARGETS.ENEMY_SUPPRESSION,
                this.config.wetlandExitMultiplier,
                10
            ));
        } else if (DESERT_IDS.has(approachId)) {
            modifiers.push(multiplierModifier(
                TRIAL_TERRAIN_EFFECTS.DESERT_EXIT,
                MODIFIER_TARGETS.ENEMY_SUPPRESSION,
                this.config.desertExitMultiplier,
                10
            ));
        }

        const interceptElevation = context.interceptCell?.elevation;
        const approachElevation = context.approachCell?.elevation;
        const isE0E1Transition = (approachElevation === 0 && interceptElevation === 1)
            || (approachElevation === 1 && interceptElevation === 0);
        if (!isE0E1Transition && Number.isFinite(interceptElevation) && Number.isFinite(approachElevation) && interceptElevation !== approachElevation) {
            const target = interceptElevation > approachElevation
                ? MODIFIER_TARGETS.HUMAN_INTERCEPTION
                : MODIFIER_TARGETS.ENEMY_SUPPRESSION;
            modifiers.push({
                ...multiplierModifier(
                    TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
                    target,
                    this.config.highGroundMultiplier,
                    20
                ),
                interceptElevation,
                approachElevation
            });
        }

        for (const modifier of modifiers.filter(item => item.source !== deployment?.id)) {
            events.push({
                type: "TERRAIN_EFFECT_APPLIED",
                effectId: modifier.source,
                sourceCell: context.approachCell?.cellId || null,
                targetCell: context.interceptCell?.cellId || null,
                value: modifier.value
            });
        }

        return {
            canIntercept: this.canInterceptAt(context.interceptCell),
            canEnterApproachRoute: this.canEnterNormalRoute(context.approachCell),
            modifiers,
            events
        };
    }
}
