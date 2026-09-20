import { BoardGridComponent as LegacyBoardGridComponent } from './board_grid_component.js';
import { BOARD_CONTEXT_MODES } from '../presentation/board_presentation_state.js';
import { applyBoardGroupJoinClasses } from './board_presentation_2d_edge_adapter.js';
import { BOARD_INPUT_COMMANDS } from '../presentation/board_input_contract.js';
import {
    BOARD_POINTER_ACTIONS,
    resolveBoardPointerCommand
} from '../presentation/board_input_semantic_resolver.js';

export const TRIAL_VISUAL_CLASSES = Object.freeze([
    'trial-route-cell',
    'trial-route-entry',
    'trial-route-end',
    'trial-interception-candidate',
    'trial-interception-selected',
    'trial-interception-planned',
    'trial-interception-planned-active',
    'trial-interception-planned-other',
    'trial-interception-block-used',
    'trial-battle-active'
]);

export class BoardPresentationGridComponent extends LegacyBoardGridComponent {
    render(I18n) {
        super.render(I18n);
        this.bindBoardInput();
        this.applyBoardPresentation();
    }

    bindBoardInput() {
        if (typeof document === 'undefined') return;
        const runtime = this.ui?.boardPresentationRuntimeBridge;
        if (!runtime || typeof runtime.dispatchInput !== 'function') return;
        const boardEl = document.getElementById('gridBoard');
        if (!boardEl) return;

        boardEl.querySelectorAll('.cell').forEach(cellEl => {
            const r = Number(cellEl.getAttribute('data-r'));
            const c = Number(cellEl.getAttribute('data-c'));
            if (!Number.isInteger(r) || !Number.isInteger(c)) return;

            const legacyEnter = cellEl.onmouseenter;
            const legacyLeave = cellEl.onmouseleave;

            cellEl.onclick = () => {
                const command = resolveBoardPointerCommand(
                    BOARD_POINTER_ACTIONS.CLICK,
                    {
                        readModel: this.ui.getBoardPresentationData?.() || null,
                        cell: { r, c }
                    }
                );
                if (!command) return null;
                const result = runtime.dispatchInput(command);
                this.applyBoardPresentation();
                return result;
            };

            cellEl.onmouseenter = event => {
                const command = resolveBoardPointerCommand(
                    BOARD_POINTER_ACTIONS.HOVER,
                    {
                        readModel: this.ui.getBoardPresentationData?.() || null,
                        cell: { r, c }
                    }
                );
                if (!command) return null;
                const result = runtime.dispatchInput(command);
                if (result?.success !== false
                    && command.type === BOARD_INPUT_COMMANDS.HOVER_CELL
                    && typeof legacyEnter === 'function') {
                    legacyEnter(event);
                }
                this.applyBoardPresentation();
                return result;
            };

            cellEl.onmouseleave = event => {
                const command = resolveBoardPointerCommand(
                    BOARD_POINTER_ACTIONS.LEAVE,
                    { readModel: this.ui.getBoardPresentationData?.() || null }
                );
                const result = runtime.dispatchInput(command);
                if (result?.success !== false
                    && command.type === BOARD_INPUT_COMMANDS.CLEAR_HOVER
                    && typeof legacyLeave === 'function') {
                    legacyLeave(event);
                }
                this.applyBoardPresentation();
                return result;
            };
        });
    }

    applyBoardPresentation() {
        if (typeof document === 'undefined') return;
        if (!this.ui || typeof this.ui.getBoardPresentationData !== 'function') return;
        const boardEl = document.getElementById('gridBoard');
        if (!boardEl) return;
        const presentation = this.ui.getBoardPresentationData();
        const state = presentation?.presentation || null;
        const cells = presentation?.cells || [];
        if (state) {
            boardEl.setAttribute('data-board-view-mode', state.viewMode);
            boardEl.setAttribute('data-board-context-mode', state.contextMode);
        }
        const isTrialContext = state?.contextMode === BOARD_CONTEXT_MODES.TRIAL;
        boardEl.querySelectorAll('.cell').forEach(cellEl => {
            const r = Number(cellEl.getAttribute('data-r'));
            const c = Number(cellEl.getAttribute('data-c'));
            if (!Number.isInteger(r) || !Number.isInteger(c)) return;
            const cell = cells?.[r]?.[c] || null;
            const interaction = cell?.interaction || null;
            const trial = cell?.trial || null;
            applyBoardGroupJoinClasses(cellEl, cell?.edges);
            cellEl.classList.toggle('board-logical-hover', !isTrialContext && Boolean(interaction?.hovered));
            cellEl.classList.toggle('board-logical-focus', !isTrialContext && Boolean(interaction?.focused));
            cellEl.classList.toggle('board-logical-selected', !isTrialContext && Boolean(interaction?.selected));
            cellEl.classList.toggle('cell-placed-this-turn', Boolean(interaction?.placedThisTurn));
            if (!isTrialContext) {
                TRIAL_VISUAL_CLASSES.forEach(cls => cellEl.classList.remove(cls));
                cellEl.removeAttribute('data-trial-direction');
                return;
            }
            cellEl.classList.toggle('trial-route-cell', Boolean(trial?.onRoute));
            cellEl.classList.toggle('trial-route-entry', Boolean(trial?.route?.isRouteEntry));
            cellEl.classList.toggle('trial-route-end', Boolean(trial?.route?.isRouteEnd));
            cellEl.classList.toggle('trial-interception-candidate', Boolean(trial?.interceptionCandidate?.canIntercept));
            cellEl.classList.toggle('trial-interception-selected', Boolean(trial?.interceptionSelected));
            cellEl.classList.toggle('trial-interception-planned', Boolean(trial?.plannedIntercept));
            cellEl.classList.toggle('trial-interception-planned-active', Boolean(trial?.plannedIntercept && trial.plannedIntercept.routeId === presentation?.trial?.activeRouteId));
            cellEl.classList.toggle('trial-interception-planned-other', Boolean(trial?.plannedIntercept && trial.plannedIntercept.routeId !== presentation?.trial?.activeRouteId));
            cellEl.classList.toggle('trial-interception-block-used', Boolean(trial?.interceptionCandidate?.isBlockPlannedByOther));
            cellEl.classList.toggle('trial-battle-active', Boolean(trial?.battleMarker?.isCurrent));
            if (trial?.route?.routeDirection) cellEl.setAttribute('data-trial-direction', trial.route.routeDirection);
            else cellEl.removeAttribute('data-trial-direction');
        });
    }
}

export default BoardPresentationGridComponent;
