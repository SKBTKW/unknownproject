/* =============================================================
   game/src/core/zone_conversion_definitions.js

   Canonical Board-owned registry for Zone Conversion definitions.

   Intentionally empty until concrete gameplay definitions are approved.
   Card Core may reference a definitionId, but it must never own or invent the
   Board semantics behind that definition.
   ============================================================= */

const ZONE_CONVERSION_DEFINITIONS = Object.freeze({});

function hasZoneConversionDefinition(definitionId, definitions = ZONE_CONVERSION_DEFINITIONS) {
    if (!definitionId) return false;
    if (definitions instanceof Map) return definitions.has(String(definitionId));
    return Object.prototype.hasOwnProperty.call(definitions || {}, String(definitionId));
}

function listZoneConversionDefinitionIds(definitions = ZONE_CONVERSION_DEFINITIONS) {
    const ids = definitions instanceof Map
        ? [...definitions.keys()]
        : Object.keys(definitions || {});
    return Object.freeze(ids.map(String).sort());
}

export {
    ZONE_CONVERSION_DEFINITIONS,
    hasZoneConversionDefinition,
    listZoneConversionDefinitionIds
};

export default ZONE_CONVERSION_DEFINITIONS;
