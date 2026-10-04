/** Resolved cell sockets are public discoveries; cached seeds/hasSocket are not.
 * Placement reveals a socket before land exploration, so searched is not a gate.
 */
export function readDiscoveredSocketResource(cell, categories = null) {
    const resource = cell?.socketResource;
    if (!cell?.placed || !cell.terrain || !resource?.category
        || !(resource.id || resource.nameKey)) return null;
    if (Array.isArray(categories) && !categories.includes(resource.category)) return null;
    return resource;
}

export function readSocketResourceIdentity(resource) {
    return resource?.id || resource?.nameKey || null;
}

export function readSocketResourceYields(resource) {
    const raw = resource?.bonusYields || {};
    return {
        food: resource?.bonusFood ?? raw.food ?? 0,
        wood: resource?.bonusMaterial ?? resource?.bonusWood ?? raw.material ?? raw.wood ?? 0,
        defense: resource?.bonusDefense ?? raw.defense ?? 0,
        mystic: resource?.bonusMystic ?? raw.mystic ?? 0
    };
}
