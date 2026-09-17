function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function positiveInt(value, fallback = 1) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function cloneData(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * PROTOTYPE balance values for the adopted enemy-army structure contract.
 *
 * The semantics are canonical:
 * - suppression controls force count and top commander level
 * - force count equals invasion-route count
 * - the main commander force owns the largest suppression share
 * - higher command levels unlock subordinate command and judgement capabilities
 *
 * The numeric thresholds remain balance-tunable from this single policy object.
 */
export const DEFAULT_ENEMY_ARMY_STRUCTURE_POLICY = Object.freeze({
    commanderLevelThresholds: Object.freeze([1, 30, 60, 100, 150]),
    suppressionPerForce: 35,
    maxForces: 5,
    mainForceWeight: 2,
    subordinateCommanderMinLevel: 3,
    ingressJudgementMinLevel: 2,
    adaptiveCompositionMinLevel: 5
});

function resolveCommanderLevel(suppression, thresholds) {
    if (!(suppression > 0)) return 0;
    let level = 1;
    for (let index = 0; index < thresholds.length; index += 1) {
        if (suppression >= nonNegative(thresholds[index])) level = index + 1;
    }
    return Math.max(1, level);
}

function resolveForceCount(suppression, suppressionPerForce, maxForces) {
    if (!(suppression > 0)) return 0;
    return clamp(Math.ceil(suppression / suppressionPerForce), 1, maxForces);
}

function allocateSuppression(total, forceCount, mainForceWeight) {
    if (forceCount <= 0) return [];
    if (forceCount === 1) return [total];

    const mainWeight = Math.max(1.000001, Number(mainForceWeight) || 2);
    const totalWeight = mainWeight + (forceCount - 1);
    const main = total * (mainWeight / totalWeight);
    const subordinate = total * (1 / totalWeight);
    return [main, ...Array.from({ length: forceCount - 1 }, () => subordinate)];
}

function defaultForceQuality({ effectiveCommanderLevel, adaptiveComposition }) {
    return {
        commandQualityLevel: effectiveCommanderLevel,
        equipmentQualityLevel: effectiveCommanderLevel,
        bodyCompositionQualityLevel: effectiveCommanderLevel,
        adaptiveComposition: Boolean(adaptiveComposition)
    };
}

/**
 * strategicSuppression を「軍の規模と指揮構造」へ投影する純粋resolver。
 *
 * Warning / KnownEnemyState / presentation は参照しない。
 * 盤面対応の高度な編成最適化は capability と resolver hook だけを公開し、
 * この層では具体的な盤面攻略AIを固定しない。
 */
export class EnemyArmyStructureResolver {
    constructor({
        policy = {},
        forceQualityResolver = null,
        subordinateCommanderResolver = null
    } = {}) {
        this.policy = {
            ...DEFAULT_ENEMY_ARMY_STRUCTURE_POLICY,
            ...policy,
            commanderLevelThresholds: Array.isArray(policy.commanderLevelThresholds)
                ? [...policy.commanderLevelThresholds]
                : [...DEFAULT_ENEMY_ARMY_STRUCTURE_POLICY.commanderLevelThresholds]
        };
        this.forceQualityResolver = forceQualityResolver;
        this.subordinateCommanderResolver = subordinateCommanderResolver;
    }

    resolve({ strategicSuppression = 0, trialIndex = 1, enemyTruth = null, gameState = null } = {}) {
        const suppression = nonNegative(strategicSuppression);
        const commanderLevel = resolveCommanderLevel(
            suppression,
            this.policy.commanderLevelThresholds
        );
        const forceCount = resolveForceCount(
            suppression,
            positiveInt(this.policy.suppressionPerForce, 35),
            positiveInt(this.policy.maxForces, 5)
        );

        if (forceCount === 0) {
            return {
                strategicSuppression: suppression,
                forceCount: 0,
                routeCount: 0,
                commander: null,
                forces: [],
                policySnapshot: {
                    mainForceWeight: this.policy.mainForceWeight,
                    suppressionPerForce: this.policy.suppressionPerForce,
                    maxForces: this.policy.maxForces
                }
            };
        }

        const allocations = allocateSuppression(
            suppression,
            forceCount,
            this.policy.mainForceWeight
        );
        const canDelegate = commanderLevel >= positiveInt(this.policy.subordinateCommanderMinLevel, 3);
        const canJudgeIngress = commanderLevel >= positiveInt(this.policy.ingressJudgementMinLevel, 2);
        const canAdaptComposition = commanderLevel >= positiveInt(this.policy.adaptiveCompositionMinLevel, 5);
        const normalizedTrialIndex = Math.max(1, Math.floor(Number(trialIndex) || 1));

        const commander = {
            id: `COMMANDER_TRIAL_${normalizedTrialIndex}`,
            level: commanderLevel,
            mainForceId: "FORCE_1",
            capabilities: {
                subordinateCommanders: canDelegate,
                ingressJudgement: canJudgeIngress,
                adaptiveComposition: canAdaptComposition
            }
        };

        const forces = allocations.map((forceSuppression, index) => {
            const isMainForce = index === 0;
            const subordinateCommander = !isMainForce && canDelegate
                ? (this.subordinateCommanderResolver?.({
                    parentCommander: cloneData(commander),
                    forceIndex: index,
                    forceSuppression,
                    strategicSuppression: suppression,
                    trialIndex: normalizedTrialIndex,
                    enemyTruth: cloneData(enemyTruth),
                    gameState
                }) ?? {
                    id: `SUB_COMMANDER_${normalizedTrialIndex}_${index}`,
                    level: Math.max(1, commanderLevel - 1)
                })
                : null;
            const effectiveCommanderLevel = isMainForce
                ? commanderLevel
                : (subordinateCommander?.level ?? commanderLevel);

            const qualityContext = {
                commanderLevel,
                effectiveCommanderLevel,
                adaptiveComposition: canAdaptComposition,
                isMainForce,
                forceIndex: index,
                forceSuppression,
                strategicSuppression: suppression,
                trialIndex: normalizedTrialIndex,
                enemyTruth: cloneData(enemyTruth),
                gameState
            };
            const quality = this.forceQualityResolver?.(qualityContext)
                ?? defaultForceQuality(qualityContext);

            return {
                id: `FORCE_${index + 1}`,
                role: isMainForce ? "MAIN" : "DETACHMENT",
                strategicSuppression: forceSuppression,
                commander: isMainForce ? cloneData(commander) : cloneData(subordinateCommander),
                quality: cloneData(quality)
            };
        });

        return {
            strategicSuppression: suppression,
            forceCount,
            routeCount: forceCount,
            commander,
            forces,
            policySnapshot: {
                mainForceWeight: this.policy.mainForceWeight,
                suppressionPerForce: this.policy.suppressionPerForce,
                maxForces: this.policy.maxForces
            }
        };
    }
}

export default EnemyArmyStructureResolver;
