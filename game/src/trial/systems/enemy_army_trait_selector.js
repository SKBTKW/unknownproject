import { RandomSource } from '../../core/check_system/random_source.js';
import { validateEnemyArmyBlueprintGenerationPolicy } from './enemy_army_blueprint_generator.js';
import { deriveEnemyArmyStreamSeed } from './enemy_army_seed_derivation.js';

export const ENEMY_ARMY_TRAIT_SELECTOR_DERIVATION = 'fnv1a-mulberry32-v1';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function requireKeys(value, expected, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`ENEMY_ARMY_TRAIT_${label}_REQUIRED`);
    }
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
        throw new TypeError(`ENEMY_ARMY_TRAIT_${label}_SHAPE_INVALID`);
    }
}
function validateIdentity(identity, label) {
    requireKeys(identity, ['id', 'version'], label);
    if (typeof identity.id !== 'string' || !ID_PATTERN.test(identity.id)
        || !Number.isInteger(identity.version) || identity.version < 1) {
        throw new TypeError(`ENEMY_ARMY_TRAIT_${label}_IDENTITY_INVALID`);
    }
}

function clone(value) {
    return structuredClone(value);
}

function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freezeDeep(child);
    return Object.freeze(value);
}

export function validateEnemyArmyTraitSelectionPolicy(policy) {
    requireKeys(policy, ['id', 'version', 'seedNamespace', 'traits'], 'SELECTION_POLICY');
    validateIdentity({ id: policy.id, version: policy.version }, 'SELECTION_POLICY');
    if (typeof policy.seedNamespace !== 'string' || !ID_PATTERN.test(policy.seedNamespace)) {
        throw new TypeError('ENEMY_ARMY_TRAIT_SEED_NAMESPACE_INVALID');
    }
    if (!Array.isArray(policy.traits) || policy.traits.length === 0) {
        throw new TypeError('ENEMY_ARMY_TRAIT_CANDIDATES_INVALID');
    }
    const traitIds = new Set();
    let totalWeight = 0;
    for (const trait of policy.traits) {
        requireKeys(trait, ['traitId', 'weight', 'generationPolicy'], 'CANDIDATE');
        if (typeof trait.traitId !== 'string' || !ID_PATTERN.test(trait.traitId) || traitIds.has(trait.traitId)) {
            throw new TypeError('ENEMY_ARMY_TRAIT_ID_INVALID');
        }
        traitIds.add(trait.traitId);
        if (!Number.isFinite(trait.weight) || trait.weight <= 0) {
            throw new TypeError('ENEMY_ARMY_TRAIT_WEIGHT_INVALID');
        }
        totalWeight += trait.weight;
        validateIdentity(trait.generationPolicy, 'GENERATION_POLICY');
    }
    if (!Number.isFinite(totalWeight)) throw new TypeError('ENEMY_ARMY_TRAIT_WEIGHT_TOTAL_INVALID');
}

export function selectEnemyArmyTrait({ runSeed, stageId, policy } = {}) {
    if (!Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffffffff
        || !Number.isSafeInteger(stageId) || stageId < 1) {
        throw new TypeError('ENEMY_ARMY_TRAIT_SELECTION_INPUT_INVALID');
    }
    validateEnemyArmyTraitSelectionPolicy(policy);
    const seed = deriveEnemyArmyStreamSeed([
        policy.seedNamespace, runSeed, stageId, policy.id, policy.version
    ]);
    const source = new RandomSource(seed);
    const totalWeight = policy.traits.reduce((sum, candidate) => sum + candidate.weight, 0);
    const roll = source.nextFloat() * totalWeight;
    let cursor = 0;
    const selected = policy.traits.find(candidate => {
        cursor += candidate.weight;
        return roll < cursor;
    }) || policy.traits[policy.traits.length - 1];
    return freezeDeep({
        runSeed,
        stageId,
        traitId: selected.traitId,
        selectionPolicy: { id: policy.id, version: policy.version },
        generationPolicy: clone(selected.generationPolicy),
        reproducibility: {
            derivation: ENEMY_ARMY_TRAIT_SELECTOR_DERIVATION,
            namespace: policy.seedNamespace,
            seed
        }
    });
}

function validateSelection(selection) {
    requireKeys(selection, [
        'runSeed', 'stageId', 'traitId', 'selectionPolicy', 'generationPolicy', 'reproducibility'
    ], 'SELECTION_RESULT');
    if (!Number.isInteger(selection.runSeed) || selection.runSeed < 0 || selection.runSeed > 0xffffffff
        || !Number.isSafeInteger(selection.stageId) || selection.stageId < 1
        || typeof selection.traitId !== 'string' || !ID_PATTERN.test(selection.traitId)) {
        throw new TypeError('ENEMY_ARMY_TRAIT_SELECTION_RESULT_INVALID');
    }
    validateIdentity(selection.selectionPolicy, 'SELECTION_POLICY');
    validateIdentity(selection.generationPolicy, 'GENERATION_POLICY');
    requireKeys(selection.reproducibility, ['derivation', 'namespace', 'seed'], 'REPRODUCIBILITY');
    if (selection.reproducibility.derivation !== ENEMY_ARMY_TRAIT_SELECTOR_DERIVATION
        || typeof selection.reproducibility.namespace !== 'string'
        || !ID_PATTERN.test(selection.reproducibility.namespace)
        || !Number.isInteger(selection.reproducibility.seed)
        || selection.reproducibility.seed < 0 || selection.reproducibility.seed > 0xffffffff) {
        throw new TypeError('ENEMY_ARMY_TRAIT_REPRODUCIBILITY_INVALID');
    }
}

export function resolveEnemyArmyTraitGenerationPolicy({ selection, bindings } = {}) {
    validateSelection(selection);
    if (!Array.isArray(bindings) || bindings.length === 0) {
        throw new TypeError('ENEMY_ARMY_TRAIT_POLICY_BINDINGS_INVALID');
    }
    const traitIds = new Set();
    for (const binding of bindings) {
        requireKeys(binding, ['traitId', 'generationPolicy'], 'POLICY_BINDING');
        if (typeof binding.traitId !== 'string' || !ID_PATTERN.test(binding.traitId) || traitIds.has(binding.traitId)) {
            throw new TypeError('ENEMY_ARMY_TRAIT_POLICY_BINDING_ID_INVALID');
        }
        traitIds.add(binding.traitId);
        validateEnemyArmyBlueprintGenerationPolicy(binding.generationPolicy);
    }
    const binding = bindings.find(candidate => candidate.traitId === selection.traitId);
    if (!binding) throw new TypeError('ENEMY_ARMY_TRAIT_UNKNOWN');
    if (binding.generationPolicy.id !== selection.generationPolicy.id
        || binding.generationPolicy.version !== selection.generationPolicy.version) {
        throw new TypeError('ENEMY_ARMY_TRAIT_GENERATION_POLICY_IDENTITY_MISMATCH');
    }
    return freezeDeep(clone(binding.generationPolicy));
}
