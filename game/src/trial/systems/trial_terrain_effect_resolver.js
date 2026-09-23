import { readSpecialBlockTrialTraits } from "../../core/special_block_domain.js";
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

function resolveApproachDirection(interceptCell, approachCell) {
    const ir = Number.isInteger(interceptCell?.row) ? interceptCell.row : interceptCell?.r;
    const ic = Number.isInteger(interceptCell?.column) ? interceptCell.column : interceptCell?.c;
    const ar = Number.isInteger(approachCell?.row) ? approachCell.row : approachCell?.r;
    const ac = Number.isInteger(approachCell?.column) ? approachCell.column : approachCell?.c;
    if (![ir, ic, ar, ac].every(Number.isInteger)) return null;
    const dr = ar - ir;
    const dc = ac - ic;
    if (dr === -1 && dc === 0) return 'N';
    if (dr === 1 && dc === 0) return 'S';
    if (dr === 0 && dc === 1) return 'E';
    if (dr === 0 && dc === -1) return 'W';
    return null;
}

function resolveSpecialTactics(context, traits, config) {
    const tactics = [];
    const declared = new Set(traits?.specialTactics || []);
    if (declared.has('PALISADE_DIRECTIONAL_DEFENSE')) {
        const orientation = context.interceptCell?.specialBlock?.orientation || null;
        const approachDirection = resolveApproachDirection(
            context.interceptCell,
            context.approachCell
        );
        const active = Boolean(
            orientation
            && approachDirection
            && orientation === approachDirection
        );
        tactics.push({
            id: 'PALISADE_DIRECTIONAL_DEFENSE',
            active,
            orientation,
            approachDirection,
            defenseMultiplier: active && Number.isFinite(config.palisadeDirectionalMultiplier)
                ? config.palisadeDirectionalMultiplier
                : null
        });
    }
    return tactics;
}

export class TrialTerrainEffectResolver {
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_TRIAL_RULES,
            ...config,
            palisadeDirectionalMultiplier: Number.isFinite(config.palisadeDirectionalMultiplier)
                ? config.palisadeDirectionalMultiplier
                : null,
            forestDeployment: { ...DEFAULT_TRIAL_RULES.forestDeployment, ...config.forestDeployment },
            deepForestDeployment: { ...DEFAULT_TRIAL_RULES.deepForestDeployment, ...config.deepForestDeployment }
        };
    }

    canInterceptAt(cell) {
        const specialTraits = readSpecialBlockTrialTraits(cell);
        if (typeof specialTraits?.interceptionAllowed === "boolean") {
            return specialTraits.interceptionAllowed;
        }
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
        const specialBlockTraits = readSpecialBlockTrialTraits(context.interceptCell);
        const specialTactics = resolveSpecialTactics(context, specialBlockTraits, this.config);
        const suppressTerrainTactic = specialBlockTraits?.suppressTerrainTactic === true;

        const deployment = suppressTerrainTactic
            ? null
            : DEEP_FOREST_IDS.has(interceptId)
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
        if (!suppressTerrainTactic && !isE0E1Transition && Number.isFinite(interceptElevation) && Number.isFinite(approachElevation) && interceptElevation !== approachElevation) {
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

        const palisadeTactic = specialTactics.find(
            tactic => tactic.id === 'PALISADE_DIRECTIONAL_DEFENSE'
        );
        if (palisadeTactic?.active && Number.isFinite(palisadeTactic.defenseMultiplier)) {
            modifiers.push(multiplierModifier(
                'PALISADE_DIRECTIONAL_DEFENSE',
                MODIFIER_TARGETS.HUMAN_INTERCEPTION,
                palisadeTactic.defenseMultiplier,
                30
            ));
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
            specialBlockTraits,
            specialTactics,
            modifiers,
            events
        };
    }
}
