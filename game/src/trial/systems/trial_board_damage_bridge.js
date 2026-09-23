import { GAME_FACT_TYPES } from "../../core/game_fact.js";
import { BoardDamageService } from "../../core/board_damage_service.js";
import { TrialBoardDamagePolicy } from "./trial_board_damage_policy.js";

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function trialKey(payload = {}) {
    return `${Number.isInteger(payload.trialIndex) ? payload.trialIndex : "NA"}::${payload.scenarioId || "NA"}`;
}
function battleKey(payload = {}) {
    return [
        trialKey(payload),
        Number.isInteger(payload.battleIndex) ? payload.battleIndex : "NA",
        payload.routeId || "NA",
        payload.interceptCell?.r ?? "NA",
        payload.interceptCell?.c ?? "NA"
    ].join("::");
}

export class TrialBoardDamageBridge {
    constructor({ gameFactHub, state, boardDamageService = null, policy = null } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("TRIAL_BOARD_DAMAGE_FACT_HUB_REQUIRED");
        }
        if (!state) throw new TypeError("TRIAL_BOARD_DAMAGE_STATE_REQUIRED");

        this.gameFactHub = gameFactHub;
        this.state = state;
        this.boardDamageService = boardDamageService || new BoardDamageService({ state });
        this.policy = policy || new TrialBoardDamagePolicy();
        this.pending = new Map();
        this.unsubscribe = gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact) return;
        if (fact.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED) {
            this._stage(fact.payload || {});
            return;
        }
        if (fact.type === GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) {
            this._commit(fact.payload || {});
        }
    }

    _stage(payload) {
        const r = payload?.interceptCell?.r;
        const c = payload?.interceptCell?.c;
        if (!Number.isInteger(r) || !Number.isInteger(c)) return;
        if (!Number.isInteger(payload.trialIndex) || !payload.scenarioId) return;

        const cell = this.state?.grid?.[r]?.[c] || null;
        const decision = this.policy.resolve({ battle: payload, cell });
        if (!decision?.shouldRecord || !Array.isArray(decision.targets) || decision.targets.length === 0) {
            return;
        }

        this.pending.set(battleKey(payload), Object.freeze(clone({
            battle: payload,
            targets: decision.targets,
            reason: decision.reason || null
        })));
    }

    _commit(payload) {
        if (!Number.isInteger(payload.trialIndex) || !payload.scenarioId) return;
        const key = trialKey(payload);
        const entries = [...this.pending.entries()]
            .filter(([, item]) => trialKey(item?.battle) === key);

        for (const [pendingKey, item] of entries) {
            const battle = item.battle;
            const r = battle.interceptCell.r;
            const c = battle.interceptCell.c;

            for (const target of item.targets) {
                this.boardDamageService.recordDamage({
                    r,
                    c,
                    target,
                    source: {
                        type: "TRIAL_BATTLE",
                        trialIndex: battle.trialIndex,
                        scenarioId: battle.scenarioId,
                        battleIndex: battle.battleIndex
                    },
                    metadata: {
                        routeId: battle.routeId || null,
                        outcome: battle.outcome || null,
                        margin: Number.isFinite(battle.margin) ? battle.margin : null,
                        policyReason: item.reason,
                        settledOutcome: payload.outcome || null,
                        settledTurn: Number.isInteger(payload.turn) ? payload.turn : null
                    }
                });
            }

            this.pending.delete(pendingKey);
        }
    }

    getPendingDamage() {
        return [...this.pending.values()].map(clone);
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default TrialBoardDamageBridge;
