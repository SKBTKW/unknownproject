export class TrialRestoreBoundaryService {
    constructor(engine) {
        if (!engine) throw new TypeError('TRIAL_RESTORE_BOUNDARY_ENGINE_REQUIRED');
        this.engine = engine;
        this.boundary = null;
    }

    begin(startVerse = this.engine.state?.turn) {
        if (!Number.isInteger(startVerse) || startVerse < 1) {
            throw new TypeError('TRIAL_RESTORE_START_VERSE_REQUIRED');
        }
        if (this.boundary?.active) {
            return this.getState();
        }
        this.boundary = Object.freeze({
            active: true,
            startVerse
        });
        return this.getState();
    }

    end() {
        const previous = this.getState();
        this.boundary = null;
        return previous;
    }

    isActive() {
        return Boolean(this.boundary?.active);
    }

    getStartVerse() {
        return this.isActive() ? this.boundary.startVerse : null;
    }

    resolveRestoreVerse(requestedVerse) {
        if (!Number.isInteger(requestedVerse) || requestedVerse < 1) {
            throw new TypeError('HISTORY_RESTORE_VERSE_REQUIRED');
        }
        return this.isActive() ? this.boundary.startVerse : requestedVerse;
    }

    getState() {
        return this.boundary
            ? { active: true, startVerse: this.boundary.startVerse }
            : { active: false, startVerse: null };
    }
}

export default TrialRestoreBoundaryService;
