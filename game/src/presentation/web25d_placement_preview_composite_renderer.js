import { Web25DPhaseERenderer } from './web25d_phase_e_renderer.js';
import { drawWeb25DPlacementPreview } from './web25d_placement_preview_renderer.js';

/**
 * Web-only composite used by the disposable 2.5D validation runtime.
 *
 * Phase E supplies stable board + Zone/Link rendering. Placement preview is
 * applied afterwards as a presentation overlay so placement rules stay in the
 * existing resolver/domain path and do not leak into the renderer.
 */
export class Web25DPlacementPreviewCompositeRenderer extends Web25DPhaseERenderer {
    render() {
        super.render();
        drawWeb25DPlacementPreview({
            ctx: this.ctx,
            projection: this.projection,
            readModel: this.readModel
        });
    }
}

export default Web25DPlacementPreviewCompositeRenderer;
