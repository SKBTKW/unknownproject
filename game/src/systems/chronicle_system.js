/* =============================================================
   game/src/systems/chronicle_system.js
   50ターンの歴史・出来事を3層重要度で統合記録する年代記システム (Pure & Unity Ready)
   ============================================================= */

import { GAME_FACT_TYPES } from '../core/game_fact.js';

export const CHRONICLE_IMPORTANCE = {
    MINOR: "MINOR",       // 👤 個人史 (通常マージ・通常資源発見・小規模出来事)
    MAJOR: "MAJOR",       // 🌍 ラン主要史 (大寒波・大防塁・亜人襲撃・好機イベント)
    HISTORIC: "HISTORIC"  // 🏛️ 人類史 (第1〜3の試練突破・ゲームクリア・重大英雄スキル)
};

const IMPORTANCE_WEIGHT = {
    MINOR: 1,
    MAJOR: 2,
    HISTORIC: 3
};

export class ChronicleSystem {
    constructor(gameState = null, gameFactHub = null) {
        this.state = gameState;
        this.events = [];
        this.unsubscribeFact = null;
        if (gameFactHub) this.attachGameFactHub(gameFactHub);
    }

    attachGameFactHub(gameFactHub) {
        if (this.unsubscribeFact) this.unsubscribeFact();
        this.unsubscribeFact = gameFactHub?.subscribe?.(fact => this.recordGameFact(fact)) || null;
        return this.unsubscribeFact;
    }

    recordGameFact(fact) {
        if (fact?.type !== GAME_FACT_TYPES.VERSE_COMMITTED) return null;

        const completedTurn = Number(fact.payload?.completedTurn);
        if (!Number.isInteger(completedTurn) || completedTurn < 1) return null;

        const id = `VERSE_COMMITTED_${completedTurn}`;
        const existing = this.events.find(event => event.id === id);
        if (existing) return existing;

        const nextTurnRaw = Number(fact.payload?.nextTurn);
        const nextTurn = Number.isInteger(nextTurnRaw) ? nextTurnRaw : completedTurn + 1;

        return this.record({
            turn: completedTurn,
            type: GAME_FACT_TYPES.VERSE_COMMITTED,
            id,
            nameKey: "CHRONICLE_VERSE_COMMITTED",
            importance: CHRONICLE_IMPORTANCE.MINOR,
            meta: {
                verse: completedTurn,
                nextVerse: nextTurn
            }
        });
    }

    /**
     * 📜 歴史的出来事の記録
     * @param {Object} eventRecord - { turn, type, id, nameKey, importance, meta }
     */
    record(eventRecord) {
        if (!eventRecord) return;
        const record = {
            turn: eventRecord.turn || (this.state ? this.state.turn : 1),
            type: eventRecord.type || "GENERIC",
            id: eventRecord.id || `EVENT_${Date.now()}`,
            nameKey: eventRecord.nameKey || eventRecord.id,
            importance: eventRecord.importance || CHRONICLE_IMPORTANCE.MAJOR,
            meta: eventRecord.meta || {}
        };
        this.events.push(record);
        return record;
    }

    /**
     * 📋 指定重要度以上の年表イベントを取得 (デフォルト: MAJOR以上)
     * @param {string} minImportance - "MINOR" | "MAJOR" | "HISTORIC"
     * @returns {Array<Object>}
     */
    getChronicle(minImportance = CHRONICLE_IMPORTANCE.MAJOR) {
        const threshold = IMPORTANCE_WEIGHT[minImportance] || IMPORTANCE_WEIGHT.MAJOR;
        return this.events.filter(e => (IMPORTANCE_WEIGHT[e.importance] || 1) >= threshold);
    }

    /**
     * 📋 全出来事の取得 (詳細ログ・デバッグ用)
     */
    getAllEvents() {
        return [...this.events];
    }

    /** Replace recorded history without recording a new event or emitting a GameFact. */
    restoreEvents(events) {
        if (!Array.isArray(events)) throw new TypeError('CHRONICLE_RESTORE_EVENTS_REQUIRED');
        const restored = JSON.parse(JSON.stringify(events));
        this.events = restored;
        return this.getAllEvents();
    }

    /**
     * 🔄 年表の初期化
     */
    clear() {
        this.events = [];
    }

    destroy() {
        if (this.unsubscribeFact) this.unsubscribeFact();
        this.unsubscribeFact = null;
    }
}

if (typeof window !== "undefined") {
    window.ChronicleSystem = ChronicleSystem;
    window.CHRONICLE_IMPORTANCE = CHRONICLE_IMPORTANCE;
}
if (typeof globalThis !== "undefined") {
    globalThis.ChronicleSystem = ChronicleSystem;
    globalThis.CHRONICLE_IMPORTANCE = CHRONICLE_IMPORTANCE;
}

export default ChronicleSystem;
