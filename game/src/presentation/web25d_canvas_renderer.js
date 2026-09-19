import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from './board_input_contract.js';
import { Web25DProjectionAdapter } from './web25d_projection_adapter.js';

const ELEVATION_PIXELS = Object.freeze([0, 6, 14, 24]);
const GREENERY_DENSITY = Object.freeze([0, 2, 5, 8]);

const GREENERY_OFFSETS = Object.freeze([
    Object.freeze({ x: -12, y: 3 }),
    Object.freeze({ x: 10, y: 4 }),
    Object.freeze({ x: -2, y: -2 }),
    Object.freeze({ x: 16, y: -2 }),
    Object.freeze({ x: -17, y: -3 }),
    Object.freeze({ x: 6, y: -7 }),
    Object.freeze({ x: -8, y: -8 }),
    Object.freeze({ x: 1, y: 6 })
]);

export function resolveWeb25DElevationPixels(elevation) {
    return Number.isInteger(elevation) && elevation >= 0 && elevation < ELEVATION_PIXELS.length
        ? ELEVATION_PIXELS[elevation]
        : 0;
}

export function resolveWeb25DGreeneryDensity(greenery) {
    return Number.isInteger(greenery) && greenery >= 0 && greenery < GREENERY_DENSITY.length
        ? GREENERY_DENSITY[greenery]
        : 0;
}

function sameCell(a, b) {
    return Boolean(a && b && a.r === b.r && a.c === b.c);
}

function translatePoints(points, dx = 0, dy = 0) {
    return points.map(point => ({ x: point.x + dx, y: point.y + dy }));
}

