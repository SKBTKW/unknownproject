import { CardEffectExecutor } from "./card_effect_executor.js";

/* =============================================================
   game/src/cards/card_effect_handler_router.js

   Incremental execution boundary for non-LAND card effects.
   No legacy card is migrated by default: an unregistered card is explicitly
   unhandled so DeckManager can continue through its existing if/else chain.
   ============================================================= */

class CardEffectHandlerRouter {
    constructor(handlers = null, { effectExecutor = null } = {}) {
        this.handlers = new Map();
        this.effectExecutor = effectExecutor || new CardEffectExecutor();

        if (handlers instanceof Map) {
            for (const [cardId, handler] of handlers.entries()) this.register(cardId, handler);
        } else if (handlers && typeof handlers === "object") {
            for (const [cardId, handler] of Object.entries(handlers)) this.register(cardId, handler);
        }
    }

    register(cardId, handler) {
        if (!cardId || typeof handler !== "function") return false;
        this.handlers.set(cardId, handler);
        return true;
    }

    has(cardId) {
        return this.handlers.has(cardId);
    }

    enumerateTargets(cardDefinition, context = {}) {
        const cardId = cardDefinition?.id;
        const handler = cardId ? this.handlers.get(cardId) : null;
        if (typeof handler === "function") {
            return [];
        }

        const effects = cardDefinition?.effects;
        if (!Array.isArray(effects) || effects.length === 0) return [];
        return this.effectExecutor.enumerateTargets(effects, {
            cardDefinition,
            ...context
        });
    }

    preflight(cardDefinition, context = {}) {
        const cardId = cardDefinition?.id;
        const handler = cardId ? this.handlers.get(cardId) : null;
        if (typeof handler === "function") {
            return Object.freeze({ handled: true, success: true, kind: "REGISTERED_HANDLER" });
        }

        const effects = cardDefinition?.effects;
        if (Array.isArray(effects) && effects.length > 0) {
            return this.effectExecutor.preflight(effects, {
                cardDefinition,
                ...context
            });
        }

        return Object.freeze({ handled: false, success: true, kind: "LEGACY_FALLBACK" });
    }

    execute(cardDefinition, context = {}) {
        const cardId = cardDefinition?.id;
        const handler = cardId ? this.handlers.get(cardId) : null;
        if (typeof handler !== "function") {
            const effects = cardDefinition?.effects;
            if (Array.isArray(effects) && effects.length > 0) {
                return this.effectExecutor.executeAll(effects, {
                    cardDefinition,
                    ...context
                });
            }
            return Object.freeze({ handled: false, success: false, reason: "UNHANDLED_CARD_EFFECT" });
        }

        const result = handler(Object.freeze({
            cardDefinition,
            ...context
        }));

        if (result && typeof result === "object") {
            return Object.freeze({
                handled: true,
                success: result.success !== false,
                ...result
            });
        }

        return Object.freeze({
            handled: true,
            success: result !== false
        });
    }
}

function resolveCardEffectHandlerRouter(engine = null) {
    if (engine?.cardEffectHandlerRouter instanceof CardEffectHandlerRouter) {
        return engine.cardEffectHandlerRouter;
    }

    const effectExecutor = new CardEffectExecutor({
        domainActionExecutor: engine?.cardDomainActionExecutor || null
    });
    return new CardEffectHandlerRouter(
        engine?.cardEffectHandlers || null,
        { effectExecutor }
    );
}

export {
    CardEffectHandlerRouter,
    resolveCardEffectHandlerRouter
};
