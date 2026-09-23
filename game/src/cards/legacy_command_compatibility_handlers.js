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

function createFlagHandler({ key, icon, category = "CARD_EFFECT" }) {
    return context => {
        context.state[key] = true;
        sourceBuff(context, { icon, category });
        activationLog(context, icon);
        return { success: true };
    };
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


    CMD_BALLISTA_SET(context) {
        if (context.state.defenseSystem) {
            context.state.defenseSystem.increaseMaxCapacity(40);
        } else {
            context.state.defense = (context.state.defense || 0) + 40;
        }
        context.state.nextTrialDamageMitigation = 0.5;
        sourceBuff(context, {
            icon: "🏹",
            badgeText: context?.i18n?.t
                ? context.i18n.t("UI_DEFENSE_TRIAL_TAG")
                : "試練対策",
            category: "CARD_EFFECT"
        });
        activationLog(context, "🏹");
        return { success: true };
    },

    FAC_GREAT_WINDMILL(context) {
        if (!Array.isArray(context.state.activeConstructionProjects)) {
            context.state.activeConstructionProjects = [];
        }
        context.state.activeConstructionProjects.push({
            name: "FAC_GREAT_WINDMILL",
            remainingTurns: 3,
            woodCostPerTurn: 4
        });
        activationLog(context, "🏛️");
        return { success: true };
    },

    LGD_DESPERATE_PACT(context) {
        context.state.ember = (context.state.ember || 0) + 5;
        context.state.handOfferingSize = 4;
        context.state.nextTrialMultiplier = 1.5;
        activationLog(context, "🔥");
        return { success: true };
    },

    CMD_LAND_FOCUS(context) {
        context.state.activeDrawBias = {
            targetCategory: "LAND",
            type: "UNTIL_BLOCKS",
            untilValue: 6
        };
        sourceBuff(context, {
            icon: "📜",
            category: "CARD_EFFECT"
        });
        if (typeof context.state.checkConditionalBuffs === "function") {
            context.state.checkConditionalBuffs();
        }
        activationLog(context, "📜");
        return { success: true };
    },

    CMD_OUTPOST: createFlagHandler({
        key: "hasOutpost",
        icon: "🗼",
        category: "PERMANENT"
    }),
    CMD_GUIDED_DEFENSE: createFlagHandler({
        key: "guidedDefenseActive",
        icon: "🚧",
        category: "TACTICAL"
    }),
    CMD_HIGH_GROUND_FORMATION: createFlagHandler({
        key: "highGroundFormationActive",
        icon: "⛰️",
        category: "TACTICAL"
    }),
    CMD_CAVALRY_HOST: createFlagHandler({
        key: "cavalryHostActive",
        icon: "🐎",
        category: "TACTICAL"
    }),
    CMD_PASTORAL_EXPANSION: createFlagHandler({
        key: "pastoralExpansionActive",
        icon: "🐑",
        category: "CARD_EFFECT"
    }),
    CMD_LIME_CONSTRUCTION: createFlagHandler({
        key: "limeConstructionActive",
        icon: "🧱",
        category: "CARD_EFFECT"
    }),
    CMD_CAVALRY_SCOUTS: createFlagHandler({
        key: "cavalryScoutsActive",
        icon: "🐎",
        category: "TACTICAL"
    }),
    CMD_LOCAL_IRON_ARMAMENT: createFlagHandler({
        key: "localIronArmamentActive",
        icon: "⚔️",
        category: "TACTICAL"
    }),
    CMD_STONE_STRONGPOINT: createFlagHandler({
        key: "stoneStrongpointActive",
        icon: "🏰",
        category: "TACTICAL"
    }),
    CMD_MUD_OBSTACLE: createFlagHandler({
        key: "mudObstacleActive",
        icon: "🛡️",
        category: "TACTICAL"
    }),
    CMD_OUTPOST_SIGNAL: createFlagHandler({
        key: "outpostSignalActive",
        icon: "🗼",
        category: "TACTICAL"
    }),
    CMD_SCOUT_ENEMY: createFlagHandler({
        key: "scoutEnemyActive",
        icon: "🔍",
        category: "TACTICAL"
    }),
    CMD_OMEN_DREAM: createFlagHandler({
        key: "omenDreamActive",
        icon: "🔮",
        category: "CARD_EFFECT"
    }),

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
