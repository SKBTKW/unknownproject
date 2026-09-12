function routeCells(route) {
    return route ? (route.cells || route.path || []) : [];
}

function coords(entry) {
    if (!entry) return null;
    const r = Number.isInteger(entry.r) ? entry.r : entry.row;
    const c = Number.isInteger(entry.c) ? entry.c : entry.column;
    return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function findRoutePosition(route, r, c) {
    const cells = routeCells(route);
    const index = cells.findIndex(entry => {
        const cell = coords(entry);
        return cell?.r === r && cell?.c === c;
    });
    return index >= 0 ? { route, cells, index } : null;
}

/**
 * Trial presentation/domain bridge for interception legality.
 *
 * It owns no DOM and no layout. Domain legality remains delegated to the
 * injected previewResolver (normally TrialController.previewInterception).
 */
export class TrialInterceptionSemanticProvider {
    createPreviewInput({
        r,
        c,
        displayGrid,
        activeRoute,
        trialPresentationState
    } = {}) {
        const position = findRoutePosition(activeRoute, r, c);
        const interceptCell = displayGrid?.[r]?.[c];
        if (!position || !interceptCell || !interceptCell.placed || interceptCell.isHQ) {
            return null;
        }

        const approachEntry = position.index > 0 ? position.cells[position.index - 1] : null;
        const approach = coords(approachEntry) || { r, c };
        const approachCell = displayGrid?.[approach.r]?.[approach.c] || interceptCell;

        return {
            allocatedDefense: trialPresentationState?.previewDefenseAllocation || 0,
            interceptCell: { ...interceptCell, cellId: `${r}:${c}` },
            approachCell: { ...approachCell, cellId: `${approach.r}:${approach.c}` }
        };
    }

    getCellState({
        r,
        c,
        displayGrid,
        activeRoute,
        trialPresentationState,
        previewResolver
    } = {}) {
        if (!trialPresentationState) return null;

        const position = findRoutePosition(activeRoute, r, c);
        const cell = displayGrid?.[r]?.[c];
        const activeRouteId = activeRoute?.id ?? activeRoute?.routeId ?? null;

        const blockId = cell?.placementGroupId != null
            ? `placement:${cell.placementGroupId}`
            : `cell:${r}:${c}`;
        const isBlockPlannedByOther = Boolean(
            activeRouteId &&
            trialPresentationState.isBlockPlannedByOtherRoute?.(activeRouteId, blockId)
        );

        const plannedInfo = trialPresentationState.getPlannedCellInfo?.(r, c) || null;
        const state = {
            onRoute: Boolean(position),
            canIntercept: false,
            isPlanned: Boolean(plannedInfo),
            isPlannedActive: Boolean(plannedInfo && plannedInfo.routeId === activeRouteId),
            isPlannedOther: Boolean(plannedInfo && plannedInfo.routeId !== activeRouteId),
            isBlockPlannedByOther
        };

        if (!position && !plannedInfo) return null;
        if (!position || !cell || !cell.placed || cell.isHQ) return state;

        if (isBlockPlannedByOther) {
            state.reason = "BLOCK_ALREADY_PLANNED";
            return state;
        }

        const input = this.createPreviewInput({
            r,
            c,
            displayGrid,
            activeRoute,
            trialPresentationState
        });
        if (!input || typeof previewResolver !== "function") return state;

        const result = previewResolver(input);
        state.canIntercept = result?.success !== false;
        if (result?.reason) state.reason = result.reason;
        return state;
    }

    collect({
        displayGrid,
        activeRoute,
        trialPresentationState,
        previewResolver
    } = {}) {
        if (!Array.isArray(displayGrid) || !trialPresentationState) return [];

        const result = [];
        for (let r = 0; r < displayGrid.length; r++) {
            const row = displayGrid[r] || [];
            for (let c = 0; c < row.length; c++) {
                const cellState = this.getCellState({
                    r,
                    c,
                    displayGrid,
                    activeRoute,
                    trialPresentationState,
                    previewResolver
                });
                if (!cellState) continue;
                result.push(Object.freeze({
                    cell: Object.freeze({ r, c }),
                    ...cellState
                }));
            }
        }
        return Object.freeze(result);
    }
}

export default TrialInterceptionSemanticProvider;
