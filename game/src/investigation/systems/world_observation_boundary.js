import { ConditionEvaluator } from '../../core/condition_evaluator.js';
import { createObservableWorldProfile, hasRecordedDiscovery } from '../domain/world_discovery.js';
import { INVESTIGATION_SOURCE_POLICIES } from '../../data/investigation_sources_data.js';

/** Inactive composition boundary. The owner supplies already-redacted observations
 * of existing world objects; this module neither generates nor reads world truth.
 * Eligibility uses the shared strict evaluator, never a second board predicate.
 */
export function collectWorldObservationCandidates({ profile, definitions = [], context = {} } = {}) {
    if (profile?.schemaVersion !== 1 || !Array.isArray(profile.observations)) {
        throw new TypeError('OBSERVABLE_WORLD_PROFILE_REQUIRED');
    }
    if (!Array.isArray(definitions)) throw new TypeError('OBSERVATION_DEFINITIONS_REQUIRED');
    const safe = createObservableWorldProfile(profile);
    const byId = new Map(safe.observations.map(entry => [entry.id, entry]));
    const ids = new Set();
    const candidates = [];
    for (const definition of definitions) {
        const { id, category, sourceType, discoveryIds, requirements, allowRediscovery } = definition || {};
        if ([id, category, sourceType].some(value => typeof value !== 'string' || !value.trim()) ||
            !Array.isArray(discoveryIds) || !discoveryIds.length ||
            discoveryIds.some(value => typeof value !== 'string' || !value.trim()) ||
            !Array.isArray(requirements) || requirements.some(value => !value || typeof value.type !== 'string' || !value.type.trim()) ||
            typeof allowRediscovery !== 'boolean') {
            throw new TypeError('OBSERVATION_DEFINITION_INVALID');
        }
        if (ids.has(id)) throw new TypeError('DUPLICATE_OBSERVATION_DEFINITION');
        ids.add(id);
        if (!ConditionEvaluator.evaluateAllStrict(requirements, context)) continue;
        const observations = [...new Set(discoveryIds)].map(key => byId.get(key));
        // Missing upstream observations cannot be invented from a definition.
        if (observations.some(entry => !entry || entry.category !== category)) continue;
        const eligible = observations.filter(entry => allowRediscovery ||
            !hasRecordedDiscovery(context.state?.discoveryLedger, entry.id));
        if (!eligible.length) continue;
        candidates.push(Object.freeze({ id, category, sourceType,
            profile: createObservableWorldProfile({ observations: eligible }) }));
    }
    return Object.freeze(candidates);
}

/** Footprints/camp remains/scout sightings remain observation sources. Reuse
 * existing facet policies; do not convert enemy fragments into world discoveries.
 * The future THREAT resolver still needs a redacted ObservableEnemyProfile.
 */
export function projectThreatObservationSources() {
    return Object.freeze(INVESTIGATION_SOURCE_POLICIES.map(policy => Object.freeze({
        category: 'THREAT', sourceType: policy.sourceType,
        allowedFacets: Object.freeze([...policy.allowedFacets])
    })));
}
