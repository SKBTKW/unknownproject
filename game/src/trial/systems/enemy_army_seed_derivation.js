/**
 * FNV-1a over a versioned JSON tuple. Callers own the namespace and tuple shape.
 * The returned uint32 is used only to construct an independent RandomSource.
 */
export function deriveEnemyArmyStreamSeed(parts) {
    if (!Array.isArray(parts)) throw new TypeError('ENEMY_ARMY_SEED_PARTS_REQUIRED');
    let hash = 0x811c9dc5;
    for (const character of JSON.stringify(parts)) {
        hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
    }
    return hash;
}

export default deriveEnemyArmyStreamSeed;
