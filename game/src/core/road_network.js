const CARDINAL_DIRECTIONS = Object.freeze([
    Object.freeze({ direction: 'NORTH', dr: -1, dc: 0 }),
    Object.freeze({ direction: 'EAST', dr: 0, dc: 1 }),
    Object.freeze({ direction: 'SOUTH', dr: 1, dc: 0 }),
    Object.freeze({ direction: 'WEST', dr: 0, dc: -1 })
]);

function normalizeCell(cell) {
    if (!cell) return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.row;
    const c = Number.isInteger(cell.c) ? cell.c : cell.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function compareCells(a, b) {
    return (a.r - b.r) || (a.c - b.c);
}

function isCardinalNeighbor(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function createRoadEdgeId(from, to) {
    const a = normalizeCell(from);
    const b = normalizeCell(to);
    if (!a || !b || !isCardinalNeighbor(a, b)) return null;
    const [first, second] = compareCells(a, b) <= 0 ? [a, b] : [b, a];
    return `${first.r}:${first.c}::${second.r}:${second.c}`;
}

export function parseRoadEdgeId(edgeId) {
    if (typeof edgeId !== 'string') return null;
    const [left, right, ...rest] = edgeId.split('::');
    if (!left || !right || rest.length > 0) return null;

    const parse = value => {
        const [r, c, ...extra] = value.split(':').map(Number);
        return extra.length === 0 && Number.isInteger(r) && Number.isInteger(c)
            ? { r, c }
            : null;
    };
    const from = parse(left);
    const to = parse(right);
    const canonical = createRoadEdgeId(from, to);
    if (!canonical || canonical !== edgeId) return null;

    return Object.freeze({
        edgeId: canonical,
        from: Object.freeze(from),
        to: Object.freeze(to)
    });
}

export function normalizeRoadEdgeIds(entries) {
    const source = entries instanceof Set
        ? [...entries]
        : (Array.isArray(entries) ? entries : []);
    const ids = new Set();

    for (const entry of source) {
        if (typeof entry === 'string') {
            const parsed = parseRoadEdgeId(entry);
            if (parsed) ids.add(parsed.edgeId);
            continue;
        }
        const id = createRoadEdgeId(entry?.from, entry?.to);
        if (id) ids.add(id);
    }

    return Object.freeze([...ids].sort());
}

export function hasRoadBetween(state, from, to) {
    const edgeId = createRoadEdgeId(from, to);
    if (!edgeId) return false;
    const edges = state?.roadEdges;
    if (edges instanceof Set) return edges.has(edgeId);
    if (Array.isArray(edges)) return edges.includes(edgeId);
    return false;
}

export function resolveRoadConnections(state, r, c) {
    if (!Number.isInteger(r) || !Number.isInteger(c)) return Object.freeze([]);
    const connections = [];

    for (const { direction, dr, dc } of CARDINAL_DIRECTIONS) {
        const to = { r: r + dr, c: c + dc };
        const edgeId = createRoadEdgeId({ r, c }, to);
        if (!edgeId || !hasRoadBetween(state, { r, c }, to)) continue;
        connections.push(Object.freeze({
            edgeId,
            direction,
            to: Object.freeze(to)
        }));
    }

    return Object.freeze(connections);
}

export function canonicalRoadResolver({ gameState = null, from = null, to = null } = {}) {
    return hasRoadBetween(gameState, from, to);
}

export { CARDINAL_DIRECTIONS as ROAD_CARDINAL_DIRECTIONS };
