/* =============================================================
   game/src/core/board_battle_site_recorder.js
   Board-owned persistence bridge for settled Trial battle sites.

   Battle resolution facts are staged only. Board history is mutated only when
   the owning Trial emits TRIAL_RESULT_SETTLED.
   ============================================================= */

import { GAME_FACT_TYPES } from "./game_fact.js";

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function validCellRef(value) {
    return Number.isInteger(value?.r) && Number.isInteger(value?.c);
}

function trialKey({ trialIndex = null, scenarioId = null } = {}) {
    return `${Number.isInteger(trialIndex) ? trialIndex : "NA"}::${scenarioId || "NA"}`;
}

function battleKey(battle) {
    return [
        trialKey(battle),
        Number.isInteger(battle?.battleIndex) ? battle.battleIndex : "NA",
        battle?.routeId || "NA",
        battle?.interceptCell?.r ?? "NA",
        battle?.interceptCell?.c ?? "NA"
    ].join("::");
}

function battleSiteId(battle) {
    return [
        "BATTLE_SITE",
        Number.isInteger(battle?.trialIndex) ? battle.trialIndex : "NA",
        battle?.scenarioId || "NA",
        Number.isInteger(battle?.battleIndex) ? battle.battleIndex : "NA",
        battle?.interceptCell?.r ?? "NA",
        battle?.interceptCell?.c ?? "NA"
    ].join("@");
}

function hasEntityId(cell, id) {
    return Array.isArray(cell?.entities) && cell.entities.some(entity => entity?.id === id);
}

export class BoardBattleSiteRecorder {
    constructor({ gameFactHub, state } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("BOARD_BATTLE_SITE_FACT_HUB_REQUIRED");
        }
        if (!state) {
            throw new TypeError("BOARD_BATTLE_SITE_STATE_REQUIRED");
        }
        this.gameFactHub = gameFactHub;
        this.state = state;
        this.pendingBattles = new Map();
        this.unsubscribe = gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact) return;
        if (fact.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED) {
            this._stageBattle(fact.payload || {});
            return;
        }
        if (fact.type === GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) {
            this._commitSettledTrial(fact.payload || {});
        }
    }

    _stageBattle(payload) {
        if (!validCellRef(payload.interceptCell)) return;
        if (!Number.isInteger(payload.trialIndex) || !payload.scenarioId) return;

        const snapshot = Object.freeze(cloneData({
            trialIndex: payload.trialIndex,
            scenarioId: payload.scenarioId,
            battleIndex: Number.isInteger(payload.battleIndex) ? payload.battleIndex : null,
            routeId: payload.routeId || null,
            interceptCell: payload.interceptCell,
            outcome: payload.outcome || null,
            playerActualPower: Number.isFinite(payload.playerActualPower)
                ? Number(payload.playerActualPower)
                : null,
            enemyActualPower: Number.isFinite(payload.enemyActualPower)
                ? Number(payload.enemyActualPower)
                : null,
            margin: Number.isFinite(payload.margin) ? Number(payload.margin) : null
        }, {}));

        this.pendingBattles.set(battleKey(snapshot), snapshot);
    }

    _commitSettledTrial(payload) {
        if (!Number.isInteger(payload.trialIndex) || !payload.scenarioId) return;

        const key = trialKey(payload);
        const candidates = [...this.pendingBattles.values()]
            .filter(battle => trialKey(battle) === key);

        for (const battle of candidates) {
            this._persistBattleSite(battle, payload);
            this.pendingBattles.delete(battleKey(battle));
        }
    }

    _persistBattleSite(battle, settlementPayload) {
        const { r, c } = battle.interceptCell;
        const cell = this.state?.grid?.[r]?.[c] || null;
        if (!cell || !cell.placed || cell.isHQ) return false;

        const id = battleSiteId(battle);
        if (hasEntityId(cell, id)) return false;

        if (!Array.isArray(cell.entities)) cell.entities = [];
        cell.entities.push(Object.freeze({
            id,
            type: "BATTLE_SITE",
            entityType: "BATTLE_SITE",
            trialIndex: battle.trialIndex,
            scenarioId: battle.scenarioId,
            battleIndex: battle.battleIndex,
            routeId: battle.routeId,
            outcome: battle.outcome,
            trialOutcome: settlementPayload.outcome || null,
            settledTurn: Number.isInteger(settlementPayload.turn)
                ? settlementPayload.turn
                : null
        }));
        return true;
    }

    getPendingBattles() {
        return [...this.pendingBattles.values()].map(value => cloneData(value));
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default BoardBattleSiteRecorder;
