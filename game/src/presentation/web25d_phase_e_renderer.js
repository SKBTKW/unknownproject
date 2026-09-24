import { Web25DPhaseCRenderer } from './web25d_phase_c_renderer.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';
import { drawWeb25DZoneLinkOverlay } from './web25d_zone_link_overlay_renderer.js';
import { drawWeb25DRoadOverlay } from './web25d_road_overlay_renderer.js';

/**
 * Phase 2.5D-E renderer.
 *
 * Adds Zone/Link presentation marks after the stable Phase C board render.
 * It consumes only renderer-neutral BoardPresentationData edge semantics.
 */
export class Web25DPhaseERenderer extends Web25DPhaseCRenderer {
    shouldDrawZoneLinkCell() {
        return true;
    }

    shouldDrawZoneLinkEdge() {
        return true;
    }

    shouldDrawRoadCell(cell) {
        return this.shouldDrawZoneLinkCell(cell);
    }

    shouldDrawRoadEdge(cell, edge) {
        return this.shouldDrawZoneLinkEdge(cell, edge);
    }

    redrawPriorityLandmarks() {
        for (const row of this.readModel?.cells || []) {
            for (const cell of row || []) {
                if (!cell?.placed || !cell.isHQ) continue;
                const projected = this.projection.projectCellView(cell);
                const lift = resolveWeb25DElevationPixels(cell.elevation);
                this.drawHQBeacon({
                    x: projected.screenCenter.x,
                    y: projected.screenCenter.y - lift
                });
            }
        }
    }

    render() {
        super.render();
        drawWeb25DRoadOverlay({
            ctx: this.ctx,
            projection: this.projection,
            readModel: this.readModel,
            shouldDrawCell: cell => this.shouldDrawRoadCell(cell),
            shouldDrawEdge: (cell, edge) => this.shouldDrawRoadEdge(cell, edge)
        });
        drawWeb25DZoneLinkOverlay({
            ctx: this.ctx,
            projection: this.projection,
            readModel: this.readModel,
            resolveTerrainTopFill: cell => this.resolveTerrainTopFill(cell),
            shouldDrawCell: cell => this.shouldDrawZoneLinkCell(cell),
            shouldDrawEdge: (cell, edge) => this.shouldDrawZoneLinkEdge(cell, edge)
        });

        // Preserve the Last Ember as the board's persistent visual landmark.
        // Only the beacon is redrawn here: the HQ ruin stays in normal depth
        // order, while placement/trial overlays still render above this phase.
        this.redrawPriorityLandmarks();
    }
}

export default Web25DPhaseERenderer;
