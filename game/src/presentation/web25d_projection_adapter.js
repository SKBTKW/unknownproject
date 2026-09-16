export const WEB25D_TILE_WIDTH = 60;
export const WEB25D_TILE_HEIGHT = 30;

export const WEB25D_LOGICAL_EDGES = Object.freeze({
    NORTH: "NORTH",
    EAST: "EAST",
    SOUTH: "SOUTH",
    WEST: "WEST"
});

function assertFiniteNumber(value, name) {
    if (!Number.isFinite(value)) throw new Error(`WEB25D_INVALID_${name}`);
}

function assertCellIndex(value, name) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`WEB25D_INVALID_${name}`);
}

function freezePoint(x, y) {
    return Object.freeze({ x, y });
}

/**
 * Disposable Web 2.5D projection adapter.
 *
 * Input is logical board data only. Screen-space values produced here MUST NOT
 * flow back into GameState, Domain, or portable BoardPresentationData.
 */
export class Web25DProjectionAdapter {
    constructor({
        tileWidth = WEB25D_TILE_WIDTH,
        tileHeight = WEB25D_TILE_HEIGHT,
        originX = 0,
        originY = 0
    } = {}) {
        assertFiniteNumber(tileWidth, "TILE_WIDTH");
        assertFiniteNumber(tileHeight, "TILE_HEIGHT");
        assertFiniteNumber(originX, "ORIGIN_X");
        assertFiniteNumber(originY, "ORIGIN_Y");
        if (tileWidth <= 0 || tileHeight <= 0) throw new Error("WEB25D_TILE_SIZE_MUST_BE_POSITIVE");

        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        this.halfW = tileWidth / 2;
        this.halfH = tileHeight / 2;
        this.originX = originX;
        this.originY = originY;
    }

    projectCell(r, c) {
        assertCellIndex(r, "ROW");
        assertCellIndex(c, "COLUMN");
        return freezePoint(
            this.originX + (c - r) * this.halfW,
            this.originY + (c + r) * this.halfH
        );
    }

    getTilePolygon(r, c) {
        const center = this.projectCell(r, c);
        return Object.freeze([
            freezePoint(center.x, center.y - this.halfH),
            freezePoint(center.x + this.halfW, center.y),
            freezePoint(center.x, center.y + this.halfH),
            freezePoint(center.x - this.halfW, center.y)
        ]);
    }

    getProjectedEdges(r, c) {
        const polygon = this.getTilePolygon(r, c);
        const [top, right, bottom, left] = polygon;
        return Object.freeze({
            [WEB25D_LOGICAL_EDGES.NORTH]: Object.freeze([left, top]),
            [WEB25D_LOGICAL_EDGES.EAST]: Object.freeze([top, right]),
            [WEB25D_LOGICAL_EDGES.SOUTH]: Object.freeze([right, bottom]),
            [WEB25D_LOGICAL_EDGES.WEST]: Object.freeze([bottom, left])
        });
    }

    containsPoint(r, c, screenX, screenY) {
        assertFiniteNumber(screenX, "SCREEN_X");
        assertFiniteNumber(screenY, "SCREEN_Y");
        const center = this.projectCell(r, c);
        const dx = Math.abs(screenX - center.x) / this.halfW;
        const dy = Math.abs(screenY - center.y) / this.halfH;
        return dx + dy <= 1;
    }

    /**
     * Convert renderer-local screen coordinates to a logical cell.
     * Returns only {r,c}; no screen coordinate enters BoardInputContract.
     */
    hitTest(screenX, screenY, rows, columns) {
        assertFiniteNumber(screenX, "SCREEN_X");
        assertFiniteNumber(screenY, "SCREEN_Y");
        assertCellIndex(rows, "ROWS");
        assertCellIndex(columns, "COLUMNS");

        // Reverse projected center estimate, then inspect a small neighborhood.
        // This stays O(1) for normal hits and avoids depending on DOM geometry.
        const localX = screenX - this.originX;
        const localY = screenY - this.originY;
        const estimatedC = (localX / this.halfW + localY / this.halfH) / 2;
        const estimatedR = (localY / this.halfH - localX / this.halfW) / 2;
        const baseR = Math.floor(estimatedR);
        const baseC = Math.floor(estimatedC);

        let best = null;
        let bestDistance = Infinity;
        for (let r = baseR - 1; r <= baseR + 1; r++) {
            for (let c = baseC - 1; c <= baseC + 1; c++) {
                if (r < 0 || c < 0 || r >= rows || c >= columns) continue;
                if (!this.containsPoint(r, c, screenX, screenY)) continue;
                const center = this.projectCell(r, c);
                const distance = Math.abs(screenX - center.x) + Math.abs(screenY - center.y);
                if (distance < bestDistance) {
                    best = { r, c };
                    bestDistance = distance;
                }
            }
        }
        return best ? Object.freeze(best) : null;
    }

    getDepthKey(r, c, objectOrder = 0) {
        assertCellIndex(r, "ROW");
        assertCellIndex(c, "COLUMN");
        assertFiniteNumber(objectOrder, "OBJECT_ORDER");
        return (r + c) * 100000 + r * 1000 + c * 10 + objectOrder;
    }

    projectCellView(logicalCell) {
        if (!logicalCell || !Number.isInteger(logicalCell.r) || !Number.isInteger(logicalCell.c)) {
            throw new Error("WEB25D_LOGICAL_CELL_REQUIRED");
        }
        const { r, c } = logicalCell;
        const screenCenter = this.projectCell(r, c);
        const screenPolygon = this.getTilePolygon(r, c);
        return Object.freeze({
            logicalCell,
            screenCenter,
            screenPolygon,
            topAnchor: freezePoint(screenCenter.x, screenCenter.y - this.halfH),
            resourceAnchor: freezePoint(screenCenter.x, screenCenter.y - this.halfH * 0.25),
            depthKey: this.getDepthKey(r, c),
            projectedEdges: this.getProjectedEdges(r, c)
        });
    }

    getCoordinateLabels(rows, columns, margin = 18) {
        assertCellIndex(rows, "ROWS");
        assertCellIndex(columns, "COLUMNS");
        assertFiniteNumber(margin, "LABEL_MARGIN");

        const columnLabels = [];
        for (let c = 0; c < columns; c++) {
            const center = this.projectCell(0, c);
            columnLabels.push(Object.freeze({
                axis: "COLUMN",
                index: c,
                label: String.fromCharCode(65 + c),
                anchor: freezePoint(center.x - this.halfW * 0.5, center.y - this.halfH - margin)
            }));
        }

        const rowLabels = [];
        for (let r = 0; r < rows; r++) {
            const center = this.projectCell(r, 0);
            rowLabels.push(Object.freeze({
                axis: "ROW",
                index: r,
                label: String(r + 1),
                anchor: freezePoint(center.x - this.halfW - margin, center.y - this.halfH * 0.5)
            }));
        }

        return Object.freeze({
            columns: Object.freeze(columnLabels),
            rows: Object.freeze(rowLabels)
        });
    }
}

export default Web25DProjectionAdapter;
