import { TRIAL_PLAN_REASONS, TRIAL_BATTLE_STATUSES } from "../domain/trial_types.js";
import { GAME_FACT_TYPES } from "../../core/game_fact.js";

/**
 * Application orchestration for a Trial's battle and optional Fortune runtime.
 * Ports read current session/services; domain computation and lifecycle guards
 * remain in the existing resolvers, snapshot factory, sequence and bridge.
 * No payment, RNG, eligibility or presentation policy belongs here.
 */
export class TrialBattleCoordinator {
    constructor(ports) {
        this.ports = ports;
        this.battleResolutionSnapshots = [];
        this.battleOpportunityFortuneRuntime = null;
    }

    get state() { return this.ports.state; }
    get sequenceService() { return this.ports.sequenceService; }
    get combatResolver() { return this.ports.combatResolver; }
    get battleResolutionSnapshotFactory() { return this.ports.battleResolutionSnapshotFactory; }
    get battleOpportunityFortuneRuntimeBridge() { return this.ports.battleOpportunityFortuneRuntimeBridge; }
    get gameFactHub() { return this.ports.gameFactHub; }

    createRouteInterceptionInput(...args) {
        return this.ports.createRouteInterceptionInput(...args);
    }

    createBattleContext(input) {
        return this.ports.createBattleContext(input);
    }

    getBattleResolutionSnapshot(battleIndex) {
        if (!Number.isInteger(battleIndex) || battleIndex < 0) return null;
        return this.battleResolutionSnapshots?.[battleIndex] || null;
    }

    getCurrentBattleResolutionSnapshot() {
        const battleIndex = this.state?.currentBattleIndex;
        return Number.isInteger(battleIndex)
            ? this.getBattleResolutionSnapshot(battleIndex)
            : null;
    }

    startNextBattle() {
        const startResult = this.sequenceService.startNextBattle(this.state);
        if (!startResult.success) {
            return startResult;
        }

        // Emit GameFact
        const factPayload = {
            battleIndex: startResult.battleIndex,
            routeId: startResult.currentBattle.routeId,
            interceptCell: { r: startResult.currentBattle.interceptCell.r, c: startResult.currentBattle.interceptCell.c },
            defenseAllocation: startResult.currentBattle.defenseAllocation
        };
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_STARTED, factPayload);

