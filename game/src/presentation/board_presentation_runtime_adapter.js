import { BoardPresentationDataService } from './board_presentation_data_service.js';
import { TrialBoardSemanticAdapter } from './trial_board_semantic_adapter.js';

function getBoardSize(grid) {
    const rows = Array.isArray(grid) ? grid.length : 0;
    const columns = Array.isArray(grid)
        ? grid.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
        : 0;
    return Object.freeze({ rows, columns });
}

/**
 * Renderer-neutral runtime -> board presentation boundary.
 *
 * This adapter is intentionally thin:
 * - Game/Trial runtime state remains authoritative.
 * - Trial presentation semantics are normalized once here.
 * - Web/Unity renderers consume the same BoardPresentationDataService output.
 * - No DOM, screen-space, world-space, Sprite, GameObject, or Transform data belongs here.
 */
export class BoardPresentationRuntimeAdapter {
    constructor({ dataService = null, trialAdapter = TrialBoardSemanticAdapter } = {}) {
        this.dataService = dataService || new BoardPresentationDataService();
        this.trialAdapter = trialAdapter;
    }

    getBoard(state, {
        presentationState,
        trialState = null,
        trialPresentationState = null,
        trialSemanticData = null,
        gridOverride = null,
        interceptionCandidates = [],
        interactionQuery = null
    } = {}) {
        if (!state) throw new Error('BOARD_RUNTIME_STATE_REQUIRED');
        if (!presentationState) throw new Error('BOARD_PRESENTATION_STATE_REQUIRED');

        const grid = gridOverride || state.grid || [];
        const resolvedTrialSemanticData = trialSemanticData || this.trialAdapter.fromRuntime({
            trialState,
            trialPresentationState,
            boardSize: getBoardSize(grid),
            interceptionCandidates
        });

        return this.dataService.getBoard(state, {
            presentationState,
            trialSemanticData: resolvedTrialSemanticData,
            gridOverride,
            interactionQuery
        });
    }
}

export default BoardPresentationRuntimeAdapter;