function drawPolygon(ctx, points) {
    if (!points || points.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
}

function containsDiamond(center, halfW, halfH, x, y) {
    if (halfW <= 0 || halfH <= 0) return false;
    return Math.abs(x - center.x) / halfW + Math.abs(y - center.y) / halfH <= 1;
}

/**
 * Disposable Web 2.5D validation renderer.
 *
 * Responsibilities are intentionally narrow:
 * - draw logical cells projected by Web25DProjectionAdapter
 * - translate E into renderer-local visual lift
 * - translate GL into renderer-local vegetation density
 * - convert pointer coordinates back to logical {r,c}
 * - emit existing BoardInputContract commands
 *
 * It must never read or mutate GameState directly.
 */
export class Web25DCanvasRenderer {
    constructor({
        canvas,
        bridge,
        projectionAdapter = null,
        showCoordinates = true,
        showElevationLabels = false
    } = {}) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new Error('WEB25D_CANVAS_REQUIRED');
        }
        if (!bridge || typeof bridge.dispatch !== 'function') {
            throw new Error('WEB25D_BOARD_BRIDGE_REQUIRED');
        }

        const context = canvas.getContext('2d');
        if (!context) throw new Error('WEB25D_2D_CONTEXT_REQUIRED');

        this.canvas = canvas;
        this.ctx = context;
        this.bridge = bridge;
        this.projection = projectionAdapter || new Web25DProjectionAdapter();
        this.showCoordinates = showCoordinates !== false;
        this.showElevationLabels = Boolean(showElevationLabels);
        this.readModel = null;
        this.lastPointerCell = null;
        this.bound = false;

        this._onPointerMove = event => this.handlePointerMove(event);
        this._onPointerLeave = () => this.handlePointerLeave();
        this._onClick = event => this.handleClick(event);
    }

    setReadModel(readModel) {
        this.readModel = readModel || null;
        this.render();
    }

    bind() {
        if (this.bound) return;
        this.canvas.addEventListener('pointermove', this._onPointerMove);
        this.canvas.addEventListener('pointerleave', this._onPointerLeave);
        this.canvas.addEventListener('click', this._onClick);
        this.bound = true;
    }

    unbind() {
        if (!this.bound) return;
        this.canvas.removeEventListener('pointermove', this._onPointerMove);
        this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
        this.canvas.removeEventListener('click', this._onClick);
        this.bound = false;
        this.lastPointerCell = null;
    }

    getLogicalCellAtCanvasPoint(x, y) {
        const rows = this.readModel?.board?.rows ?? 0;
        const columns = this.readModel?.board?.columns ?? 0;
        if (rows <= 0 || columns <= 0) return null;

        const visualCandidates = [];
        for (const row of this.readModel?.cells || []) {
            for (const cell of row || []) {
                if (!cell?.placed) continue;
                visualCandidates.push({
                    cell,
                    depthKey: this.projection.getDepthKey(cell.r, cell.c),
                    lift: resolveWeb25DElevationPixels(cell.elevation)
                });
            }
        }
        visualCandidates.sort((a, b) => b.depthKey - a.depthKey);

        for (const candidate of visualCandidates) {
            const center = this.projection.projectCell(candidate.cell.r, candidate.cell.c);
            const raisedCenter = { x: center.x, y: center.y - candidate.lift };
            if (containsDiamond(
                raisedCenter,
                this.projection.halfW,
                this.projection.halfH,
                x,
                y
            )) {
                return Object.freeze({ r: candidate.cell.r, c: candidate.cell.c });
            }
        }

        return this.projection.hitTest(x, y, rows, columns);
    }

    getCanvasPointFromEvent(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
        return Object.freeze({
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        });
    }

    handlePointerMove(event) {
        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (sameCell(cell, this.lastPointerCell)) return cell;

        this.lastPointerCell = cell;
        if (cell) {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.HOVER_CELL,
                { cell }
            ));
        } else {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.CLEAR_HOVER
            ));
        }
        return cell;
    }

    handlePointerLeave() {
        if (this.lastPointerCell) {
            this.lastPointerCell = null;
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.CLEAR_HOVER
            ));
        }
    }

    handleClick(event) {
        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (!cell) return null;

        const isTrial = this.readModel?.presentation?.contextMode === "TRIAL";
        if (isTrial) {
            const isLegalCandidate = Boolean(cell.trial?.interceptionCandidate);
            const routeId = cell.trial?.route?.routeId
                || this.readModel?.trial?.activeRouteId
                || null;
            if (!isLegalCandidate || !routeId) {
                return null;
            }
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
                { cell, routeId }
            ));
            return cell;
        }

        this.bridge.dispatch(createBoardInputCommand(
            BOARD_INPUT_COMMANDS.SELECT_CELL,
            { cell }
        ));
        return cell;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.readModel) return;

        const cells = [];
        for (const row of this.readModel.cells || []) {
            for (const cell of row || []) {
                if (!cell) continue;
                const projected = this.projection.projectCellView(cell);
                cells.push({ cell, projected });
            }
        }
        cells.sort((a, b) => a.projected.depthKey - b.projected.depthKey);

        for (const item of cells) {
            this.drawCell(item.cell, item.projected);
        }
        if (this.showCoordinates) {
            this.drawCoordinateLabels();
        }
    }

    drawCell(cell, projected) {
        if (!cell.placed) {
            this.drawUnplacedCell(cell, projected);
            return;
        }
        this.drawPlacedTerrain(cell, projected);
    }

    drawUnplacedCell(cell, projected) {
        const ctx = this.ctx;
        drawPolygon(ctx, projected.screenPolygon);

        const selected = Boolean(cell.interaction?.selected);
        const hovered = Boolean(cell.interaction?.hovered);
        const focused = Boolean(cell.interaction?.focused);

        ctx.fillStyle = 'rgba(198, 210, 216, 0.16)';
        ctx.fill();
        ctx.lineWidth = selected ? 2.5 : (hovered || focused ? 2 : 1);
        ctx.strokeStyle = selected
            ? 'rgba(255, 224, 156, 0.95)'
            : (hovered || focused
                ? 'rgba(224, 238, 242, 0.95)'
                : 'rgba(180, 196, 202, 0.46)');
        ctx.stroke();
    }

    drawPlacedTerrain(cell, projected) {
        const ctx = this.ctx;
        const lift = resolveWeb25DElevationPixels(cell.elevation);
        const base = projected.screenPolygon;
        const top = translatePoints(base, 0, -lift);
        const [baseTop, baseRight, baseBottom, baseLeft] = base;
        const [topTop, topRight, topBottom, topLeft] = top;

        if (lift > 0) {
            drawPolygon(ctx, [topLeft, topBottom, baseBottom, baseLeft]);
            ctx.fillStyle = 'rgba(72, 80, 72, 0.68)';
            ctx.fill();

            drawPolygon(ctx, [topBottom, topRight, baseRight, baseBottom]);
            ctx.fillStyle = 'rgba(56, 63, 59, 0.76)';
            ctx.fill();
        }

        drawPolygon(ctx, top);
        ctx.fillStyle = this.resolveTerrainTopFill(cell);
        ctx.fill();

        const selected = Boolean(cell.interaction?.selected);
        const hovered = Boolean(cell.interaction?.hovered);
        const focused = Boolean(cell.interaction?.focused);
        ctx.lineWidth = selected ? 2.5 : (hovered || focused ? 2 : 1);
        ctx.strokeStyle = selected
            ? 'rgba(255, 224, 156, 0.95)'
            : (hovered || focused
                ? 'rgba(224, 238, 242, 0.95)'
                : 'rgba(142, 154, 143, 0.68)');
        ctx.stroke();

        this.drawGreenery(cell, projected.screenCenter, lift);

        if (this.showElevationLabels && Number.isInteger(cell.elevation)) {
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(228, 235, 224, 0.72)';
            ctx.fillText(`E${cell.elevation}`, projected.screenCenter.x, projected.screenCenter.y - lift + 3);
        }
    }

    resolveTerrainTopFill(cell) {
        switch (cell.greenery) {
            case 0: return 'rgba(139, 120, 92, 0.82)';
            case 1: return 'rgba(104, 126, 88, 0.82)';
            case 2: return 'rgba(72, 106, 72, 0.86)';
            case 3: return 'rgba(50, 78, 58, 0.90)';
            default: return 'rgba(116, 126, 112, 0.72)';
        }
    }

    drawGreenery(cell, center, lift) {
        const density = resolveWeb25DGreeneryDensity(cell.greenery);
        if (density <= 0) return;

        const ctx = this.ctx;
        for (let i = 0; i < density; i++) {
            const offset = GREENERY_OFFSETS[i % GREENERY_OFFSETS.length];
            const x = center.x + offset.x;
            const y = center.y - lift + offset.y;

            if (cell.greenery === 1) {
                ctx.beginPath();
                ctx.moveTo(x, y + 2);
                ctx.lineTo(x - 2, y - 2);
                ctx.moveTo(x, y + 2);
                ctx.lineTo(x + 2, y - 3);
                ctx.strokeStyle = 'rgba(173, 192, 118, 0.88)';
                ctx.lineWidth = 1;
                ctx.stroke();
                continue;
            }

            const canopyHeight = cell.greenery === 3 ? 8 : 6;
            const canopyWidth = cell.greenery === 3 ? 5 : 4;
            drawPolygon(ctx, [
                { x, y: y - canopyHeight },
                { x: x + canopyWidth, y: y + 1 },
                { x: x - canopyWidth, y: y + 1 }
            ]);
            ctx.fillStyle = cell.greenery === 3
                ? 'rgba(41, 72, 50, 0.96)'
                : 'rgba(56, 91, 58, 0.94)';
            ctx.fill();
        }
    }

    drawCoordinateLabels() {
        const rows = this.readModel?.board?.rows ?? 0;
        const columns = this.readModel?.board?.columns ?? 0;
        if (rows <= 0 || columns <= 0) return;

        const labels = this.projection.getCoordinateLabels(rows, columns);
        const hovered = this.readModel?.presentation?.hoveredCell || null;
        const selected = this.readModel?.presentation?.selectedCell || null;
        const ctx = this.ctx;

        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const item of labels.columns) {
            const emphasized = item.index === hovered?.c || item.index === selected?.c;
            ctx.fillStyle = emphasized
                ? 'rgba(244, 229, 190, 0.95)'
                : 'rgba(210, 220, 222, 0.58)';
            ctx.fillText(item.label, item.anchor.x, item.anchor.y);
        }
        for (const item of labels.rows) {
            const emphasized = item.index === hovered?.r || item.index === selected?.r;
            ctx.fillStyle = emphasized
                ? 'rgba(244, 229, 190, 0.95)'
                : 'rgba(210, 220, 222, 0.58)';
            ctx.fillText(item.label, item.anchor.x, item.anchor.y);
        }
    }
}

export default Web25DCanvasRenderer;
