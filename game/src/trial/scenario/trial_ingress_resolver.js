import { TrialTerrainEffectResolver } from "../systems/trial_terrain_effect_resolver.js";

function isPerimeter(size, r, c) {
    return r === 0 || c === 0 || r === size - 1 || c === size - 1;
}

function edgeOf(size, r, c) {
    const edges = [];
    if (r === 0) edges.push("NORTH");
    if (c === size - 1) edges.push("EAST");
    if (r === size - 1) edges.push("SOUTH");
    if (c === 0) edges.push("WEST");
    return edges;
}

/**
 * Trial正解データとしての侵入口候補を盤面外周から解決する。
 * Warning / Intel / 表示上の推定方向は参照しない。
 *
 * 侵入口数や選好ルールは未確定なので selector 注入に委譲する。
 */
export class TrialIngressResolver {
    constructor({
        terrainEffectResolver = new TrialTerrainEffectResolver(),
        selector = null
    } = {}) {
        this.terrainEffectResolver = terrainEffectResolver;
        this.selector = selector;
    }

    listCandidates({ gameState } = {}) {
        const grid = gameState?.grid;
        if (!Array.isArray(grid) || grid.length === 0) return [];
        const size = grid.length;
        const candidates = [];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (!isPerimeter(size, r, c)) continue;
                const cell = grid[r]?.[c];
                if (!cell) continue;
                if (!this.terrainEffectResolver.canEnterNormalRoute(cell)) continue;

                candidates.push({
                    id: `INGRESS_${r}_${c}`,
                    r,
                    c,
                    edges: edgeOf(size, r, c),
                    placed: cell.placed === true,
                    terrainId: cell?.terrain?.id || cell?.terrain?.terrainId || cell?.terrainId || null
                });
            }
        }

        return candidates;
    }

    resolve(context = {}) {
        const candidates = this.listCandidates(context);
        if (candidates.length === 0 || typeof this.selector !== "function") return [];

        const selected = this.selector({
            ...context,
            candidates: candidates.map(candidate => ({ ...candidate }))
        });
        if (!Array.isArray(selected)) return [];

        const legalById = new Map(candidates.map(candidate => [candidate.id, candidate]));
        const deduped = [];
        const used = new Set();

        for (const entry of selected) {
            const id = typeof entry === "string" ? entry : entry?.id;
            const candidate = legalById.get(id);
            if (!candidate || used.has(candidate.id)) continue;
            used.add(candidate.id);
            deduped.push({ ...candidate });
        }

        return deduped;
    }
}

export default TrialIngressResolver;
