import { BOARD_VIEW_MODES } from "../presentation/board_presentation_state.js";
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from "../presentation/board_input_contract.js";

function resolveEntryCell(route) {
    const cells = route?.cells || route?.path || [];
    const entry = cells[0];
    if (!entry) return null;
    const r = Number.isInteger(entry.r) ? entry.r : entry.row;
    const c = Number.isInteger(entry.c) ? entry.c : entry.column;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { r, c };
}

function getRouteLabel(route, index) {
    if (route?.isCommanderRoute) return `★${index + 1}`;
    return String(index + 1);
}

function clearMarkers(boardEl) {
    boardEl?.querySelectorAll?.(".trial-route-entry-selector")?.forEach?.(el => el.remove());
    boardEl?.querySelectorAll?.(".cell.is-trial-route-selector-host")?.forEach?.(el => {
        el.classList.remove("is-trial-route-selector-host", "is-trial-route-selector-active");
        el.removeAttribute("data-trial-route-selector");
    });
}

/**
 * Moves Trial route selection onto the Board without changing Trial domain state.
 *
 * Route markers belong to the TRIAL presentation context, not to the renderer axis
 * and not merely to the existence of a live Trial. BoardPresentationState is the
 * semantic source; Layout only projects that state into screen composition.
 */
export function attachTrialRouteBoardSelection(uiController) {
    if (!uiController || typeof document === "undefined") return null;
    if (uiController.trialRouteBoardSelectionBridge) return uiController.trialRouteBoardSelectionBridge;

    const bridge = {
        sync() {
            const boardEl = document.getElementById("gridBoard");
            if (!boardEl) return;
            clearMarkers(boardEl);

            const hasLiveTrial = Boolean(uiController.isTrialInteractionActive?.());
            const isTrialPresentation = uiController.boardPresentationState?.contextMode === "TRIAL";
            const is2D = !uiController.boardPresentationState?.viewMode
                || uiController.boardPresentationState?.viewMode === BOARD_VIEW_MODES.TWO_D;
            const hasCurrentBattle = Boolean(uiController.getCurrentTrialBattle?.());
            const active = hasLiveTrial && isTrialPresentation && is2D && !hasCurrentBattle;
            document.body?.classList.toggle("trial-route-selection-on-board", active);
            if (!active) return;

            const routes = uiController.getTrialPlanningRoutes?.() || uiController.trialController?.state?.routes || [];
            const activeRouteId = uiController.getActiveTrialRoute?.()?.id || null;

            routes.forEach((route, index) => {
                const routeId = route?.id ?? route?.routeId ?? null;
                const entry = resolveEntryCell(route);
                if (!entry || !routeId) return;
                const cellEl = boardEl.querySelector(`.cell[data-r="${entry.r}"][data-c="${entry.c}"]`);
                if (!cellEl) return;

                const isActive = routeId === activeRouteId;
                cellEl.classList.add("is-trial-route-selector-host");
                if (isActive) cellEl.classList.add("is-trial-route-selector-active");
                cellEl.setAttribute("data-trial-route-selector", routeId);

                const marker = document.createElement("button");
                marker.type = "button";
                marker.className = `trial-route-entry-selector${isActive ? " is-active" : ""}`;
                marker.dataset.routeId = routeId;
                marker.textContent = getRouteLabel(route, index);
                marker.setAttribute("aria-pressed", isActive ? "true" : "false");
                marker.setAttribute("aria-label", route.nameKey || routeId);
                marker.title = route.nameKey || routeId;
                marker.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    uiController.acknowledgeFirstRunTrialRoute?.();
                    if (isActive) return;
                    const inputRuntime = uiController.boardPresentationRuntimeBridge;
                    if (inputRuntime?.dispatchInput) {
                        inputRuntime.dispatchInput(createBoardInputCommand(
                            BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE,
                            { routeId }
                        ));
                        return;
                    }
                    uiController.selectTrialRoute?.(routeId);
                };
                cellEl.appendChild(marker);
            });
        }
    };

    uiController.trialRouteBoardSelectionBridge = bridge;

    if (typeof uiController.render === "function") {
        const baseRender = uiController.render.bind(uiController);
        uiController.render = (...args) => {
            const result = baseRender(...args);
            bridge.sync();
            return result;
        };
    }

    const baseSelectRoute = uiController.selectTrialRoute;
    if (typeof baseSelectRoute === "function") {
        const boundSelectRoute = baseSelectRoute.bind(uiController);
        uiController.selectTrialRoute = (...args) => {
            const result = boundSelectRoute(...args);
            bridge.sync();
            return result;
        };
    }

    bridge.sync();
    return bridge;
}

export default attachTrialRouteBoardSelection;