import { TrialSessionBoundaryService } from "../flow/trial_session_boundary_service.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const restoreBoundary = {
    boundary: null,
    begin(startVerse) {
        if (this.boundary?.active) return this.getState();
        this.boundary = { active: true, startVerse };
        return this.getState();
    },
    end() {
        const previous = this.getState();
        this.boundary = null;
        return previous;
    },
    getState() {
        return this.boundary
            ? { active: true, startVerse: this.boundary.startVerse }
            : { active: false, startVerse: null };
    },
    resolveRestoreVerse(requestedVerse) {
        return this.boundary?.active ? this.boundary.startVerse : requestedVerse;
    }
};

const engine = { state: { turn: 15 }, trialRestoreBoundaryService: null };
const service = new TrialSessionBoundaryService(engine, {
    restoreBoundaryService: restoreBoundary
});

const started = service.beginTrial();
assert(started.success, "Trial session boundary must start");
assert(service.getState().active === true, "restore boundary must be active during Trial");
assert(service.getState().startVerse === 15, "Trial boundary must capture start Verse");
assert(restoreBoundary.resolveRestoreVerse(22) === 15, "in-Trial restore must clamp to Trial start Verse");

const premature = service.releaseAfterSettlement({
    resultReady: true,
    settlementConsumed: false,
    canExitTrial: false
});
assert(premature.success === false, "restore boundary must survive before formal settlement");
assert(service.getState().active === true, "premature release must not end boundary");

const released = service.releaseAfterSettlement({
    resultReady: true,
    settlementConsumed: true,
    canExitTrial: true
});
assert(released.success, "settled Trial must release restore boundary");
assert(service.getState().active === false, "restore boundary must end after settlement");
assert(restoreBoundary.resolveRestoreVerse(22) === 22, "post-Trial restore must honor requested Verse");

service.beginTrial({ startVerse: 30 });
const aborted = service.abortTrial();
assert(aborted.success, "aborted Trial must release restore boundary");
assert(service.getState().active === false, "aborted Trial must not leak restore boundary");

console.log("PASS: Trial session boundary owns restore lifetime independently from UI/Layout");
