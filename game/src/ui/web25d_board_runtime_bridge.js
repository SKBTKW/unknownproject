import { BOARD_VIEW_MODES } from '../presentation/board_presentation_state.js';
import { Web25DProjectionAdapter } from '../presentation/web25d_projection_adapter.js';
import { Web25DPhaseFRenderer } from '../presentation/web25d_phase_f_renderer.js';

const DEFAULT_CANVAS_WIDTH = 584;
const DEFAULT_CANVAS_HEIGHT = 584;
const COMPACT_STAGE_TILE_WIDTH = 76;
const DENSE_STAGE_TILE_WIDTH = 60;
const VIEWPORT_GUTTER = 22;

function normalizeBoardDimension(value, fallback = 5) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function floorEven(value) {
    return Math.max(2, Math.floor(value / 2) * 2);
}

export function resolveWeb25DViewportProjection({
    width = DEFAULT_CANVAS_WIDTH,
    height = DEFAULT_CANVAS_HEIGHT,
    rows = 5,
    columns = 5
} = {}) {
    const viewportWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_CANVAS_WIDTH;
    const viewportHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_CANVAS_HEIGHT;
    const boardRows = normalizeBoardDimension(rows);
    const boardColumns = normalizeBoardDimension(columns);
    const boardDimension = Math.max(boardRows, boardColumns);
    const desiredTileWidth = boardDimension >= 9
        ? DENSE_STAGE_TILE_WIDTH
        : COMPACT_STAGE_TILE_WIDTH;
    const spanFactor = (boardRows + boardColumns) / 2;
    const availableWidth = Math.max(spanFactor * 2, viewportWidth - VIEWPORT_GUTTER * 2);
    const availableHeight = Math.max(spanFactor, viewportHeight - VIEWPORT_GUTTER * 2);
    const fitByWidth = availableWidth / spanFactor;
    const fitByHeight = (availableHeight * 2) / spanFactor;
    const tileWidth = floorEven(Math.min(desiredTileWidth, fitByWidth, fitByHeight));
    const tileHeight = tileWidth / 2;
    const boardHeight = spanFactor * tileHeight;

    return Object.freeze({
        tileWidth,
        tileHeight,
        originX: viewportWidth / 2,
        originY: (viewportHeight - boardHeight) / 2 + tileHeight / 2
    });
}

function resolveCanvasSize(boardEl) {
    const rect = boardEl?.getBoundingClientRect?.();
    const width = Math.max(1, Math.round(rect?.width || boardEl?.offsetWidth || DEFAULT_CANVAS_WIDTH));
    const height = Math.max(1, Math.round(rect?.height || boardEl?.offsetHeight || DEFAULT_CANVAS_HEIGHT));
    return { width, height };
}

/**
 * Browser-only production Web 2.5D board connection.
 *
 * This bridge swaps the legacy 2D board DOM for the Web 2.5D canvas
 * only when BoardPresentationState.viewMode is WORLD_2_5D. It consumes the same
 * BoardPresentationData read model and never reads GameState directly.
 */
export function attachWeb25DBoardRuntime(uiController, {
    boardElementId = 'gridBoard'
} = {}) {
    if (!uiController || typeof document === 'undefined') return null;
    if (uiController.web25DBoardRuntime) return uiController.web25DBoardRuntime;
    if (uiController.web25DValidationRuntime) return uiController.web25DValidationRuntime;
    if (!uiController.boardPresentationState || typeof uiController.getBoardPresentationData !== 'function') {
        throw new Error('WEB25D_PRESENTATION_BOUNDARY_REQUIRED');
    }
    const boardInputRuntime = uiController.boardPresentationRuntimeBridge;
    if (!boardInputRuntime || typeof boardInputRuntime.dispatchInput !== 'function') {
        throw new Error('WEB25D_INPUT_RUNTIME_REQUIRED');
    }

    const boardEl = document.getElementById(boardElementId);
    if (!boardEl || !boardEl.parentNode) return null;

    const initialSize = resolveCanvasSize(boardEl);
    const canvas = document.createElement('canvas');
    canvas.id = 'web25dValidationCanvas';
    canvas.width = initialSize.width;
    canvas.height = initialSize.height;
    canvas.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    boardEl.parentNode.insertBefore(canvas, boardEl.nextSibling);

    const rendererBridge = boardInputRuntime.rendererBridge || null;

    let runtime = null;
    const dispatchBridge = {
        dispatch(command) {
            const result = boardInputRuntime.dispatchInput(command);
            runtime?.sync?.();
            return result;
        }
    };

    const renderer = new Web25DPhaseFRenderer({
        canvas,
        bridge: dispatchBridge,
        projectionAdapter: new Web25DProjectionAdapter(resolveWeb25DViewportProjection({
            width: initialSize.width,
            height: initialSize.height,
            rows: 5,
            columns: 5
        })),
        showCoordinates: true,
        showElevationLabels: false
    });

    runtime = {
        canvas,
        renderer,
        rendererBridge,
        viewportSize: Object.freeze({ ...initialSize }),
        sync() {
            const presentation = uiController.getBoardPresentationData();
            const active = presentation?.presentation?.viewMode === BOARD_VIEW_MODES.WORLD_2_5D;

            if (active) {
                const browserSettings = (typeof globalThis !== 'undefined')
                    ? globalThis.gameSettings
                    : null;
                renderer.showCoordinates = browserSettings?.get?.('showBoardCoordinates') !== false;

                const size = this.viewportSize;
                if (canvas.width !== size.width) canvas.width = size.width;
                if (canvas.height !== size.height) canvas.height = size.height;
                renderer.projection = new Web25DProjectionAdapter(resolveWeb25DViewportProjection({
                    width: size.width,
                    height: size.height,
                    rows: presentation?.board?.rows,
                    columns: presentation?.board?.columns
                }));
                boardEl.hidden = true;
                canvas.hidden = false;
                canvas.setAttribute('aria-hidden', 'false');
                renderer.bind();
                renderer.setReadModel(presentation);
            } else {
                renderer.unbind();
                canvas.hidden = true;
                canvas.setAttribute('aria-hidden', 'true');
                boardEl.hidden = false;
            }

            return presentation;
        },
        destroy() {
            renderer.unbind();
            canvas.remove();
            boardEl.hidden = false;
            delete uiController.web25DBoardRuntime;
            delete uiController.web25DValidationRuntime;
        }
    };

    uiController.web25DBoardRuntime = runtime;
    // Deprecated compatibility alias for older browser/bootstrap callers.
    uiController.web25DValidationRuntime = runtime;

    const baseRender = uiController.render?.bind(uiController);
    if (baseRender) {
        uiController.render = (...args) => {
            const result = baseRender(...args);
            runtime.sync();
            return result;
        };
    }

    const baseSetViewMode = uiController.setBoardViewMode?.bind(uiController);
    if (baseSetViewMode) {
        uiController.setBoardViewMode = mode => {
            const result = baseSetViewMode(mode);
            runtime.sync();
            return result;
        };
    }

    const baseToggleViewMode = uiController.toggleBoardViewMode?.bind(uiController);
    if (baseToggleViewMode) {
        uiController.toggleBoardViewMode = () => {
            const result = baseToggleViewMode();
            runtime.sync();
            return result;
        };
    }

    runtime.sync();
    return runtime;
}

export default attachWeb25DBoardRuntime;
