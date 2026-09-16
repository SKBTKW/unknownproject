import { Web25DPlacementPreviewCompositeRenderer } from './web25d_placement_preview_composite_renderer.js';
import { drawWeb25DTrialOverlay } from './web25d_trial_overlay_renderer.js';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from './board_input_contract.js';

function sameCell(a, b) {
    return Boolean(a && b && a.r === b.r && a.c === b.c);
}

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
        if (previousContextMode !== nextContextMode) {
            this.lastPointerCell = null;
        }
        super.setReadModel(readModel);
    }

    render() {
        super.render();
        drawWeb25DTrialOverlay({
            ctx: this.ctx,
            projection: this.projection,
            readModel: this.readModel
        });
    }

    handlePointerMove(event) {
        const isTrial = this.readModel?.presentation?.contextMode === 'TRIAL';
        if (!isTrial) return super.handlePointerMove(event);

        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (sameCell(cell, this.lastPointerCell)) return cell;

        this.lastPointerCell = cell;
        const readCell = cell ? this.readModel?.cells?.[cell.r]?.[cell.c] || null : null;
        const routeId = readCell?.trial?.route?.routeId
            || this.readModel?.trial?.activeRouteId
            || null;

        if (readCell?.trial?.interceptionCandidate && routeId) {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
                { cell, routeId }
            ));
        } else {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER
            ));
        }
        return cell;
    }

    handlePointerLeave() {
        const isTrial = this.readModel?.presentation?.contextMode === 'TRIAL';
        if (!isTrial) return super.handlePointerLeave();
        if (!this.lastPointerCell) return;

        this.lastPointerCell = null;
        this.bridge.dispatch(createBoardInputCommand(
            BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER
        ));
    }

    handleClick(event) {
        const isTrial = this.readModel?.presentation?.contextMode === 'TRIAL';
        if (!isTrial) return super.handleClick(event);

        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (!cell) return null;

        const readCell = this.readModel?.cells?.[cell.r]?.[cell.c] || null;
        const isLegalCandidate = Boolean(readCell?.trial?.interceptionCandidate);
        const routeId = readCell?.trial?.route?.routeId
            || this.readModel?.trial?.activeRouteId
            || null;
        if (!isLegalCandidate || !routeId) return null;

        this.bridge.dispatch(createBoardInputCommand(
            BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
            { cell, routeId }
        ));
        return cell;
    }
}

export default Web25DPhaseFRenderer;
