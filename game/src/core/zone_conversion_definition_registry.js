/* =============================================================
   game/src/core/zone_conversion_definition_registry.js

   Board-owned authority for Zone Conversion definition identity and snapshots.

   Concrete gameplay definitions may live in data/content modules, but runtime
   consumers must enter the Board domain through this registry. Card/Offering
   code is a definitionId consumer only.
   ============================================================= */

function freezeStringArray(values) {
    return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

function freezeResourceMap(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? Object.freeze({ ...value })
        : null;
}

function freezeDefinition(definition) {
    const requirements = definition?.requirements || {};
    return Object.freeze({
        ...definition,
        eligibleZoneAttributes: freezeStringArray(definition?.eligibleZoneAttributes),
        requirements: Object.freeze({
            ...requirements,
            resources: freezeResourceMap(requirements.resources)
        }),
        creationCost: definition?.creationCost
            ? Object.freeze({
                ...definition.creationCost,
                base: freezeResourceMap(definition.creationCost.base),
                escalation: definition.creationCost.escalation
                    ? Object.freeze({
                        ...definition.creationCost.escalation,
                        perConversion: freezeResourceMap(
                            definition.creationCost.escalation.perConversion
                        )
                    })
                    : null
            })
            : null,
        maintenance: definition?.maintenance
            ? Object.freeze({
                ...definition.maintenance,
                resources: freezeResourceMap(definition.maintenance.resources)
            })
            : null,
        creationReward: definition?.creationReward
            ? Object.freeze({
                ...definition.creationReward,
                resources: freezeResourceMap(definition.creationReward.resources)
            })
            : null,
        production: definition?.production
            ? Object.freeze({
                ...definition.production,
                perMemberYields: freezeResourceMap(definition.production.perMemberYields)
            })
            : null,
        capabilities: freezeStringArray(definition?.capabilities)
    });
}

function definitionEntries(definitions) {
    if (definitions instanceof Map) return [...definitions.entries()];
    if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) return [];
    return Object.entries(definitions);
}

export class ZoneConversionDefinitionRegistry {
    constructor(definitions = {}) {
        this._definitions = new Map();

        for (const [rawKey, definition] of definitionEntries(definitions)) {
            if (!rawKey || !definition || typeof definition !== 'object' || Array.isArray(definition)) {
                continue;
            }

            const key = String(rawKey);
            const declaredId = definition.id === undefined || definition.id === null
                ? key
                : String(definition.id);

            // A registry key and an explicit definition id are the same identity.
            // Mismatches fail closed instead of creating aliases that can make
            // persisted definitionId values resolve differently after restore.
            if (!declaredId || declaredId !== key) continue;

            this._definitions.set(
                key,
                freezeDefinition({ ...definition, id: key })
            );
        }
    }

    get(definitionId) {
        if (definitionId === null || definitionId === undefined) return null;
        return this._definitions.get(String(definitionId)) || null;
    }

    has(definitionId) {
        return this.get(definitionId) !== null;
    }

    listIds() {
        return Object.freeze([...this._definitions.keys()].sort());
    }

    get size() {
        return this._definitions.size;
    }
}

export function createZoneConversionDefinitionRegistry(definitions = {}) {
    return new ZoneConversionDefinitionRegistry(definitions);
}

export default ZoneConversionDefinitionRegistry;
