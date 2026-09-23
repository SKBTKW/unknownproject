import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';
import { BOARD_VISIBILITY } from './board_presentation_profile.js';

function normalizeVisibility(value) {
    return Object.values(BOARD_VISIBILITY).includes(value)
        ? value
        : BOARD_VISIBILITY.VISIBLE;
}

export function resolveWeb25DRoadOpacity(visibility) {
    switch (normalizeVisibility(visibility)) {
        case BOARD_VISIBILITY.HIDDEN: return 0;
        case BOARD_VISIBILITY.SUPPRESSED: return 0.24;
        case BOARD_VISIBILITY.SECONDARY: return 0.55;
        case BOARD_VISIBILITY.PRIMARY:
        case BOARD_VISIBILITY.VISIBLE:
        default:
            return 1;
    }
}

function shouldDrawSharedRoad(cell, edge) {
    const neighbor = edge?.neighbor;
    if (!neighbor) return false;
    if (cell.r < neighbor.r) return true;
    if (cell.r > neighbor.r) return false;
    return cell.c < neighbor.c;
}

function projectedCenter(projection, cell) {
    const projected = projection.projectCellView(cell);
    return {
        x: projected.screenCenter.x,
        y: projected.screenCenter.y - resolveWeb25DElevationPixels(cell.elevation)
    };
}

export function collectWeb25DRoadSegments({
    projection,
    readModel,
    shouldDrawCell = () => true,
    shouldDrawEdge = () => true
} = {}) {
    if (!projection || !readModel) return Object.freeze([]);
    const segments = [];

    for (const row of readModel.cells || []) {
        for (const cell of row || []) {
            if (!cell?.placed || !shouldDrawCell(cell)) continue;
            for (const edge of cell.edges || []) {
                if (!edge?.road || !edge.neighbor || !shouldDrawSharedRoad(cell, edge)) continue;
                const neighbor = readModel.cells?.[edge.neighbor.r]?.[edge.neighbor.c] || null;
                if (!neighbor?.placed || !shouldDrawCell(neighbor) || !shouldDrawEdge(cell, edge)) continue;

                segments.push(Object.freeze({
                    from: Object.freeze(projectedCenter(projection, cell)),
                    to: Object.freeze(projectedCenter(projection, neighbor)),
                    fromCell: Object.freeze({ r: cell.r, c: cell.c }),
                    toCell: Object.freeze({ r: neighbor.r, c: neighbor.c })
                }));
            }
        }
    }

    return Object.freeze(segments);
}

export function drawWeb25DRoadOverlay({
    ctx,
    projection,
    readModel,
    shouldDrawCell = () => true,
    shouldDrawEdge = () => true
} = {}) {
    const opacity = resolveWeb25DRoadOpacity(readModel?.profile?.roads);
    if (!ctx || opacity <= 0) return;

    const previousAlpha = Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1;
    ctx.globalAlpha = previousAlpha * opacity;
    try {
        for (const segment of collectWeb25DRoadSegments({
            projection,
            readModel,
            shouldDrawCell,
            shouldDrawEdge
        })) {
            ctx.beginPath();
            ctx.moveTo(segment.from.x, segment.from.y);
            ctx.lineTo(segment.to.x, segment.to.y);
            ctx.strokeStyle = 'rgba(66, 58, 48, 0.78)';
            ctx.lineWidth = 5;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(segment.from.x, segment.from.y);
            ctx.lineTo(segment.to.x, segment.to.y);
            ctx.strokeStyle = 'rgba(190, 170, 132, 0.88)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }
    } finally {
        ctx.globalAlpha = previousAlpha;
    }
}

export default drawWeb25DRoadOverlay;
