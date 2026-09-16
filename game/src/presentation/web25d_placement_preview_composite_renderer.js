import { Web25DPhaseCRenderer } from './web25d_phase_c_renderer.js';
import { drawWeb25DPlacementPreview } from './web25d_placement_preview_renderer.js';

/**
 * Web-only composite used by the disposable 2.5D validation runtime.
 *
 * Phase C remains focused on stable board rendering. Placement preview is
 * applied afterwards as a presentation overlay so placement rules stay in the
 * existing resolver/domain path and do not leak into the renderer.
 */
export class Web25DPlacementPreviewCompositeRenderer extends Web25DPhaseCRenderer {
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
