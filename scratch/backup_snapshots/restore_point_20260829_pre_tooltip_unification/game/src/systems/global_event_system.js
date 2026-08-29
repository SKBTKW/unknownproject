/* =============================================================
   game/src/systems/global_event_system.js
   グローバルイベントの発生判定・候補抽選・状態管理を一元管理するシステム (Pure & Unity Ready)
   ============================================================= */

import { ConditionEvaluator } from "../core/condition_evaluator.js";
import { EffectResolver } from "../core/effect_resolver.js";
import { GLOBAL_EVENTS_MASTER } from "../data/global_events.js";
import { CHRONICLE_IMPORTANCE } from "./chronicle_system.js";

/**
 * 🌍 1. GlobalEventDirector (発生制御・経過ターン別確率・共通CT)
 */
export class GlobalEventDirector {
    constructor() {
        // rules/10_global_events.md 準拠の経過ターン別発生率テーブル
        this.PROBABILITY_TABLE = [
            { maxElapsed: 2, rate: 0.00 },
            { maxElapsed: 3, rate: 0.05 },
            { maxElapsed: 4, rate: 0.10 },
            { maxElapsed: 5, rate: 0.20 },
            { maxElapsed: 6, rate: 0.35 },
            { maxElapsed: Infinity, rate: 0.50 }
        ];
        this.COOLDOWN_TURNS = 3; // イベント発生後の最低平穏期間 (3T)
    }

    /**
     * 🎲 イベント発生判定
     * @param {Object} state - gameState
     * @returns {boolean}
     */
    shouldTriggerEvent(state) {
        if (!state) return false;
        const currentTurn = state.turn || 1;
        const lastEventTurn = state.lastGlobalEventTurn || 0;
        const elapsed = currentTurn - lastEventTurn;

        // 平穏期間 (0〜2T) は発生確率 0%
        if (elapsed < this.COOLDOWN_TURNS) return false;

        let rate = 0.50;
        for (const entry of this.PROBABILITY_TABLE) {
            if (elapsed <= entry.maxElapsed) {
                rate = entry.rate;
                break;
            }
        }

        return Math.random() < rate;
    }
}

/**
 * 🎯 2. GlobalEventSelector (条件フィルタ ＆ Weight付き候補抽選)
 */
export class GlobalEventSelector {
    /**
     * 🔍 発生候補の選定と抽選
     * @param {Object} state - gameState
     * @param {Array<Object>} masterEvents - GLOBAL_EVENTS_MASTER
     * @returns {Object|null}
     */
    selectEvent(state, masterEvents = GLOBAL_EVENTS_MASTER) {
        if (!state || !Array.isArray(masterEvents) || masterEvents.length === 0) return null;

        const context = { state };
        const eligible = [];

        for (const def of masterEvents) {
            // 🚫 アクティブ中イベントの重複発動遮断
            const isActive = state.activeGlobalEvents && state.activeGlobalEvents.some(e => e.definitionId === def.id);
            if (isActive) continue;

            // ⏳ イベント固有クールタイム判定 (例: 亜人襲撃 8T)
            if (def.cooldownTurns && state.eventCooldowns && state.eventCooldowns[def.id]) {
                const lastTurn = state.eventCooldowns[def.id];
                if ((state.turn || 1) - lastTurn < def.cooldownTurns) continue;
            }

            // 🔍 条件評価 (ConditionEvaluator 経由)
            if (ConditionEvaluator.evaluateAll(def.conditions, context)) {
                // 因果関係Weight補正の算出
                let finalWeight = def.baseWeight || 100;
                if (state.temporaryWeightModifiers && Array.isArray(state.temporaryWeightModifiers)) {
                    for (const mod of state.temporaryWeightModifiers) {
                        if (mod.targetTag === def.id || mod.targetTag === def.category) {
                            finalWeight *= (mod.multiplier || 1.0);
                        }
                    }
                }
                eligible.push({ def, weight: Math.max(1, finalWeight) });
            }
        }

        if (eligible.length === 0) return null;

        // 🎲 Weight付きランダム抽選
        const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
        let rand = Math.random() * totalWeight;

        for (const item of eligible) {
            if (rand <= item.weight) {
                return item.def;
            }
            rand -= item.weight;
        }

        return eligible[0].def;
    }
}

/**
 * 📦 3. GlobalEventManager (実行時状態の正本 ＆ フック管理)
 */
export class GlobalEventManager {
    constructor(gameState = null, engine = null) {
        this.state = gameState;
        this.engine = engine;
        this.director = new GlobalEventDirector();
        this.selector = new GlobalEventSelector();
        this.initManager();
    }

    initManager() {
        if (!this.state) return;
        if (!this.state.activeGlobalEvents) this.state.activeGlobalEvents = [];
        if (!this.state.eventCooldowns) this.state.eventCooldowns = {};
        if (!this.state.temporaryWeightModifiers) this.state.temporaryWeightModifiers = [];
        if (!this.state.lastGlobalEventTurn) this.state.lastGlobalEventTurn = 0;
    }

    /**
     * 🔄 ターン開始時の発生判定・トリガー
     */
    onTurnStart() {
        if (!this.state) return null;
        if (this.director.shouldTriggerEvent(this.state)) {
            const selectedDef = this.selector.selectEvent(this.state, GLOBAL_EVENTS_MASTER);
            if (selectedDef) {
                return this.triggerEvent(selectedDef.id);
            }
        }
        return null;
    }

