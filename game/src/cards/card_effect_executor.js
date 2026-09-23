/* =============================================================
   game/src/cards/card_effect_executor.js

   Declarative Card Definition v1 effect executor.
   New cards may use effects[] without adding ID branches to DeckManager.
   Board/world-specific mutation remains delegated through DOMAIN_ACTION.
   ============================================================= */

const CARD_EFFECT_TYPES = Object.freeze({
    RESOURCE_DELTA: "RESOURCE_DELTA",
    STATE_SET: "STATE_SET",
    STATE_INCREMENT: "STATE_INCREMENT",
    BUFF_ADD: "BUFF_ADD",
    DRAW_BIAS_SET: "DRAW_BIAS_SET",
    PROJECT_ADD: "PROJECT_ADD",
    LOG_CARD_ACTIVATED: "LOG_CARD_ACTIVATED",
    DOMAIN_ACTION: "DOMAIN_ACTION"
});

function cloneEffect(effect) {
    return effect && typeof effect === "object" ? { ...effect } : effect;
}

class CardEffectExecutor {
    constructor({ domainActionExecutor = null } = {}) {
        this.domainActionExecutor = domainActionExecutor;
    }

    preflight(effects, context = {}) {
        if (!Array.isArray(effects) || effects.length === 0) {
            return Object.freeze({ handled: false, success: false, reason: "NO_DECLARATIVE_EFFECTS" });
        }

        const prepared = effects.map(cloneEffect);
        const domainEffects = prepared.filter(effect => effect?.type === CARD_EFFECT_TYPES.DOMAIN_ACTION);
        if (domainEffects.length > 0 && prepared.length > 1) {
            return Object.freeze({
                handled: true,
                success: false,
                reason: "DOMAIN_ACTION_MUST_BE_EXCLUSIVE",
                prepared: Object.freeze(prepared)
            });
        }

        for (const effect of prepared) {
            const validation = this.validateOne(effect, context);
            if (!validation.success) {
                return Object.freeze({
                    handled: true,
                    success: false,
                    reason: validation.reason || "INVALID_CARD_EFFECT",
                    failedEffect: effect,
                    prepared: Object.freeze(prepared)
                });
            }
        }

        return Object.freeze({
            handled: true,
            success: true,
            prepared: Object.freeze(prepared)
        });
    }

    executeAll(effects, context = {}) {
        const preflight = this.preflight(effects, context);
        if (!preflight.handled || !preflight.success) {
            return Object.freeze({
                ...preflight,
                applied: Object.freeze([])
            });
        }

        const prepared = preflight.prepared;
        const applied = [];
        for (const effect of prepared) {
            const result = this.executeOne(effect, context);
            if (!result.success) {
                return Object.freeze({
                    handled: true,
                    success: false,
                    reason: result.reason || "CARD_EFFECT_FAILED",
                    failedEffect: effect,
                    applied: Object.freeze([...applied])
                });
            }
            applied.push(effect);
        }

        return Object.freeze({
            handled: true,
            success: true,
            applied: Object.freeze(applied)
        });
    }

    validateOne(effect, context = {}) {
        if (!effect || typeof effect !== "object") {
            return { success: false, reason: "INVALID_CARD_EFFECT" };
        }

        const state = context.state;
        if (!state && effect.type !== CARD_EFFECT_TYPES.DOMAIN_ACTION) {
            return { success: false, reason: "CARD_EFFECT_STATE_REQUIRED" };
        }

        switch (effect.type) {
            case CARD_EFFECT_TYPES.RESOURCE_DELTA:
                return effect.resource
                    ? { success: true }
                    : { success: false, reason: "RESOURCE_KEY_REQUIRED" };
            case CARD_EFFECT_TYPES.STATE_SET:
            case CARD_EFFECT_TYPES.STATE_INCREMENT:
                return effect.key
                    ? { success: true }
                    : { success: false, reason: "STATE_KEY_REQUIRED" };
            case CARD_EFFECT_TYPES.BUFF_ADD:
                return effect.buff && typeof effect.buff === "object"
                    ? { success: true }
                    : { success: false, reason: "BUFF_DEFINITION_REQUIRED" };
            case CARD_EFFECT_TYPES.LOG_CARD_ACTIVATED:
                return { success: true };
            case CARD_EFFECT_TYPES.DRAW_BIAS_SET:
                return effect.bias && typeof effect.bias === "object"
                    ? { success: true }
                    : { success: false, reason: "DRAW_BIAS_REQUIRED" };
            case CARD_EFFECT_TYPES.PROJECT_ADD:
                return effect.project && typeof effect.project === "object"
                    ? { success: true }
                    : { success: false, reason: "PROJECT_DEFINITION_REQUIRED" };
            case CARD_EFFECT_TYPES.DOMAIN_ACTION: {
                const executor = context.domainActionExecutor || this.domainActionExecutor;
                if (typeof executor !== "function") {
                    return { success: false, reason: "DOMAIN_ACTION_EXECUTOR_REQUIRED" };
                }
                if (typeof executor.preflight === "function") {
                    const result = executor.preflight(effect, context);
                    if (result && typeof result === "object") {
                        return {
                            success: result.success !== false,
                            ...result
                        };
                    }
                    return {
                        success: result !== false,
                        reason: result === false ? "DOMAIN_ACTION_PREFLIGHT_FAILED" : null
                    };
                }
                return { success: true };
            }
            default:
                return { success: false, reason: "UNSUPPORTED_CARD_EFFECT_TYPE" };
        }
    }

