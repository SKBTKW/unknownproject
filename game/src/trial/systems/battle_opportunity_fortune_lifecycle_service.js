import { evolveBattleResolutionSnapshot } from "../domain/battle_resolution_snapshot.js";
import {
    BATTLE_RESOLUTION_PHASES,
    BATTLE_RESOLUTION_ERRORS
} from "../domain/battle_resolution_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function requireSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
        throw new TypeError(BATTLE_RESOLUTION_ERRORS.SNAPSHOT_REQUIRED);
    }
    if (!snapshot.normalOutcome || typeof snapshot.normalOutcome !== "object") {
        throw new TypeError(BATTLE_RESOLUTION_ERRORS.NORMAL_OUTCOME_REQUIRED);
    }
}

function requirePolicy(policy, method, code) {
    if (!policy || typeof policy[method] !== "function") {
        throw new TypeError(code);
    }
    return policy;
}

function validateCost(cost) {
    const normalized = Number(cost);
    if (!Number.isFinite(normalized) || normalized < 0) {
        throw new TypeError(BATTLE_RESOLUTION_ERRORS.INVALID_EMBER_COST);
    }
    return normalized;
}

function requireOpportunityPending(snapshot) {
    if (snapshot.resolutionPhase !== BATTLE_RESOLUTION_PHASES.OPPORTUNITY_PENDING) {
        throw new Error(BATTLE_RESOLUTION_ERRORS.OPPORTUNITY_NOT_PENDING);
    }
    if (!snapshot.opportunity || typeof snapshot.opportunity !== "object") {
        throw new Error(BATTLE_RESOLUTION_ERRORS.OPPORTUNITY_NOT_PENDING);
    }
    if (snapshot.opportunity.declined === true || snapshot.opportunity.state === "DECLINED") {
        throw new Error(BATTLE_RESOLUTION_ERRORS.OPPORTUNITY_DECLINED);
    }
    if (snapshot.opportunity.resolved === true || snapshot.opportunity.state === "RESOLVED") {
        throw new Error(BATTLE_RESOLUTION_ERRORS.OPPORTUNITY_ALREADY_RESOLVED);
    }
}

/**
 * Orchestrates the Opportunity / Ember / Fortune lifecycle without owning any
 * balance semantics.
 *
 * Policy dependencies decide:
 * - whether/what Opportunity exists
 * - Ember cost
 * - how a persisted 2D6 roll maps to a Fortune result
 * - Decisive Event selection
 * - Final Combat Result projection
 *
 * This service owns ordering, single-use guards, canonical Gameplay RNG use,
 * Ember payment, and immutable BattleResolutionSnapshot evolution only.
 */
export class BattleOpportunityFortuneLifecycleService {
    constructor({
        opportunityPolicy = null,
        emberCostPolicy = null,
        fortuneResultPolicy = null,
        decisiveEventPolicy = null,
        finalResultPolicy = null,
        emberSystem = null,
        gameplayRandom = null
    } = {}) {
        this.opportunityPolicy = opportunityPolicy;
        this.emberCostPolicy = emberCostPolicy;
        this.fortuneResultPolicy = fortuneResultPolicy;
        this.decisiveEventPolicy = decisiveEventPolicy;
        this.finalResultPolicy = finalResultPolicy;
        this.emberSystem = emberSystem;
        this.gameplayRandom = gameplayRandom;
    }

