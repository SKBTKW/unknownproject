import { boardCameraSystem } from './board_camera_system.js';
import { focusLayerManager } from './focus_layer_system.js';
import { tooltipSystemInstance } from './tooltip_system.js';
import { LogComponent } from './log_component.js';

/** Dev presentation boundary. All historical state changes belong to HistoryRestoreService. */
export class ChronicleRestoreController {
    constructor(ui, { confirm = message => window.confirm(message), onError = () => {}, onResult = () => {}, i18n } = {}) {
        this.ui = ui;
        this.confirm = confirm;
        this.onError = onError;
        this.onResult = onResult;
        this.i18n = i18n;
    }

    requestRestore(verse) {
        const engine = this.ui.engine;
        if (!Number.isInteger(verse) || !engine.historySnapshotService?.getRestorePoint?.(verse)) {
            this.onError(this.i18n.t('DEV_CHRONICLE_RESTORE_FAILED'));
            return { success: false, reason: 'HISTORY_RESTORE_POINT_NOT_FOUND' };
        }
        const mappedVerse = engine.trialRestoreBoundaryService?.resolveRestoreVerse?.(verse) ?? verse;
        const title = this.ui.devChronicleRestore?.getEntryTitle?.(verse) || this.i18n.t('DEV_CHRONICLE_VERSE', { verse });
        const mapping = mappedVerse !== verse
            ? this.i18n.t('DEV_CHRONICLE_TRIAL_MAPPING', { restored: mappedVerse }) : '';
        if (!this.confirm(this.i18n.t('DEV_CHRONICLE_RESTORE_CONFIRM', { verse, title, mapping, restored: mappedVerse }))) {
            return { success: false, reason: 'CANCELLED' };
        }
        try {
            const result = engine.historyRestoreService.restoreVerse(verse, {
                render: () => {
                    this.reconcileView();
                    this.ui.render();
                }
            });
            if (!result.success) {
                console.error('[Dev Chronicle Restore]', result.reason);
                this.onError(this.i18n.t('DEV_CHRONICLE_RESTORE_FAILED'));
                return result;
            }
            this.onResult(result);
            return result;
        } catch (error) {
            console.error('[Dev Chronicle Restore]', error);
            this.onError(this.i18n.t('DEV_CHRONICLE_RESTORE_FAILED'));
            return { success: false, reason: 'HISTORY_RESTORE_EXCEPTION', error };
        }
    }

    /** Reset presentation-only state after core restore; never advance or change GameState. */
    reconcileView() {
        const ui = this.ui;
        ui.interactionState?.reset();
        if (ui.developmentTrialPreviewHarness) ui.developmentTrialPreviewHarness.session = null;
        ui.trialPreviewConfig = null;
        if (ui.trialController) ui.trialController.state = null;
        ui.trialPresentationState?.resetForRestore();
        LogComponent.importStateLogs(ui.engine.state, { render: false });
        ui.layoutStateManager?.prepareRestoreView();
        ui.advisorDockComponent?.prepareRestoreView();
        ui.isMinimalMode = true;
        focusLayerManager.isCardSelected = false;
        focusLayerManager.isHandHovered = false;
        focusLayerManager.isBoardHovered = false;
        if (typeof document !== 'undefined') {
            focusLayerManager.resetToNeutral();
            ui.closeDirectiveModal?.();
            ui.hideCardActionHintPopover?.();
            const hoverPreview = document.getElementById('cardHoverPreviewModal');
            hoverPreview?.classList.remove('active');
        }
        ui.hideCellTooltip?.();
        tooltipSystemInstance?.hide?.();
        if (boardCameraSystem.isDragging || boardCameraSystem.isPendingDrag) boardCameraSystem.endDrag();
        // Pan/zoom and persisted layout preferences are intentionally untouched.
    }
}

export default ChronicleRestoreController;
