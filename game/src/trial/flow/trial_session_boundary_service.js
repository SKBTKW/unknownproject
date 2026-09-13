import { TrialRestoreBoundaryService } from "../../core/trial_restore_boundary_service.js";

export class TrialSessionBoundaryService {
    constructor(engine, { restoreBoundaryService = null } = {}) {
        if (!engine) throw new TypeError("TRIAL_SESSION_BOUNDARY_ENGINE_REQUIRED");
        this.engine = engine;
        this.restoreBoundaryService = restoreBoundaryService || engine.trialRestoreBoundaryService || new TrialRestoreBoundaryService(engine);
        this.engine.trialRestoreBoundaryService = this.restoreBoundaryService;
    }

    beginTrial({ startVerse = this.engine.state?.turn } = {}) {
        return { success: true, boundary: this.restoreBoundaryService.begin(startVerse) };
    }

    abortTrial() {
        return { success: true, boundary: this.restoreBoundaryService.end() };
    }

    releaseAfterSettlement(lifecycle) {
        if (!lifecycle?.resultReady || !lifecycle?.settlementConsumed || !lifecycle?.canExitTrial) {
            return { success: false, reason: "TRIAL_RESULT_NOT_RELEASE_READY", boundary: this.restoreBoundaryService.getState() };
        }
        return { success: true, boundary: this.restoreBoundaryService.end() };
    }

    getState() {
        return this.restoreBoundaryService.getState();
    }
}

export default TrialSessionBoundaryService;