    openOpportunity(snapshot) {
        requireSnapshot(snapshot);
        if (snapshot.opportunity) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.OPPORTUNITY_ALREADY_RESOLVED);
        }
        const policy = requirePolicy(
            this.opportunityPolicy,
            "evaluate",
            BATTLE_RESOLUTION_ERRORS.OPPORTUNITY_NOT_PENDING
        );
        const evaluation = policy.evaluate(snapshot);
        if (!evaluation || evaluation.available !== true || !evaluation.opportunity) {
            return Object.freeze({
                success: true,
                available: false,
                snapshot
            });
        }

        const opportunity = cloneData(evaluation.opportunity);
        return Object.freeze({
            success: true,
            available: true,
            snapshot: evolveBattleResolutionSnapshot(snapshot, {
                opportunity,
                resolutionPhase: BATTLE_RESOLUTION_PHASES.OPPORTUNITY_PENDING,
                finalized: false
            })
        });
    }

    declineOpportunity(snapshot) {
        requireSnapshot(snapshot);
        requireOpportunityPending(snapshot);
        const finalPolicy = requirePolicy(
            this.finalResultPolicy,
            "projectDeclined",
            BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED
        );
        const finalCombatResult = finalPolicy.projectDeclined({
            snapshot,
            opportunity: snapshot.opportunity
        });
        if (!finalCombatResult || typeof finalCombatResult !== "object") {
            throw new TypeError(BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED);
        }

        const opportunity = {
            ...cloneData(snapshot.opportunity),
            state: "DECLINED",
            declined: true,
            resolved: true
        };
        return evolveBattleResolutionSnapshot(snapshot, {
            opportunity,
            finalCombatResult: cloneData(finalCombatResult),
            resolutionPhase: BATTLE_RESOLUTION_PHASES.FINALIZED,
            finalized: true
        });
    }

    commitOpportunity(snapshot) {
        requireSnapshot(snapshot);
        requireOpportunityPending(snapshot);
        if (snapshot.emberCommit) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.ALREADY_COMMITTED);
        }

        const costPolicy = requirePolicy(
            this.emberCostPolicy,
            "resolve",
            BATTLE_RESOLUTION_ERRORS.EMBER_POLICY_REQUIRED
        );
        const emberSystem = this.emberSystem;
        if (!emberSystem || typeof emberSystem.consume !== "function") {
            throw new TypeError(BATTLE_RESOLUTION_ERRORS.EMBER_SYSTEM_REQUIRED);
        }

        const emberCost = validateCost(costPolicy.resolve({
            snapshot,
            opportunity: snapshot.opportunity
        }));
        const emberBefore = Number(emberSystem.current);
        if (!Number.isFinite(emberBefore) || emberBefore < emberCost) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.INSUFFICIENT_EMBER);
        }

        // Build the immutable next state first. Ember is consumed only after
        // all validation/evolution work that can throw has succeeded.
        const emberCommit = Object.freeze({
            committed: true,
            cost: emberCost,
            emberBefore,
            emberAfter: emberBefore - emberCost,
            opportunityId: snapshot.opportunity.opportunityId ?? null
        });
        const nextSnapshot = evolveBattleResolutionSnapshot(snapshot, {
            emberCommit
        });

        if (!emberSystem.consume(emberCost)) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.INSUFFICIENT_EMBER);
        }
        return nextSnapshot;
    }

    resolveFortune(snapshot) {
        requireSnapshot(snapshot);
        requireOpportunityPending(snapshot);
        if (!snapshot.emberCommit?.committed) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.ALREADY_COMMITTED);
        }
        if (snapshot.fortuneRoll) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.FORTUNE_ALREADY_RESOLVED);
        }

        const rng = this.gameplayRandom;
        if (!rng || typeof rng.nextInt !== "function") {
            throw new TypeError(BATTLE_RESOLUTION_ERRORS.GAMEPLAY_RNG_REQUIRED);
        }
        const fortunePolicy = requirePolicy(
            this.fortuneResultPolicy,
            "resolve",
            BATTLE_RESOLUTION_ERRORS.FORTUNE_ALREADY_RESOLVED
        );
        const decisivePolicy = requirePolicy(
            this.decisiveEventPolicy,
            "select",
            BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED
        );
        const finalPolicy = requirePolicy(
            this.finalResultPolicy,
            "projectFortune",
            BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED
        );

        const die1 = rng.nextInt(1, 6);
        const die2 = rng.nextInt(1, 6);
        const total = die1 + die2;
        const fortuneResolution = fortunePolicy.resolve({
            snapshot,
            opportunity: snapshot.opportunity,
            dice: Object.freeze([die1, die2]),
            total
        });
        if (!fortuneResolution || typeof fortuneResolution !== "object") {
            throw new TypeError(BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED);
        }

        const decisiveEvent = decisivePolicy.select({
            snapshot,
            opportunity: snapshot.opportunity,
            fortuneResolution
        }) ?? null;
        const finalCombatResult = finalPolicy.projectFortune({
            snapshot,
            opportunity: snapshot.opportunity,
            fortuneResolution,
            decisiveEvent
        });
        if (!finalCombatResult || typeof finalCombatResult !== "object") {
            throw new TypeError(BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED);
        }

        const fortuneRoll = Object.freeze({
            die1,
            die2,
            dice: Object.freeze([die1, die2]),
            total,
            result: fortuneResolution.result ?? null,
            payload: cloneData(fortuneResolution.payload ?? {})
        });
        const opportunity = {
            ...cloneData(snapshot.opportunity),
            state: "RESOLVED",
            declined: false,
            resolved: true
        };
        return evolveBattleResolutionSnapshot(snapshot, {
            opportunity,
            fortuneRoll,
            decisiveEvent: cloneData(decisiveEvent),
            finalCombatResult: cloneData(finalCombatResult),
            resolutionPhase: BATTLE_RESOLUTION_PHASES.FORTUNE_RESOLVED,
            finalized: false
        });
    }

    finalizeFortune(snapshot) {
        requireSnapshot(snapshot);
        if (snapshot.resolutionPhase !== BATTLE_RESOLUTION_PHASES.FORTUNE_RESOLVED
            || !snapshot.fortuneRoll
            || !snapshot.finalCombatResult) {
            throw new Error(BATTLE_RESOLUTION_ERRORS.FINAL_RESULT_REQUIRED);
        }
        return evolveBattleResolutionSnapshot(snapshot, {
            resolutionPhase: BATTLE_RESOLUTION_PHASES.FINALIZED,
            finalized: true
        });
    }
}

export default BattleOpportunityFortuneLifecycleService;