        return startResult;
    }

    resolveCurrentBattle() {
        if (!this.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!this.state.planActivated) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }
        if (this.state.currentBattleIndex === null) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }
        if (!Array.isArray(this.state.battleQueue)) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN] };
        }

        const currentBattle = this.state.battleQueue[this.state.currentBattleIndex];
        if (!currentBattle || typeof currentBattle !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE] };
        }
        if (currentBattle.status === TRIAL_BATTLE_STATUSES.RESOLVED) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.BATTLE_ALREADY_RESOLVED] };
        }
        if (currentBattle.status !== TRIAL_BATTLE_STATUSES.ACTIVE) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE] };
        }

        // A live session runtime owns this battle until decline/finalize completes.
        // Guard before combat, snapshot creation and opportunity opening, including
        // committed/rolled Fortune states awaiting completion.
        if (this.battleOpportunityFortuneRuntime) {
            return { success: false, errors: ["BATTLE_OPPORTUNITY_FORTUNE_RUNTIME_PENDING"] };
        }

        // 1. Build combat input from current battle snapshot
        const interceptionInput = this.createRouteInterceptionInput(
            currentBattle.routeId,
            currentBattle.interceptCell,
            currentBattle.defenseAllocation
        );
        if (!interceptionInput.success) {
            return { success: false, errors: [interceptionInput.reason || TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE] };
        }

        // 2. Resolve combat via CombatResolver
        const context = this.createBattleContext({
            ...interceptionInput.input,
            skipAvailableCheck: true
        });
        const combatResult = this.combatResolver.resolve(context);
        if (!combatResult.success) {
            return { success: false, errors: [combatResult.reason || "COMBAT_RESOLUTION_FAILED"] };
        }

        // 3. Build the immutable Battle Resolution Snapshot before committing
        // the RESOLVED battle state. This keeps snapshot failure fail-closed and
        // prevents Presentation from reconstructing gameplay causality later.
        const battleIndex = this.state.currentBattleIndex;
        const scenarioId = this.state.scenarioId || "trial";
        const trialIndex = Number.isInteger(this.state.trialIndex) ? this.state.trialIndex : 1;
        const battleId = `${scenarioId}:trial:${trialIndex}:battle:${battleIndex}`;
        const battleResolutionSnapshot = this.battleResolutionSnapshotFactory.create({
            battleId,
            routeId: currentBattle.routeId,
            battleContext: context,
            combatResult,
            actions: [{
                actionId: `${battleId}:intercept`,
                type: "INTERCEPT",
                actor: "HUMAN",
                target: "ENEMY_FORCE",
                location: {
                    r: currentBattle.interceptCell.r,
                    c: currentBattle.interceptCell.c
                },
                timing: "CONTACT",
                provenance: {
                    source: "TRIAL_BATTLE_SEQUENCE",
                    scenarioId: this.state.scenarioId || null,
                    trialIndex,
                    battleIndex,
                    routeId: currentBattle.routeId
                }
            }]
        });

        this.battleResolutionSnapshots[battleIndex] = battleResolutionSnapshot;

        if (!this.battleOpportunityFortuneRuntimeBridge) {
            const completionResult = this.sequenceService.completeCurrentBattle(this.state, combatResult);
            if (!completionResult.success) return completionResult;
            this.#emitBattleResolvedFact({ currentBattle, combatResult, battleIndex });
            return {
                success: true,
                battleIndex,
                combatResult: completionResult.battleResult,
                battleResolutionSnapshot
            };
        }

        const opened = this.battleOpportunityFortuneRuntimeBridge.open({
            snapshot: battleResolutionSnapshot,
            combatResult
        });
        this.battleResolutionSnapshots[battleIndex] = opened.snapshot;
        this.battleOpportunityFortuneRuntime = {
            battleIndex,
            currentBattle,
            combatResult,
            snapshot: opened.snapshot
        };

        if (opened.pending) {
            return {
                success: true,
                pendingOpportunity: true,
                battleIndex,
                combatResult,
                battleResolutionSnapshot: opened.snapshot
            };
        }

        return this.#completeBattleOpportunityFortuneRuntime(
            this.battleOpportunityFortuneRuntimeBridge.completeWithoutOpportunity({
                trialState: this.state,
                snapshot: opened.snapshot,
                combatResult
            })
        );
    }

    getCurrentBattleOpportunityFortuneRuntime() {
        return this.battleOpportunityFortuneRuntime;
    }

    declineCurrentBattleOpportunity() {
        const runtime = this.#requireBattleOpportunityFortuneRuntime();
        return this.#completeBattleOpportunityFortuneRuntime(
            this.battleOpportunityFortuneRuntimeBridge.decline({
                trialState: this.state,
                snapshot: runtime.snapshot,
                combatResult: runtime.combatResult
            })
        );
    }

    commitCurrentBattleOpportunity() {
        const runtime = this.#requireBattleOpportunityFortuneRuntime();
        const snapshot = this.battleOpportunityFortuneRuntimeBridge.commit({ snapshot: runtime.snapshot });
        runtime.snapshot = snapshot;
        this.battleResolutionSnapshots[runtime.battleIndex] = snapshot;
        return { success: true, pendingOpportunity: true, battleIndex: runtime.battleIndex, battleResolutionSnapshot: snapshot };
    }

    resolveCurrentBattleFortune() {
        const runtime = this.#requireBattleOpportunityFortuneRuntime();
        const snapshot = this.battleOpportunityFortuneRuntimeBridge.resolveFortune({ snapshot: runtime.snapshot });
        runtime.snapshot = snapshot;
        this.battleResolutionSnapshots[runtime.battleIndex] = snapshot;
        return { success: true, pendingOpportunity: true, battleIndex: runtime.battleIndex, battleResolutionSnapshot: snapshot };
    }

    finalizeCurrentBattleFortune() {
        const runtime = this.#requireBattleOpportunityFortuneRuntime();
        return this.#completeBattleOpportunityFortuneRuntime(
            this.battleOpportunityFortuneRuntimeBridge.finalizeFortune({
                trialState: this.state,
                snapshot: runtime.snapshot,
                combatResult: runtime.combatResult
            })
        );
    }

    #requireBattleOpportunityFortuneRuntime() {
        if (!this.battleOpportunityFortuneRuntimeBridge || !this.battleOpportunityFortuneRuntime) {
            throw new Error("BATTLE_OPPORTUNITY_FORTUNE_RUNTIME_NOT_PENDING");
        }
        return this.battleOpportunityFortuneRuntime;
    }

    #completeBattleOpportunityFortuneRuntime(result) {
        if (!result?.success) return result;
        const runtime = this.#requireBattleOpportunityFortuneRuntime();
        runtime.snapshot = result.snapshot;
        this.battleResolutionSnapshots[runtime.battleIndex] = result.snapshot;
        this.#emitBattleResolvedFact({
            currentBattle: runtime.currentBattle,
            combatResult: runtime.combatResult,
            battleIndex: runtime.battleIndex
        });
        const response = {
            success: true,
            pendingOpportunity: false,
            battleIndex: runtime.battleIndex,
            combatResult: result.completionResult?.battleResult ?? result.sequenceCombatResult,
            battleResolutionSnapshot: result.snapshot
        };
        this.battleOpportunityFortuneRuntime = null;
        return response;
    }

    #emitBattleResolvedFact({ currentBattle, combatResult, battleIndex }) {
        this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
            scenarioId: this.state.scenarioId || null,
            trialIndex: this.state.trialIndex,
            battleIndex,
            routeId: currentBattle.routeId,
            interceptCell: { r: currentBattle.interceptCell.r, c: currentBattle.interceptCell.c },
            outcome: combatResult.prediction.outcome,
            playerActualPower: combatResult.human.finalPower,
            enemyActualPower: combatResult.enemy.finalPower,
            margin: combatResult.prediction.margin
        });
    }

}
