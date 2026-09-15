import { ConditionEvaluator } from "../core/condition_evaluator.js";
import { EffectResolver } from "../core/effect_resolver.js";
import { GameplayRandomService } from "../core/gameplay_random_service.js";
import { GLOBAL_EVENTS_MASTER } from "../data/global_events.js";
import { CHRONICLE_IMPORTANCE } from "./chronicle_system.js";
import { createGlobalEventChoicePublicContext } from "./global_event_choice_context_factory.js";

export const GLOBAL_EVENT_TIMINGS = Object.freeze({ START: "START", END: "END" });

export class GlobalEventDirector {
    constructor(randomSource = null) {
        this.randomSource = randomSource;
        this.PROBABILITY_TABLE = [
            { maxElapsed: 2, rate: 0 }, { maxElapsed: 3, rate: 0.05 },
            { maxElapsed: 4, rate: 0.10 }, { maxElapsed: 5, rate: 0.20 },
            { maxElapsed: 6, rate: 0.35 }, { maxElapsed: Infinity, rate: 0.50 }
        ];
        this.COOLDOWN_TURNS = 3;
    }
    shouldTriggerEvent(state) {
        if (!state) return false;
        const elapsed = (state.turn || 1) - (state.lastGlobalEventTurn || 0);
        if (elapsed < this.COOLDOWN_TURNS) return false;
        const rate = this.PROBABILITY_TABLE.find(e => elapsed <= e.maxElapsed)?.rate ?? 0.5;
        return (this.randomSource?.nextFloat?.() ?? Math.random()) < rate;
    }
}

export class GlobalEventSelector {
    constructor(randomSource = null) { this.randomSource = randomSource; }
    selectEvent(state, masterEvents = GLOBAL_EVENTS_MASTER) {
        if (!state || !masterEvents?.length) return null;
        const eligible = [];
        for (const def of masterEvents) {
            if (def.randomEligible === false) continue;
            if (state.activeGlobalEvents?.some(e => e.definitionId === def.id)) continue;
            const last = state.eventCooldowns?.[def.id];
            if (def.cooldownTurns && last && (state.turn || 1) - last < def.cooldownTurns) continue;
            if (!ConditionEvaluator.evaluateAll(def.conditions, { state })) continue;
            let weight = def.baseWeight || 100;
            for (const mod of state.temporaryWeightModifiers || []) {
                if (mod.targetTag === def.id || mod.targetTag === def.category) weight *= mod.multiplier || 1;
            }
            eligible.push({ def, weight: Math.max(1, weight) });
        }
        if (!eligible.length) return null;
        const total = eligible.reduce((n, e) => n + e.weight, 0);
        let roll = (this.randomSource?.nextFloat?.() ?? Math.random()) * total;
        for (const item of eligible) { if (roll <= item.weight) return item.def; roll -= item.weight; }
        return eligible[0].def;
    }
}