    /**
     * ⚡ イベントの強制発動 / 通常発動
     * @param {string} eventId
     */
    triggerEvent(eventId) {
        if (!this.state) return null;
        const def = GLOBAL_EVENTS_MASTER.find(d => d.id === eventId);
        if (!def) return null;

        const currentTurn = this.state.turn || 1;
        this.state.lastGlobalEventTurn = currentTurn;
        if (def.cooldownTurns) {
            this.state.eventCooldowns[def.id] = currentTurn;
        }

        // 📦 正本 (Instance) の追加
        const instance = {
            definitionId: def.id,
            remainingTurns: def.duration || 1,
            runtimeState: {}
        };
        this.state.activeGlobalEvents.push(instance);

        // ⚡ 初期効果の解決 (EffectResolver)
        const context = { state: this.state, engine: this.engine };
        EffectResolver.resolveAll(def.effects, context);

        // 📜 統合年代記 (Chronicle) への記録
        if (this.state.chronicleSystem && typeof this.state.chronicleSystem.record === "function") {
            this.state.chronicleSystem.record({
                turn: currentTurn,
                type: "GLOBAL_EVENT",
                id: def.id,
                nameKey: def.nameKey,
                importance: def.importance || CHRONICLE_IMPORTANCE.MAJOR,
                meta: { category: def.category, duration: def.duration }
            });
        }

        // ✨ BuffSystem への表示用 Proxy 登録 (正本はGlobalEventManager)
        this.syncBuffProxy();

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const eventName = I18n ? I18n.t(def.nameKey) : def.id;
        const eventDesc = I18n ? I18n.t(def.descKey) : "";
        if (this.state.addLog) {
            this.state.addLog(`🌍【${eventName}】: ${eventDesc}`);
        }

        return instance;
    }

    /**
     * ✨ BuffSystem との表示用 Proxy 同期
     */
    syncBuffProxy() {
        if (!this.state || !this.state.buffSystem) return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

        // 既存のグローバルイベントProxyを一旦クリア
        for (const def of GLOBAL_EVENTS_MASTER) {
            this.state.buffSystem.removeBuff(def.id);
        }

        // アクティブ中のイベントのみProxy登録
        for (const inst of (this.state.activeGlobalEvents || [])) {
            const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
            if (!def) continue;
            const name = I18n ? I18n.t(def.nameKey) : def.id;
            const desc = I18n ? I18n.t(def.descKey) : "";

            this.state.buffSystem.addBuff({
                id: def.id,
                name: `🌍 ${name}`,
                shortName: name,
                icon: def.icon || "🌍",
                description: desc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: inst.remainingTurns }) : `${inst.remainingTurns}T`,
                category: "GLOBAL_EVENT",
                remainingTurns: inst.remainingTurns,
                isProxy: true // 表示専用 Proxy フラグ
            });
        }
    }

    /**
     * 🌾 産出計算へのフック適用
     * @param {Object} prods - { totalFood, multipliers, ... }
     */
    applyProductionEffects(prods) {
        if (!this.state || !this.state.activeGlobalEvents) return;
        const context = { state: this.state, production: prods };

        for (const inst of this.state.activeGlobalEvents) {
            const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
            if (def && Array.isArray(def.effects)) {
                EffectResolver.resolveAll(def.effects, context);
            }
        }
    }

    /**
     * 🃏 オファリング手札重みへのフック適用
     * @param {Object} weights - { tagMultipliers, ... }
     */
    applyOfferingWeightEffects(weights) {
        if (!this.state || !this.state.activeGlobalEvents) return;
        const context = { state: this.state, offeringWeights: weights };

        for (const inst of this.state.activeGlobalEvents) {
            const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
            if (def && Array.isArray(def.effects)) {
                EffectResolver.resolveAll(def.effects, context);
            }
        }
    }

    /**
     * ⏳ ターン経過処理 (持続ターン減衰・失効・endEffects解決)
     */
    tickTurn() {
        if (!this.state || !this.state.activeGlobalEvents) return;
        const context = { state: this.state, engine: this.engine };

        for (let i = this.state.activeGlobalEvents.length - 1; i >= 0; i--) {
            const inst = this.state.activeGlobalEvents[i];
            inst.remainingTurns -= 1;

            if (inst.remainingTurns <= 0) {
                const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
                if (def && Array.isArray(def.endEffects)) {
                    EffectResolver.resolveAll(def.endEffects, context);
                }
                this.state.activeGlobalEvents.splice(i, 1);
            }
        }

        // 一時的Weight補正の寿命管理
        if (this.state.temporaryWeightModifiers) {
            const currentTurn = this.state.turn || 1;
            this.state.temporaryWeightModifiers = this.state.temporaryWeightModifiers.filter(mod => {
                if (mod.expiry && mod.expiry.type === "TURN_COUNT") {
                    return currentTurn - mod.appliedTurn < (mod.expiry.value || 3);
                }
                return true; // NEXT_GLOBAL_EVENT の場合は次回イベント発生時にクリア
            });
        }

        this.syncBuffProxy();
    }
}

if (typeof window !== "undefined") {
    window.GlobalEventDirector = GlobalEventDirector;
    window.GlobalEventSelector = GlobalEventSelector;
    window.GlobalEventManager = GlobalEventManager;
}
if (typeof globalThis !== "undefined") {
    globalThis.GlobalEventDirector = GlobalEventDirector;
    globalThis.GlobalEventSelector = GlobalEventSelector;
    globalThis.GlobalEventManager = GlobalEventManager;
}

export default GlobalEventManager;
