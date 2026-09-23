/* =============================================================
   game/src/cards/legacy_command_compatibility_handlers.js

   Compatibility-only handlers for command ids that are no longer present in
   current SSOT card data but may still appear in legacy saves/tests.

   Do not add current cards here. Current cards must use declarative effects or
   owning-domain actions.
   ============================================================= */

function activationLog(context, fallbackIcon = "📜") {
    const state = context?.state;
    if (typeof state?.addLog !== "function") return;
    const i18n = context?.i18n;
    const name = context?.cardName || context?.cardDefinition?.id || "Card";
    const desc = context?.cardDescription || "";
    state.addLog(
        i18n?.t
            ? i18n.t("LOG_CMD_ACTIVATED", { name, desc })
            : `${fallbackIcon}【${name}】`
    );
}

function sourceBuff(context, buff) {
    const state = context?.state;
    if (!state) return;
    const name = context?.cardName || context?.cardDefinition?.id || "Card";
    const resolved = {
        id: context?.cardDefinition?.id,
        name,
        shortName: name,
        description: context?.cardDescription || "",
        ...buff
    };
    if (typeof state.addBuff === "function") state.addBuff(resolved);
    else {
        if (!Array.isArray(state.activeBuffs)) state.activeBuffs = [];
        state.activeBuffs.push(resolved);
    }
}

function remainingTurnsText(context, turns) {
    return context?.i18n?.t
        ? context.i18n.t("BUFF_REMAINING_TURNS", { count: turns })
        : `${turns}T`;
}

const LEGACY_COMMAND_COMPATIBILITY_HANDLERS = Object.freeze({
    CMD_AGRICULTURAL_POLICY(context) {
        context.state.permanentPlainsFoodBonus =
            (context.state.permanentPlainsFoodBonus || 0) + 1;
        activationLog(context, "📜");
        return { success: true };
    },

    CMD_BLACK_MARKET(context) {
        context.state.wood = (context.state.wood || 0) + 35;
        context.state.mystic = (context.state.mystic || 0) + 10;
        activationLog(context, "📜");
        return { success: true };
    },


    CMD_CONSERVE_EMBER(context) {
        context.state.emberConsumptionReducedTurns = 1;
        context.state.emberConsumptionStartsNextTurn = true;
        sourceBuff(context, {
            icon: "🔥",
            badgeText: remainingTurnsText(context, 1),
            category: "CARD_EFFECT",
            remainingTurns: 1,
            startsNextTurn: true
        });
        activationLog(context, "🔥");
        return { success: true };
    },

    CMD_GRAND_CULTIVATION(context) {
        context.state.grandCultivationTurns = 4;
        context.state.grandCultivationStartsNextTurn = true;
        sourceBuff(context, {
            icon: "🌾",
            badgeText: remainingTurnsText(context, 4),
            category: "CARD_EFFECT",
            remainingTurns: 4,
            startsNextTurn: true
        });
        activationLog(context, "🌾");
        return { success: true };
    },

    CMD_SCORCHED_RETREAT(context) {
        context.state.scorchedRetreatTurns = 3;
        sourceBuff(context, {
            icon: "🔥",
            badgeText: remainingTurnsText(context, 3),
            category: "DEBUFF",
            remainingTurns: 3
        });
        activationLog(context, "🔥");
        return { success: true };
    }
});

const LEGACY_COMMAND_COMPATIBILITY_IDS = Object.freeze(
    Object.keys(LEGACY_COMMAND_COMPATIBILITY_HANDLERS)
);

export {
    LEGACY_COMMAND_COMPATIBILITY_HANDLERS,
    LEGACY_COMMAND_COMPATIBILITY_IDS
};
