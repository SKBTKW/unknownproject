export const FIRST_RUN_ACTIVATION_SCHEMA_VERSION = 1;
export const FIRST_RUN_ACTIVATION_STORAGE_KEY = "TOA_FIRST_RUN_ACTIVATION_V1";

function resolveBrowserStorage() {
    try {
        return typeof globalThis !== "undefined" ? (globalThis.localStorage || null) : null;
    } catch {
        return null;
    }
}

function completedRecord() {
    return {
        schemaVersion: FIRST_RUN_ACTIVATION_SCHEMA_VERSION,
        completed: true
    };
}

/**
 * Browser-owned persistence boundary for deciding whether a newly created Run
 * should enable FirstRun orchestration.
 *
 * Absence/corruption/unavailability deliberately fails open to FirstRun so a
 * player never loses the tutorial because storage could not be read.
 */
export class BrowserFirstRunActivationStore {
    constructor({
        storage = resolveBrowserStorage(),
        storageKey = FIRST_RUN_ACTIVATION_STORAGE_KEY
    } = {}) {
        this.storage = storage || null;
        this.storageKey = storageKey;
    }

    getStatus() {
        if (!this.storage || typeof this.storage.getItem !== "function") {
            return Object.freeze({
                completed: false,
                reason: "STORAGE_UNAVAILABLE"
            });
        }

        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) {
                return Object.freeze({
                    completed: false,
                    reason: "COMPLETION_MARKER_MISSING"
                });
            }

            const parsed = JSON.parse(raw);
            const completed = parsed?.schemaVersion === FIRST_RUN_ACTIVATION_SCHEMA_VERSION
                && parsed?.completed === true;
            return Object.freeze({
                completed,
                reason: completed ? "COMPLETED" : "COMPLETION_MARKER_INVALID"
            });
        } catch {
            return Object.freeze({
                completed: false,
                reason: "STORAGE_READ_FAILED"
            });
        }
    }

    isFirstRun() {
        return this.getStatus().completed !== true;
    }

    markCompleted() {
        if (!this.storage || typeof this.storage.setItem !== "function") {
            return Object.freeze({
                success: false,
                reason: "STORAGE_UNAVAILABLE"
            });
        }

        try {
            this.storage.setItem(this.storageKey, JSON.stringify(completedRecord()));
            return Object.freeze({
                success: true,
                completed: true
            });
        } catch {
            return Object.freeze({
                success: false,
                reason: "STORAGE_WRITE_FAILED"
            });
        }
    }
}

export default BrowserFirstRunActivationStore;