    executeOne(effect, context = {}) {
        if (!effect || typeof effect !== "object") {
            return { success: false, reason: "INVALID_CARD_EFFECT" };
        }

        const state = context.state;
        if (!state && effect.type !== CARD_EFFECT_TYPES.DOMAIN_ACTION) {
            return { success: false, reason: "CARD_EFFECT_STATE_REQUIRED" };
        }

        switch (effect.type) {
            case CARD_EFFECT_TYPES.RESOURCE_DELTA: {
                const resource = effect.resource;
                const amount = Number(effect.amount || 0);
                if (!resource) return { success: false, reason: "RESOURCE_KEY_REQUIRED" };
                state[resource] = Number(state[resource] || 0) + amount;
                return { success: true };
            }

            case CARD_EFFECT_TYPES.STATE_SET: {
                if (!effect.key) return { success: false, reason: "STATE_KEY_REQUIRED" };
                state[effect.key] = effect.value;
                return { success: true };
            }

            case CARD_EFFECT_TYPES.STATE_INCREMENT: {
                if (!effect.key) return { success: false, reason: "STATE_KEY_REQUIRED" };
                state[effect.key] = Number(state[effect.key] || 0) + Number(effect.amount || 0);
                return { success: true };
            }

            case CARD_EFFECT_TYPES.BUFF_ADD: {
                const buff = effect.buff;
                if (!buff || typeof buff !== "object") return { success: false, reason: "BUFF_DEFINITION_REQUIRED" };
                const source = effect.fromSourceCard
                    ? {
                        id: context.cardDefinition?.id,
                        name: context.cardName,
                        shortName: context.cardName,
                        description: context.cardDescription
                    }
                    : {};
                const badgeText = effect.badgeTextRemainingTurns
                    ? (context.i18n?.t
                        ? context.i18n.t("BUFF_REMAINING_TURNS", { count: buff.remainingTurns })
                        : `${buff.remainingTurns}T`)
                    : undefined;
                const resolvedBuff = {
                    ...source,
                    ...buff,
                    ...(badgeText !== undefined ? { badgeText } : {})
                };
                if (typeof state.addBuff === "function") {
                    state.addBuff(resolvedBuff);
                } else {
                    if (!Array.isArray(state.activeBuffs)) state.activeBuffs = [];
                    state.activeBuffs.push(resolvedBuff);
                }
                return { success: true };
            }

            case CARD_EFFECT_TYPES.DRAW_BIAS_SET: {
                if (!effect.bias || typeof effect.bias !== "object") {
                    return { success: false, reason: "DRAW_BIAS_REQUIRED" };
                }
                state.activeDrawBias = { ...effect.bias };
                return { success: true };
            }

            case CARD_EFFECT_TYPES.PROJECT_ADD: {
                if (!effect.project || typeof effect.project !== "object") {
                    return { success: false, reason: "PROJECT_DEFINITION_REQUIRED" };
                }
                if (!Array.isArray(state.activeConstructionProjects)) state.activeConstructionProjects = [];
                state.activeConstructionProjects.push({ ...effect.project });
                return { success: true };
            }

            case CARD_EFFECT_TYPES.LOG_CARD_ACTIVATED: {
                if (typeof state.addLog !== "function") return { success: true };
                const i18n = context.i18n;
                const name = context.cardName || context.cardDefinition?.id || "Card";
                const desc = context.cardDescription || "";
                const message = i18n?.t
                    ? i18n.t("LOG_CMD_ACTIVATED", { name, desc })
                    : `📜【${name}】`;
                state.addLog(message || `📜【${name}】`);
                return { success: true };
            }

            case CARD_EFFECT_TYPES.DOMAIN_ACTION: {
                const executor = context.domainActionExecutor || this.domainActionExecutor;
                if (typeof executor !== "function") {
                    return { success: false, reason: "DOMAIN_ACTION_EXECUTOR_REQUIRED" };
                }
                const domainResult = executor(effect, context);
                if (domainResult && typeof domainResult === "object") {
                    return { success: domainResult.success !== false, ...domainResult };
                }
                return { success: domainResult !== false };
            }

            default:
                return { success: false, reason: "UNSUPPORTED_CARD_EFFECT_TYPE" };
        }
    }
}

export {
    CARD_EFFECT_TYPES,
    CardEffectExecutor
};

export default CardEffectExecutor;
