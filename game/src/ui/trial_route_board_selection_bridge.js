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
 * The route entry cell is the stable spatial selector; the legacy right-side route
 * list remains visible as summary during migration but is no longer the primary input.
 */
export function attachTrialRouteBoardSelection(uiController) {
    if (!uiController || typeof document === "undefined") return null;
    if (uiController.trialRouteBoardSelectionBridge) return uiController.trialRouteBoardSelectionBridge;

    const bridge = {
        sync() {
            const boardEl = document.getElementById("gridBoard");
            if (!boardEl) return;
            clearMarkers(boardEl);

            const active = Boolean(uiController.trialPreviewConfig && uiController.trialController?.state);
            document.body?.classList.toggle("trial-route-selection-on-board", active);
            if (!active) return;

            const routes = uiController.getTrialPlanningRoutes?.() || uiController.trialController?.state?.routes || [];
            const activeRouteId = uiController.getActiveTrialRoute?.()?.id || null;

            routes.forEach((route, index) => {
                const entry = resolveEntryCell(route);
                if (!entry) return;
                const cellEl = boardEl.querySelector(`.cell[data-r="${entry.r}"][data-c="${entry.c}"]`);
                if (!cellEl) return;

                const isActive = route.id === activeRouteId;
                cellEl.classList.add("is-trial-route-selector-host");
                if (isActive) cellEl.classList.add("is-trial-route-selector-active");
                cellEl.setAttribute("data-trial-route-selector", route.id);

                const marker = document.createElement("button");
                marker.type = "button";
                marker.className = `trial-route-entry-selector${isActive ? " is-active" : ""}`;
                marker.dataset.routeId = route.id;
                marker.textContent = getRouteLabel(route, index);
                marker.setAttribute("aria-pressed", isActive ? "true" : "false");
                marker.setAttribute("aria-label", route.nameKey || route.id);
                marker.title = route.nameKey || route.id;
                marker.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!isActive) uiController.selectTrialRoute?.(route.id);
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
