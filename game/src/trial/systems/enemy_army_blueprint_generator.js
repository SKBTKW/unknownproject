import { RandomSource } from '../../core/check_system/random_source.js';
import {
    EnemyArmyBlueprint, ENEMY_BLUEPRINT_SLOTS, ENEMY_BLUEPRINT_SCHEMA_VERSION, ENEMY_BLUEPRINT_SUPPORTED_STAGE_IDS,
    blueprintArmyId, requireKeys, validateForceComposition
} from '../domain/enemy_army_blueprint.js';

// FNV-1a over a versioned ASCII JSON tuple; independent from both live RNG streams.
function streamSeed(parts) {
    let hash = 0x811c9dc5;
    for (const character of JSON.stringify(parts)) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
    }
    return hash;
}

export function validateEnemyArmyBlueprintGenerationPolicy(policy) {
    requireKeys(policy, ['id', 'version', 'slots'], 'POLICY');
    if (typeof policy.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(policy.id)
        || !Number.isInteger(policy.version) || policy.version < 1) {
        throw new TypeError('ENEMY_BLUEPRINT_POLICY_IDENTITY_INVALID');
    }
    requireKeys(policy.slots, ENEMY_BLUEPRINT_SLOTS, 'POLICY_SLOTS');
    for (const slot of ENEMY_BLUEPRINT_SLOTS) {
        const candidates = policy.slots[slot];
        if (!Array.isArray(candidates) || candidates.length === 0) throw new TypeError('ENEMY_BLUEPRINT_CANDIDATES_INVALID');
        let total = 0;
        for (const candidate of candidates) {
            requireKeys(candidate, ['weight', 'composition'], 'CANDIDATE');
            if (!Number.isFinite(candidate.weight) || candidate.weight <= 0) throw new TypeError('ENEMY_BLUEPRINT_WEIGHT_INVALID');
            total += candidate.weight;
            validateForceComposition(candidate.composition);
        }
        if (!Number.isFinite(total)) throw new TypeError('ENEMY_BLUEPRINT_WEIGHT_TOTAL_INVALID');
    }
}

/** No default balance policy: callers must explicitly supply complete candidates. */
export function generateEnemyArmyBlueprint({ runSeed, stageId, policy } = {}) {
    if (!Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffffffff || !ENEMY_BLUEPRINT_SUPPORTED_STAGE_IDS.includes(stageId)) {
        throw new TypeError('ENEMY_BLUEPRINT_GENERATION_INPUT_INVALID');
    }
    validateEnemyArmyBlueprintGenerationPolicy(policy);
    const armyId = blueprintArmyId(runSeed, stageId);
    const forces = ENEMY_BLUEPRINT_SLOTS.map(slot => {
        const candidates = policy.slots[slot];
        const source = new RandomSource(streamSeed(['enemy-army-blueprint-v1', runSeed, stageId, policy.id, policy.version, slot]));
        const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
        const roll = source.nextFloat() * total;
        let cumulative = 0;
        const selected = candidates.find(candidate => {
            cumulative += candidate.weight;
            return roll < cumulative;
        }) || candidates[candidates.length - 1];
        return { id: `${armyId}_${slot}`, slot, composition: selected.composition };
    });
    return new EnemyArmyBlueprint({
        schemaVersion: ENEMY_BLUEPRINT_SCHEMA_VERSION, runSeed, stageId, armyId,
        generationPolicy: { id: policy.id, version: policy.version }, forces
    });
}
