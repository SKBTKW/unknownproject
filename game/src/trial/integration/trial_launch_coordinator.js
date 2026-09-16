function normalizeTrialIndex(value) {
    const normalized = Math.floor(Number(value));
    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new TypeError("TRIAL_LAUNCH_INDEX_INVALID");
    }
    return normalized;
}

/**
 * Presentation-side coordinator for consuming a pending Trial due request.
 *
 * Responsibilities are intentionally narrow:
 * - read one semantic pending request (Trial index only)
 * - respect presentation blockers before building anything
 * - obtain authoritative Enemy Truth
 * - build the production Trial scenario
 * - start the Trial UI/session
 * - acknowledge the due request only after a successful start
 *
 * Exact schedule/countdown data never enters this boundary. Enemy truth and
 * route/scenario policy remain injected production dependencies. If any of
 * those dependencies are unavailable, launch fails closed and the due request
 * remains pending for a later retry.
 */
export class TrialLaunchCoordinator {
    constructor({
        dueStateService,
        enemyTruthReadModel,
        scenarioFactory,
        startTrialSession,
        isTrialActive = () => false,
        isPresentationBlocked = () => false
    } = {}) {
        if (!dueStateService
            || typeof dueStateService.getPendingRequest !== "function"
            || typeof dueStateService.acknowledgePending !== "function") {
            throw new TypeError("TRIAL_LAUNCH_DUE_STATE_SERVICE_REQUIRED");
        }
        if (!enemyTruthReadModel || typeof enemyTruthReadModel.getSnapshot !== "function") {
            throw new TypeError("TRIAL_LAUNCH_ENEMY_TRUTH_READ_MODEL_REQUIRED");
        }
        if (!scenarioFactory || typeof scenarioFactory.build !== "function") {
            throw new TypeError("TRIAL_LAUNCH_SCENARIO_FACTORY_REQUIRED");
        }
        if (typeof startTrialSession !== "function") {
            throw new TypeError("TRIAL_LAUNCH_SESSION_START_REQUIRED");
        }
        if (typeof isTrialActive !== "function") {
            throw new TypeError("TRIAL_LAUNCH_ACTIVE_PREDICATE_REQUIRED");
        }
        if (typeof isPresentationBlocked !== "function") {
            throw new TypeError("TRIAL_LAUNCH_BLOCKER_PREDICATE_REQUIRED");
        }

        this.dueStateService = dueStateService;
        this.enemyTruthReadModel = enemyTruthReadModel;
        this.scenarioFactory = scenarioFactory;
        this.startTrialSession = startTrialSession;
        this.isTrialActive = isTrialActive;
        this.isPresentationBlocked = isPresentationBlocked;
        this.launchInFlight = false;
    }

    tryStartPending({ gameState } = {}) {
        if (this.launchInFlight) {
            return { started: false, reason: "TRIAL_LAUNCH_IN_FLIGHT" };
        }

        const pending = this.dueStateService.getPendingRequest();
        if (!pending) {
            return { started: false, reason: "TRIAL_LAUNCH_NOT_DUE" };
        }

        const trialIndex = normalizeTrialIndex(pending.trialIndex);
        if (this.isTrialActive()) {
            return { started: false, reason: "TRIAL_LAUNCH_ALREADY_ACTIVE", trialIndex };
        }
        if (this.isPresentationBlocked()) {
            return { started: false, reason: "TRIAL_LAUNCH_PRESENTATION_BLOCKED", trialIndex };
        }
        if (!gameState) {
            return { started: false, reason: "TRIAL_LAUNCH_GAME_STATE_REQUIRED", trialIndex };
        }

        this.launchInFlight = true;
        try {
            const enemyTruth = this.enemyTruthReadModel.getSnapshot();
            if (!enemyTruth || enemyTruth.trialIndex !== trialIndex) {
                return { started: false, reason: "TRIAL_LAUNCH_ENEMY_TRUTH_UNAVAILABLE", trialIndex };
            }

            const built = this.scenarioFactory.build({
                trialIndex,
                gameState,
                enemyTruth
            });
            if (!built?.success || !built.scenario) {
                return {
                    started: false,
                    reason: "TRIAL_LAUNCH_SCENARIO_BUILD_FAILED",
                    trialIndex,
                    errors: Array.isArray(built?.errors) ? [...built.errors] : []
                };
            }

            const sessionState = this.startTrialSession(built.scenario, {
                source: "TRIAL_DUE",
                trialIndex
            });
            if (sessionState === false || sessionState === null || sessionState === undefined) {
                return { started: false, reason: "TRIAL_LAUNCH_SESSION_START_FAILED", trialIndex };
            }

            const acknowledged = this.dueStateService.acknowledgePending(trialIndex);
            if (!acknowledged?.success) {
                throw new Error(acknowledged?.reason || "TRIAL_LAUNCH_ACK_FAILED");
            }

            return {
                started: true,
                trialIndex,
                scenario: built.scenario,
                sessionState
            };
        } finally {
            this.launchInFlight = false;
        }
    }
}

export default TrialLaunchCoordinator;
