import { Web25DPlacementPreviewCompositeRenderer } from './web25d_placement_preview_composite_renderer.js';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from './board_input_contract.js';
import {
    drawWeb25DTrialOverlay,
    hitWeb25DTrialRouteSelector
} from './web25d_trial_overlay_renderer.js';

/**
 * Phase 2.5D-F renderer.
 *
 * Trial semantics are supplied by BoardPresentationData. This class only adds
 * Trial overlay drawing and Trial-specific hover/input routing on top of the
 * normal 2.5D board/placement-preview renderer stack.
 */
export class Web25DPhaseFRenderer extends Web25DPlacementPreviewCompositeRenderer {
    setReadModel(readModel) {
        const previousContextMode = this.readModel?.presentation?.contextMode ?? null;
        const nextContextMode = readModel?.presentation?.contextMode ?? null;
        const previousRouteId = this.readModel?.trial?.activeRouteId ?? null;
        const nextRouteId = readModel?.trial?.activeRouteId ?? null;
        if (previousContextMode !== nextContextMode || previousRouteId !== nextRouteId) {
            this.lastPointerCell = null;
        }
        super.setReadModel(readModel);
    }

    handleClick(event) {
        const point = this.getCanvasPointFromEvent(event);
        const selector = hitWeb25DTrialRouteSelector({
            point,
            projection: this.projection,
            readModel: this.readModel
        });

        if (selector) {
            if (!selector.isActive) {
                this.bridge.dispatch(createBoardInputCommand(
                    BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE,
                    { routeId: selector.routeId }
                ));
            }
            return selector.entryCell;
        }

        return super.handleClick(event);
    }

    render() {
        super.render();
        drawWeb25DTrialOverlay({
            ctx: this.ctx,
            projection: this.projection,
            readModel: this.readModel
        });
    }
}

export default Web25DPhaseFRenderer;