export class GlobalEventManager {
    constructor(gameState = null, engine = null) {
        this.state = gameState;
        this.engine = engine;
        this.lifecycleListeners = new Set();
        this.randomSource = engine ? (engine.gameplayRandom || (engine.gameplayRandom = new GameplayRandomService(engine.runSeed))) : null;
        this.director = new GlobalEventDirector(this.randomSource);
        this.selector = new GlobalEventSelector(this.randomSource);
        this.initManager();
    }
    initManager() {
        if (!this.state) return;
        this.state.activeGlobalEvents ||= [];
        this.state.eventCooldowns ||= {};
        this.state.temporaryWeightModifiers ||= [];
        this.state.lastGlobalEventTurn ||= 0;
    }
    subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("GLOBAL_EVENT_LISTENER_REQUIRED");
        this.lifecycleListeners.add(listener);
        return () => this.lifecycleListeners.delete(listener);
    }
    emitLifecycle(timing, def, turn = this.state?.turn || 1, instance = null) {
        if (!def) return null;
        const choice = instance?.runtimeState?.choice || null;
        const note = Object.freeze({
            timing, eventId: def.id, category: def.category || null,
            importance: def.importance || CHRONICLE_IMPORTANCE.MAJOR, turn,
            choiceEventId: choice?.eventId || def.choiceEventId || null,
            choiceStatus: choice?.status || null,
            publicContext: choice?.publicContext ? JSON.parse(JSON.stringify(choice.publicContext)) : null
        });
        this.lifecycleListeners.forEach(fn => fn(note));
        return note;
    }
    getPendingChoice() {
        const inst = (this.state?.activeGlobalEvents || []).find(e => e?.runtimeState?.choice?.status === "PENDING");
        if (!inst) return null;
        return JSON.parse(JSON.stringify({ sourceEventId: inst.definitionId, ...inst.runtimeState.choice }));
    }
    markChoiceResolved(sourceEventId, resolution) {
        const inst = (this.state?.activeGlobalEvents || []).find(e => e.definitionId === sourceEventId);
        const choice = inst?.runtimeState?.choice;
        if (!choice || choice.status !== "PENDING" || choice.eventId !== resolution?.eventId) return false;
        inst.runtimeState.choice = { ...choice, status: "RESOLVED", choiceId: resolution.choiceId || null, publicOutcomeTags: [...(resolution.publicOutcomeTags || [])] };
        return true;
    }
    onTurnStart() {
        if (!this.state || this.getPendingChoice() || !this.director.shouldTriggerEvent(this.state)) return null;
        const def = this.selector.selectEvent(this.state, GLOBAL_EVENTS_MASTER);
        return def ? this.triggerEvent(def.id) : null;
    }
    triggerEvent(eventId) {
        if (!this.state) return null;
        const def = GLOBAL_EVENTS_MASTER.find(d => d.id === eventId);
        if (!def) return null;
        const turn = this.state.turn || 1;
        this.state.lastGlobalEventTurn = turn;
        if (def.cooldownTurns) this.state.eventCooldowns[def.id] = turn;
        const inst = { definitionId: def.id, remainingTurns: def.duration || 1, runtimeState: {} };
        if (def.choiceEventId) inst.runtimeState.choice = { eventId: def.choiceEventId, status: "PENDING", publicContext: createGlobalEventChoicePublicContext(def.choiceEventId, { state: this.state, randomSource: this.randomSource }) };
        this.state.activeGlobalEvents.push(inst);
        EffectResolver.resolveAll(def.effects, { state: this.state, engine: this.engine });
        this.state.chronicleSystem?.record?.({ turn, type: "GLOBAL_EVENT", id: def.id, nameKey: def.nameKey, importance: def.importance || CHRONICLE_IMPORTANCE.MAJOR, meta: { category: def.category, duration: def.duration } });
        this.syncBuffProxy();
        const i18n = globalThis.I18n || { t: k => k };
        this.state.addLog?.(def.choiceEventId ? `🌍【${i18n.t(def.nameKey)}】` : `🌍【${i18n.t(def.nameKey)}】: ${i18n.t(def.descKey)}`);
        this.emitLifecycle(GLOBAL_EVENT_TIMINGS.START, def, turn, inst);
        return inst;
    }
    syncBuffProxy() {
        if (!this.state?.buffSystem) return;
        const i18n = globalThis.I18n || { t: k => k };
        for (const def of GLOBAL_EVENTS_MASTER) this.state.buffSystem.removeBuff(def.id);
        for (const inst of this.state.activeGlobalEvents || []) {
            if (inst?.runtimeState?.choice?.status === "PENDING") continue;
            const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
            if (!def) continue;
            const name = i18n.t(def.nameKey);
            this.state.buffSystem.addBuff({ id: def.id, name: `🌍 ${name}`, shortName: name, icon: def.icon || "🌍", description: i18n.t(def.descKey), badgeText: i18n.t("BUFF_REMAINING_TURNS", { count: inst.remainingTurns }), category: "GLOBAL_EVENT", remainingTurns: inst.remainingTurns, isProxy: true });
        }
    }
    applyProductionEffects(prods) { this._applyEffects({ state: this.state, production: prods }); }
    applyOfferingWeightEffects(weights) { this._applyEffects({ state: this.state, offeringWeights: weights }); }
    _applyEffects(context) {
        for (const inst of this.state?.activeGlobalEvents || []) {
            const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
            if (def?.effects) EffectResolver.resolveAll(def.effects, context);
        }
    }
    tickTurn() {
        if (!this.state?.activeGlobalEvents) return;
        const context = { state: this.state, engine: this.engine };
        for (let i = this.state.activeGlobalEvents.length - 1; i >= 0; i--) {
            const inst = this.state.activeGlobalEvents[i];
            if (inst?.runtimeState?.choice?.status === "PENDING") continue;
            if (--inst.remainingTurns > 0) continue;
            const def = GLOBAL_EVENTS_MASTER.find(d => d.id === inst.definitionId);
            if (def?.endEffects) EffectResolver.resolveAll(def.endEffects, context);
            this.state.activeGlobalEvents.splice(i, 1);
            this.emitLifecycle(GLOBAL_EVENT_TIMINGS.END, def, this.state.turn || 1, inst);
        }
        const turn = this.state.turn || 1;
        this.state.temporaryWeightModifiers = (this.state.temporaryWeightModifiers || []).filter(mod => mod.expiry?.type !== "TURN_COUNT" || turn - mod.appliedTurn < (mod.expiry.value || 3));
        this.syncBuffProxy();
    }
}

if (typeof window !== "undefined") Object.assign(window, { GlobalEventDirector, GlobalEventSelector, GlobalEventManager });
if (typeof globalThis !== "undefined") Object.assign(globalThis, { GlobalEventDirector, GlobalEventSelector, GlobalEventManager });
export default GlobalEventManager;
