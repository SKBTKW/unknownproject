export const BOARD_GROUP_JOIN_CLASSES = Object.freeze(['no-border-top','no-border-right','no-border-bottom','no-border-left','no-radius-tl','no-radius-tr','no-radius-br','no-radius-bl']);
const EDGE_JOIN_CLASSES = Object.freeze({NORTH:Object.freeze(['no-border-top','no-radius-tl','no-radius-tr']),EAST:Object.freeze(['no-border-right','no-radius-tr','no-radius-br']),SOUTH:Object.freeze(['no-border-bottom','no-radius-bl','no-radius-br']),WEST:Object.freeze(['no-border-left','no-radius-tl','no-radius-bl'])});
export function getBoardGroupJoinClasses(edges = []) {
    const classes = new Set();
    for (const edge of Array.isArray(edges) ? edges : []) {
        if (!edge || edge.boardBoundary) continue;
        if (!edge.samePlacementGroup && !edge.sameZone) continue;
        const mapped = EDGE_JOIN_CLASSES[edge.direction];
        if (!mapped) continue;
        mapped.forEach(cls => classes.add(cls));
    }
    return Object.freeze([...classes]);
}
export function applyBoardGroupJoinClasses(cellEl, edges) {
    if (!cellEl?.classList || !Array.isArray(edges)) return;
    cellEl.classList.remove(...BOARD_GROUP_JOIN_CLASSES);
    const classes = getBoardGroupJoinClasses(edges);
    if (classes.length > 0) cellEl.classList.add(...classes);
}
