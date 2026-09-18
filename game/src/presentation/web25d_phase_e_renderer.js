import { Web25DPhaseCRenderer } from './web25d_phase_c_renderer.js';
import { drawWeb25DZoneLinkOverlay } from './web25d_zone_link_overlay_renderer.js';

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

    render() {
        super.render();
        drawWeb25DZoneLinkOverlay({
            ctx: this.ctx,
            projection: this.projection,
            readModel: this.readModel,
            resolveTerrainTopFill: cell => this.resolveTerrainTopFill(cell),
            shouldDrawCell: cell => this.shouldDrawZoneLinkCell(cell),
            shouldDrawEdge: (cell, edge) => this.shouldDrawZoneLinkEdge(cell, edge)
        });
    }
}

export default Web25DPhaseERenderer;
