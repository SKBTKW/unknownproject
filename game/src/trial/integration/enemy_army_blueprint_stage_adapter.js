import { GAME_FACT_TYPES } from '../../core/game_fact.js';
import { ENEMY_BLUEPRINT_SUPPORTED_STAGE_IDS } from '../domain/enemy_army_blueprint.js';
import { EnemyArmyBlueprintLifecycleService } from '../systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint, validateEnemyArmyBlueprintGenerationPolicy } from '../systems/enemy_army_blueprint_generator.js';

/** Observe applied Stage facts only; never owns Stage progression or live Trial truth. */
export class EnemyArmyBlueprintStageAdapter {
    #gameState;
    #lifecycleService;
    #policies;
    #generator;
    #runSeedProvider;
    #isRestoring;
    #lastResult = null;
    #unsubscribe;

    constructor({ gameState, gameFactHub, lifecycleService = null, policiesByStage = {},
        generator = generateEnemyArmyBlueprint, runSeedProvider = () => gameState.runSeed,
        isRestoring = () => false } = {}) {
        if (!gameState || !gameFactHub?.subscribe || typeof generator !== 'function'
            || typeof runSeedProvider !== 'function' || typeof isRestoring !== 'function') {
            throw new TypeError('BLUEPRINT_STAGE_ADAPTER_DEPENDENCY_INVALID');
        }
        if (!policiesByStage || Object.getPrototypeOf(policiesByStage) !== Object.prototype) {
            throw new TypeError('BLUEPRINT_STAGE_POLICIES_INVALID');
        }
        for (const [key, policy] of Object.entries(policiesByStage)) {
            if (!/^[1-9][0-9]*$/.test(key) || !Number.isSafeInteger(Number(key))) throw new TypeError('BLUEPRINT_STAGE_POLICY_KEY_INVALID');
            validateEnemyArmyBlueprintGenerationPolicy(policy);
        }
        this.#gameState = gameState;
        this.#lifecycleService = lifecycleService || new EnemyArmyBlueprintLifecycleService({ gameState });
        this.#policies = structuredClone(policiesByStage);
        this.#generator = generator;
        this.#runSeedProvider = runSeedProvider;
        this.#isRestoring = isRestoring;
        this.#unsubscribe = gameFactHub.subscribe(fact => {
            if (fact?.type !== GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED) return;
            try { this.handleFact(fact); }
            catch (error) {
                // Report adapter failure explicitly without throwing through synchronous Stage listeners.
                this.#lastResult = { success: false, status: 'ERROR', message: error?.message || String(error) };
            }
        });
    }

    handleFact(fact) {
        if (fact?.type !== GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED) return { success: true, status: 'IGNORED' };
        const payload = fact.payload || {};
        const stageId = payload.toStageId;
        let status;
        if (this.#isRestoring()) status = 'RESTORE_IGNORED';
        else if (payload.appliedNow !== true) status = 'REPLAY_IGNORED';
        else if (!Number.isSafeInteger(stageId) || stageId < 1 || payload.result?.success !== true
            || payload.result.stageId !== stageId || this.#gameState.stage?.id !== stageId) status = 'NOT_APPLIED';
        else if (this.#lifecycleService.getBlueprint(stageId)) status = 'EXISTING_BLUEPRINT';
        else if (!Object.hasOwn(this.#policies, stageId)) status = 'POLICY_NOT_CONFIGURED';
        else if (!ENEMY_BLUEPRINT_SUPPORTED_STAGE_IDS.includes(stageId)) status = 'MODEL_STAGE_UNSUPPORTED';
        else {
            const blueprint = this.#generator({ runSeed: this.#runSeedProvider(), stageId, policy: this.#policies[stageId] });
            this.#lifecycleService.registerBlueprint(stageId, blueprint);
            status = 'REGISTERED';
        }
        this.#lastResult = { success: true, status, stageId: Number.isSafeInteger(stageId) ? stageId : null };
        return this.getLastResult();
    }

    getLastResult() { return structuredClone(this.#lastResult); }

    dispose() { this.#unsubscribe?.(); this.#unsubscribe = null; }
}
