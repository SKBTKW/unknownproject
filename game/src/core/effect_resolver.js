/* =============================================================
   game/src/core/effect_resolver.js
   ゲームルールの効果解決を処理する汎用Registry型リゾルバー (Pure & Unity Ready)
   ============================================================= */

/**
 * ⚡ 効果解決ハンドラ Registry
 */
const EFFECT_HANDLERS = {
    // 🌾 産出倍率補正
    PRODUCTION_MULTIPLIER: (effect, context) => {
        if (!context || !context.production) return;
        const target = effect.target; // "PLAINS_FOOD", "ALL_FOOD", "MATERIAL", etc.
        const multiplier = effect.value !== undefined ? effect.value : 1.0;

        if (!context.production.multipliers) {
            context.production.multipliers = {};
        }
        context.production.multipliers[target] = (context.production.multipliers[target] || 1.0) * multiplier;
    },

    // 🃏 手札オファリングタグ重み補正
    OFFERING_WEIGHT_TAG_BOOST: (effect, context) => {
        if (!context || !context.offeringWeights) return;
        const tag = effect.tag; // "POPULATION", "CONSTRUCTION", "RECOVERY", "MILITARY", etc.
        const multiplier = effect.multiplier !== undefined ? effect.multiplier : 1.5;

        if (!context.offeringWeights.tagMultipliers) {
            context.offeringWeights.tagMultipliers = {};
        }
        context.offeringWeights.tagMultipliers[tag] = (context.offeringWeights.tagMultipliers[tag] || 1.0) * multiplier;
    },

    // 🔗 後続イベントWeight補正 (寿命 expiry 付き)
    EVENT_WEIGHT_MODIFIER: (effect, context) => {
        if (!context || !context.state) return;
        if (!context.state.temporaryWeightModifiers) {
            context.state.temporaryWeightModifiers = [];
        }
        context.state.temporaryWeightModifiers.push({
            targetTag: effect.targetTag || effect.targetEventId,
            multiplier: effect.multiplier || 1.0,
            expiry: effect.expiry || { type: "NEXT_GLOBAL_EVENT" },
            appliedTurn: context.state.turn || 1
        });
    },

    // 💰 資源の直接変更 (ドメイン委譲)
    RESOURCE_CHANGE: (effect, context) => {
        if (!context || !context.state) return;
        const resKey = (effect.resource || "food").toLowerCase();
        const amount = effect.amount || 0;
        if (context.state[resKey] !== undefined) {
            context.state[resKey] = Math.max(0, context.state[resKey] + amount);
        }
    }
};

export class EffectResolver {
    /**
     * ⚡ 単一効果の解決
     * @param {Object} effect - { type, ...params }
     * @param {Object} context - { state, production, offeringWeights, ... }
     */
    static resolve(effect, context) {
        if (!effect || !effect.type) return;
        const handler = EFFECT_HANDLERS[effect.type];
        if (!handler) {
            console.warn(`[EffectResolver] Unrecognized effect type: ${effect.type}`);
            return;
        }
        handler(effect, context);
    }

    /**
     * ⚡ 複数効果の一括解決
     * @param {Array<Object>} effects
     * @param {Object} context
     */
    static resolveAll(effects, context) {
        if (!Array.isArray(effects) || effects.length === 0) return;
        for (const effect of effects) {
            EffectResolver.resolve(effect, context);
        }
    }

    /**
     * ➕ 新規効果ハンドラの登録 (Registry拡張)
     */
    static registerHandler(type, handlerFn) {
        if (typeof handlerFn === "function") {
            EFFECT_HANDLERS[type] = handlerFn;
        }
    }
}

if (typeof window !== "undefined") {
    window.EffectResolver = EffectResolver;
}
if (typeof globalThis !== "undefined") {
    globalThis.EffectResolver = EffectResolver;
}

export default EffectResolver;
