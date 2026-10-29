import { EnemyArmyBlueprintLifecycleService } from '../systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../systems/enemy_army_blueprint_generator.js';

// Construction-session guard only; army truth stays in the GameState-owned ledger.
// Hydration keeps GameState identity, so an old save cannot rearm new-Run generation.
const sessions = new WeakMap();

export function bootstrapEnemyArmyBlueprintNewRun({
    gameState, runSeed, isNewRun = false, policy = null,
    generator = generateEnemyArmyBlueprint
} = {}) {
    if (!gameState || typeof gameState !== 'object' || Array.isArray(gameState)
        || typeof isNewRun !== 'boolean') throw new TypeError('BLUEPRINT_BOOTSTRAP_INPUT_INVALID');
    const previous = sessions.get(gameState);
    if (previous) {
        // Always validate current restored truth; never repair corrupt data by regeneration.
        previous.lifecycleService.getSnapshot();
        if (previous.error) throw previous.error;
        return Object.freeze({ status: 'ALREADY_INITIALIZED', lifecycleService: previous.lifecycleService });
    }
    const lifecycleService = new EnemyArmyBlueprintLifecycleService({ gameState });
    const session = { lifecycleService, error: null };
    sessions.set(gameState, session);
    try {
        let status;
        if (!isNewRun) status = 'RESTORE_ONLY';
        else if (gameState.stage?.id !== 1) status = 'STAGE_NOT_SUPPORTED';
        else if (lifecycleService.getBlueprint(1)) status = 'EXISTING_BLUEPRINT';
        else if (policy === null || policy === undefined) status = 'POLICY_NOT_CONFIGURED';
        else {
            if (typeof generator !== 'function') throw new TypeError('BLUEPRINT_BOOTSTRAP_GENERATOR_INVALID');
            const blueprint = generator({ runSeed, stageId: 1, policy });
            lifecycleService.registerBlueprint(1, blueprint);
            status = 'GENERATED';
        }
        return Object.freeze({ status, lifecycleService });
    } catch (error) {
        session.error = error;
        throw error;
    }
}
