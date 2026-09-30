function requireLifecycleService(service) {
    const required = [
        "openOpportunity",
        "declineOpportunity",
        "commitOpportunity",
        "resolveFortune",
        "finalizeFortune"
    ];
    if (!service || required.some(method => typeof service[method] !== "function")) {
        throw new TypeError("BATTLE_OPPORTUNITY_FORTUNE_LIFECYCLE_SERVICE_REQUIRED");
    }
    return service;
}

function requireSequenceService(service) {
    if (!service || typeof service.completeCurrentBattle !== "function") {
        throw new TypeError("TRIAL_BATTLE_SEQUENCE_SERVICE_REQUIRED");
    }
    return service;
}

function defaultSequenceResultProjector({ baseCombatResult, snapshot }) {
    if (!snapshot?.finalCombatResult) return baseCombatResult;
    return {
        ...baseCombatResult,
        finalCombatResult: snapshot.finalCombatResult,
        opportunity: snapshot.opportunity ?? null,
        emberCommit: snapshot.emberCommit ?? null,
        fortuneRoll: snapshot.fortuneRoll ?? null,
        decisiveEvent: snapshot.decisiveEvent ?? null
    };
}

/**
 * Thin runtime adapter between TrialController and the canonical
 * BattleOpportunityFortuneLifecycleService.
 *
 * It does not decide Opportunity eligibility, Ember cost, Fortune meaning,
 * Decisive Event selection, or battle causality. Those remain owned by the
 * injected lifecycle policies / immutable BattleResolutionSnapshot.
 *
 * The bridge only controls the ordering boundary that was lost from the
 * controller path: a battle must not be completed in BattleSequence while an
 * Opportunity is pending.
 */
export class BattleOpportunityFortuneRuntimeBridge {
    constructor({
        lifecycleService,
        sequenceService,
        sequenceResultProjector = defaultSequenceResultProjector
    } = {}) {
        this.lifecycleService = requireLifecycleService(lifecycleService);
        this.sequenceService = requireSequenceService(sequenceService);
        if (typeof sequenceResultProjector !== "function") {
            throw new TypeError("BATTLE_SEQUENCE_RESULT_PROJECTOR_REQUIRED");
        }
        this.sequenceResultProjector = sequenceResultProjector;
    }

    open({ snapshot, combatResult }) {
        const opened = this.lifecycleService.openOpportunity(snapshot);
        if (opened.available === true) {
            return Object.freeze({
                success: true,
                pending: true,
                completed: false,
                snapshot: opened.snapshot,
                combatResult
            });
        }
        return Object.freeze({
            success: true,
            pending: false,
            completed: false,
            snapshot: opened.snapshot,
            combatResult
        });
    }

    decline({ trialState, snapshot, combatResult }) {
        const finalizedSnapshot = this.lifecycleService.declineOpportunity(snapshot);
        return this.#complete({ trialState, snapshot: finalizedSnapshot, combatResult });
    }

    commit({ snapshot }) {
        return this.lifecycleService.commitOpportunity(snapshot);
    }

    resolveFortune({ snapshot }) {
        return this.lifecycleService.resolveFortune(snapshot);
    }

    finalizeFortune({ trialState, snapshot, combatResult }) {
        const finalizedSnapshot = this.lifecycleService.finalizeFortune(snapshot);
        return this.#complete({ trialState, snapshot: finalizedSnapshot, combatResult });
    }

    completeWithoutOpportunity({ trialState, snapshot, combatResult }) {
        return this.#complete({ trialState, snapshot, combatResult });
    }

    #complete({ trialState, snapshot, combatResult }) {
        const sequenceCombatResult = this.sequenceResultProjector({
            snapshot,
            baseCombatResult: combatResult
        });
        const completionResult = this.sequenceService.completeCurrentBattle(
            trialState,
            sequenceCombatResult
        );
        if (!completionResult?.success) return completionResult;
        return Object.freeze({
            success: true,
            pending: false,
            completed: true,
            snapshot,
            sequenceCombatResult,
            completionResult
        });
    }
}

export default BattleOpportunityFortuneRuntimeBridge;
