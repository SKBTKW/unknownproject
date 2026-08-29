/* =============================================================
   game/src/systems/chronicle_system.js
   50ターンの歴史・出来事を3層重要度で統合記録する年代記システム (Pure & Unity Ready)
   ============================================================= */

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
    constructor(gameState = null) {
        this.state = gameState;
        this.events = [];
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

    /**
     * 🔄 年表の初期化
     */
    clear() {
        this.events = [];
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
