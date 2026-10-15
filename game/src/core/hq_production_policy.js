import { BASELINE_ECONOMY } from './baseline_economy.js';

/** HQ base production is rules-owned, never sourced from cached terrain yields. */
export function resolveHQBaseYields() {
    return BASELINE_ECONOMY.hqYields;
}

/** Preserve HQ identity/other metadata, but replace stale saved production. */
export function normalizeHQTerrain(terrain) {
    const { material: _legacyMaterial, ...rest } = terrain && typeof terrain === 'object' ? terrain : {};
    return { ...rest, id: 'HQ', nameKey: 'TERRAIN_HQ', ...resolveHQBaseYields() };
}
