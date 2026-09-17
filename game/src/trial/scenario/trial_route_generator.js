import { TrialTerrainEffectResolver } from "../systems/trial_terrain_effect_resolver.js";

function key(r, c) {
    return `${r}:${c}`;
}

function neighbors4(grid, r, c) {
    const candidates = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1]
    ];
    return candidates.filter(([nr, nc]) => grid?.[nr]?.[nc]);
}

function findHq(grid) {
    if (!Array.isArray(grid)) return null;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < (grid[r]?.length || 0); c++) {
            if (grid[r][c]?.isHQ) return { r, c };
        }
    }
    return null;
}

/**
 * Trial正解データとして、各侵入口からHQまでの最小進軍コスト経路を生成する。
 *
 * 経路探索アルゴリズムだけを担当し、地形コスト値・街道効果・敵特性は costResolver に委譲する。
 * ingress配列とarmyStructure.forcesは同じ順序で1:1対応し、部隊ごとの体格・装備・適性を
 * costResolverへ渡す。Warning / Intel は参照しない。
 */
export class TrialRouteGenerator {
    constructor({
        terrainEffectResolver = new TrialTerrainEffectResolver(),
        costResolver = null
    } = {}) {
        this.terrainEffectResolver = terrainEffectResolver;
        this.costResolver = costResolver;
    }

    generate({ gameState, ingresses = [], trialIndex = null, threat = null, armyStructure = null } = {}) {
        const grid = gameState?.grid;
        if (!Array.isArray(grid) || grid.length === 0) return [];
        if (typeof this.costResolver !== "function") return [];

        const hq = findHq(grid);
        if (!hq) return [];
        const forces = Array.isArray(armyStructure?.forces) ? armyStructure.forces : [];
        if (forces.length > 0 && forces.length !== ingresses.length) return [];

        return ingresses
            .map((ingress, index) => this.#buildRoute({
                gameState,
                grid,
                ingress,
                hq,
                trialIndex,
                threat,
                force: forces[index] || null
            }))
            .filter(Boolean);
    }

    #buildRoute({ gameState, grid, ingress, hq, trialIndex, threat, force }) {
        if (!Number.isInteger(ingress?.r) || !Number.isInteger(ingress?.c)) return null;
        if (!grid?.[ingress.r]?.[ingress.c]) return null;

        const startKey = key(ingress.r, ingress.c);
        const targetKey = key(hq.r, hq.c);
        const dist = new Map([[startKey, 0]]);
        const previous = new Map();
        const open = new Set([startKey]);

        while (open.size > 0) {
            let currentKey = null;
            let currentCost = Infinity;
            for (const candidateKey of open) {
                const candidateCost = dist.get(candidateKey) ?? Infinity;
                if (candidateCost < currentCost || (candidateCost === currentCost && candidateKey < currentKey)) {
                    currentKey = candidateKey;
                    currentCost = candidateCost;
                }
            }

            if (currentKey === null) break;
            open.delete(currentKey);
            if (currentKey === targetKey) break;

            const [r, c] = currentKey.split(":").map(Number);
            for (const [nr, nc] of neighbors4(grid, r, c)) {
                const nextCell = grid[nr][nc];
                const isTarget = nr === hq.r && nc === hq.c;
                if (!isTarget && !this.terrainEffectResolver.canEnterNormalRoute(nextCell)) continue;

                const stepCost = Number(this.costResolver({
                    gameState,
                    fromCell: grid[r][c],
                    toCell: nextCell,
                    from: { r, c },
                    to: { r: nr, c: nc },
                    ingress,
                    trialIndex,
                    threat,
                    force
                }));
                if (!Number.isFinite(stepCost) || stepCost < 0) continue;

                const nextKey = key(nr, nc);
                const nextCost = currentCost + stepCost;
                const known = dist.get(nextKey);
                if (known === undefined || nextCost < known) {
                    dist.set(nextKey, nextCost);
                    previous.set(nextKey, currentKey);
                    open.add(nextKey);
                }
            }
        }

        if (!dist.has(targetKey)) return null;

        const reversed = [];
        let cursor = targetKey;
        while (cursor) {
            const [r, c] = cursor.split(":").map(Number);
            reversed.push({ r, c });
            if (cursor === startKey) break;
            cursor = previous.get(cursor);
            if (!cursor) return null;
        }

        const cells = reversed.reverse();
        return {
            id: `ROUTE_${ingress.id || `${ingress.r}_${ingress.c}`}`,
            ingressId: ingress.id || null,
            ingress: { r: ingress.r, c: ingress.c, edges: Array.isArray(ingress.edges) ? [...ingress.edges] : [] },
            forceId: force?.id || null,
            cells,
            movementCost: dist.get(targetKey)
        };
    }
}

export default TrialRouteGenerator;
