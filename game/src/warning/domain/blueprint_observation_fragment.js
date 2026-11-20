/**
 * Read-only, opt-in Stage1 Blueprint observation gate.
 *
 * Blueprint v1 contains force-level species/equipment compositions ONLY.
 * It contains NO activity, actor relationships, cargo, witness evidence or
 * location. This gate refuses to project such claims, rather than inventing
 * them from the mere presence of a species in a force composition.
 *
 * Caller must supply an independently established direct observation.
 * No inferred species from footprints, no source force ID in the public result.
 */
const BLUEPRINT_SPECIES = Object.freeze(['LARGE', 'MEDIUM', 'SMALL']);
const PUBLIC_KIND = 'SPECIES_WITNESSED';

function snapshotOf(blueprint) {
    return typeof blueprint?.getSnapshot === 'function'
        ? blueprint.getSnapshot()
        : blueprint;
}

/** Pure projection; returns null unless every material claim is supported. */
export function projectBlueprintObservationFragment({ blueprint, observation } = {}) {
    const snapshot = snapshotOf(blueprint);
    if (snapshot?.schemaVersion !== 1 || snapshot?.stageId !== 1
        || !Array.isArray(snapshot.forces) || !observation
        || Object.getPrototypeOf(observation) !== Object.prototype) return null;

    // This schema supports direct eyewitness species presence, not activities.
    if (Object.keys(observation).length !== 4
        || observation.kind !== PUBLIC_KIND
        || observation.evidence !== 'DIRECT_SIGHTING'
        || typeof observation.sourceForceId !== 'string'
        || !BLUEPRINT_SPECIES.includes(observation.species)) return null;

    const sourceForce = snapshot.forces.find(force => force?.id === observation.sourceForceId);
    if (!sourceForce?.composition?.speciesComposition?.some(
        item => item?.type === observation.species && Number.isFinite(item.share) && item.share > 0
    )) return null;

    // No location or sourceForceId leakage in public observations. The
    // snapshot remains the source of truth; no mutation or RNG draw occurs.
    return Object.freeze({
        kind: PUBLIC_KIND,
        tokens: Object.freeze([
            Object.freeze({ role: 'SUBJECT', valueKey: `INVESTIGATION_SPECIES_${observation.species}` })
        ]),
        certainty: 'DIRECT_OBSERVATION'
    });
}

export default projectBlueprintObservationFragment;
