import { BoardGridComponent as LegacyBoardGridComponent } from './board_grid_component.js';
import { BOARD_CONTEXT_MODES } from '../presentation/board_presentation_state.js';

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

/**
 * Browser renderer adapter for BoardPresentationData.
 *
 * The legacy renderer still owns DOM construction, terrain visuals, placement
 * preview and layout. This adapter only projects renderer-neutral board
 * presentation semantics onto the already-created DOM.
 */
export class BoardPresentationGridComponent extends LegacyBoardGridComponent {
    render(I18n) {
        super.render(I18n);
        this.applyBoardPresentation();
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

            cellEl.classList.toggle('board-logical-hover', Boolean(interaction?.hovered));
            cellEl.classList.toggle('board-logical-focus', Boolean(interaction?.focused));
            cellEl.classList.toggle('board-logical-selected', Boolean(interaction?.selected));

            // Legacy BoardGridComponent can still add Trial classes directly.
            // NORMAL context must scrub them so actual Trial state never leaks
            // through a renderer that has not yet been fully migrated.
            if (!isTrialContext) {
                TRIAL_VISUAL_CLASSES.forEach(cls => cellEl.classList.remove(cls));
                cellEl.removeAttribute('data-trial-direction');
                return;
            }

            cellEl.classList.toggle('trial-route-cell', Boolean(trial?.onRoute));
            cellEl.classList.toggle('trial-route-entry', Boolean(trial?.route?.isRouteEntry));
            cellEl.classList.toggle('trial-route-end', Boolean(trial?.route?.isRouteEnd));
            cellEl.classList.toggle(
                'trial-interception-candidate',
                Boolean(trial?.interceptionCandidate?.canIntercept)
            );
            cellEl.classList.toggle(
                'trial-interception-selected',
                Boolean(interaction?.selected)
            );
            cellEl.classList.toggle(
                'trial-interception-planned',
                Boolean(trial?.plannedIntercept)
            );
            cellEl.classList.toggle(
                'trial-interception-planned-active',
                Boolean(
                    trial?.plannedIntercept &&
                    trial.plannedIntercept.routeId === presentation?.trial?.activeRouteId
                )
            );
            cellEl.classList.toggle(
                'trial-interception-planned-other',
                Boolean(
                    trial?.plannedIntercept &&
                    trial.plannedIntercept.routeId !== presentation?.trial?.activeRouteId
                )
            );
            cellEl.classList.toggle(
                'trial-interception-block-used',
                Boolean(trial?.interceptionCandidate?.isBlockPlannedByOther)
            );
            cellEl.classList.toggle(
                'trial-battle-active',
                Boolean(trial?.battleMarker?.isCurrent)
            );

            if (trial?.route?.routeDirection) {
                cellEl.setAttribute('data-trial-direction', trial.route.routeDirection);
            } else {
                cellEl.removeAttribute('data-trial-direction');
            }
        });
    }
}

export default BoardPresentationGridComponent;
