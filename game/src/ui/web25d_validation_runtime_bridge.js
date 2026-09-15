import { BOARD_VIEW_MODES } from '../presentation/board_presentation_state.js';
import { BoardRendererBridge } from '../presentation/board_renderer_bridge.js';
import { Web25DProjectionAdapter } from '../presentation/web25d_projection_adapter.js';
import { Web25DPhaseCRenderer } from '../presentation/web25d_phase_c_renderer.js';

const DEFAULT_CANVAS_WIDTH = 584;
const DEFAULT_CANVAS_HEIGHT = 584;
const DEFAULT_ORIGIN_Y = 56;

function resolveCanvasSize(boardEl) {
    const rect = boardEl?.getBoundingClientRect?.();
    const width = Math.max(1, Math.round(rect?.width || boardEl?.offsetWidth || DEFAULT_CANVAS_WIDTH));
    const height = Math.max(1, Math.round(rect?.height || boardEl?.offsetHeight || DEFAULT_CANVAS_HEIGHT));
    return { width, height };
}

/**
 * Browser-only Phase 2.5D validation connection.
 *
 * This bridge swaps the legacy 2D board DOM for the disposable Web 2.5D canvas
 * only when BoardPresentationState.viewMode is WORLD_2_5D. It consumes the same
 * BoardPresentationData read model and never reads GameState directly.
 */
export function attachWeb25DValidationRuntime(uiController, {
    boardElementId = 'gridBoard'
} = {}) {
    if (!uiController || typeof document === 'undefined') return null;
    if (uiController.web25DValidationRuntime) return uiController.web25DValidationRuntime;
    if (!uiController.boardPresentationState || typeof uiController.getBoardPresentationData !== 'function') {
        throw new Error('WEB25D_PRESENTATION_BOUNDARY_REQUIRED');
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

    const rendererBridge = new BoardRendererBridge({
        presentationState: uiController.boardPresentationState,
        inputHandlers: {
            selectCell: ({ cell }) => {
                if (!cell || typeof uiController.onCellClick !== 'function') return false;
                return uiController.onCellClick(cell.r, cell.c);
            },
            selectTrialInterception: (payload) => {
                if (payload?.cell) {
                    uiController.selectTrialInterceptionCell?.(payload.cell.r, payload.cell.c);
                }
            },
            selectTrialRoute: (payload) => {
                if (payload?.routeId) {
                    uiController.selectTrialRoute?.(payload.routeId);
                }
            }
        }
    });

    let runtime = null;
    const dispatchBridge = {
        dispatch(command) {
            const result = rendererBridge.dispatch(command);
            runtime?.sync?.({ preserveCanvasSize: true });
            return result;
        }
    };

    const renderer = new Web25DPhaseCRenderer({
        canvas,
        bridge: dispatchBridge,
        projectionAdapter: new Web25DProjectionAdapter({
            originX: initialSize.width / 2,
            originY: DEFAULT_ORIGIN_Y
        })
    });

    runtime = {
        canvas,
        renderer,
        rendererBridge,
        lastBoardSize: initialSize,
        sync({ preserveCanvasSize = false } = {}) {
            const presentation = uiController.getBoardPresentationData();
            const active = presentation?.presentation?.viewMode === BOARD_VIEW_MODES.WORLD_2_5D;

            if (!preserveCanvasSize && !active) {
                this.lastBoardSize = resolveCanvasSize(boardEl);
            }

            if (active) {
                const size = this.lastBoardSize || initialSize;
                if (canvas.width !== size.width) canvas.width = size.width;
                if (canvas.height !== size.height) canvas.height = size.height;
                renderer.projection = new Web25DProjectionAdapter({
                    originX: size.width / 2,
                    originY: DEFAULT_ORIGIN_Y
                });
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
            delete uiController.web25DValidationRuntime;
        }
    };

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

export default attachWeb25DValidationRuntime;
