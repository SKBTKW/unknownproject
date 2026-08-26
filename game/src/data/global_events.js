/* =============================================================
   game/src/data/global_events.js
   グローバルイベント 8 種の宣言的純データマスター (Pure & Unity Ready)
   ============================================================= */

export const GLOBAL_EVENTS_MASTER = [
    // 🌨️ 1. 寒波 (EVENT_COLD_WAVE)
    {
        id: "EVENT_COLD_WAVE",
        category: "ENVIRONMENT",
        nameKey: "EVENT_COLD_WAVE_NAME",
        descKey: "EVENT_COLD_WAVE_DESC",
        icon: "🌨️",
        minStage: 1,
        duration: 3,
        baseWeight: 100,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 1 },
            { type: "TERRAIN_COUNT_AT_LEAST", terrain: "PLAINS", value: 4 }
        ],
        effects: [
            { type: "PRODUCTION_MULTIPLIER", target: "PLAINS_FOOD", value: 0.75 }
        ],
        endEffects: [
            {
                type: "EVENT_WEIGHT_MODIFIER",
                targetTag: "FOOD_CRISIS",
                multiplier: 1.5,
                expiry: { type: "NEXT_GLOBAL_EVENT" }
            }
        ]
    },

    // ☀️ 2. 旱魃 (EVENT_DROUGHT)
    {
        id: "EVENT_DROUGHT",
        category: "ENVIRONMENT",
        nameKey: "EVENT_DROUGHT_NAME",
        descKey: "EVENT_DROUGHT_DESC",
        icon: "☀️",
        minStage: 2,
        duration: 3,
        baseWeight: 70,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 2 },
            { type: "TERRAIN_COUNT_AT_LEAST", terrain: "PLAINS", value: 6 }
        ],
        effects: [
            { type: "PRODUCTION_MULTIPLIER", target: "PLAINS_FOOD", value: 0.60 }
        ],
        endEffects: []
    },

    // 🌾 3. 新たな世代 (EVENT_NEW_GENERATION)
    {
        id: "EVENT_NEW_GENERATION",
        category: "SOCIETY",
        nameKey: "EVENT_NEW_GENERATION_NAME",
        descKey: "EVENT_NEW_GENERATION_DESC",
        icon: "👥",
        minStage: 2,
        duration: 3,
        baseWeight: 60,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 2 },
            { type: "RESOURCE_AT_LEAST", resource: "food", value: 80 },
            { type: "HISTORY_CHECK", checkType: "NO_FOOD_DEFICIT_RECENT", turns: 3 }
        ],
        effects: [
            { type: "OFFERING_WEIGHT_TAG_BOOST", tag: "POPULATION", multiplier: 1.8 }
        ],
        endEffects: []
    },

    // 🔨 4. 職人たちの活況 (EVENT_CRAFTSMAN_BOOM)
    {
        id: "EVENT_CRAFTSMAN_BOOM",
        category: "SOCIETY",
        nameKey: "EVENT_CRAFTSMAN_BOOM_NAME",
        descKey: "EVENT_CRAFTSMAN_BOOM_DESC",
        icon: "🔨",
        minStage: 2,
        duration: 3,
        baseWeight: 60,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 2 },
            { type: "SOCKET_FOUND", category: "STONE" }
        ],
        effects: [
            { type: "OFFERING_WEIGHT_TAG_BOOST", tag: "CONSTRUCTION", multiplier: 1.8 }
        ],
        endEffects: []
    },

    // 🌾 5. 豊穣の季節 (EVENT_BOUNTIFUL_SEASON)
    {
        id: "EVENT_BOUNTIFUL_SEASON",
        category: "OPPORTUNITY",
        nameKey: "EVENT_BOUNTIFUL_SEASON_NAME",
        descKey: "EVENT_BOUNTIFUL_SEASON_DESC",
        icon: "🌾",
        minStage: 1,
        duration: 3,
        baseWeight: 80,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 1 },
            { type: "TERRAIN_COUNT_AT_LEAST", terrain: "PLAINS", value: 4 }
        ],
        effects: [
            { type: "PRODUCTION_MULTIPLIER", target: "PLAINS_FOOD", value: 1.25 }
        ],
        endEffects: [
            {
                type: "EVENT_WEIGHT_MODIFIER",
                targetTag: "EVENT_NEW_GENERATION",
                multiplier: 2.0,
                expiry: { type: "NEXT_GLOBAL_EVENT" }
            }
        ]
    },

    // 🛡️ 6. 復興の機運 (EVENT_RECOVERY_MOMENTUM)
    {
        id: "EVENT_RECOVERY_MOMENTUM",
        category: "OPPORTUNITY",
        nameKey: "EVENT_RECOVERY_MOMENTUM_NAME",
        descKey: "EVENT_RECOVERY_MOMENTUM_DESC",
        icon: "🛡️",
        minStage: 1,
        duration: 3,
        baseWeight: 100,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 1 },
            { type: "HISTORY_CHECK", checkType: "TRIAL_DAMAGE_TAKEN" }
        ],
        effects: [
            { type: "OFFERING_WEIGHT_TAG_BOOST", tag: "RECOVERY", multiplier: 2.0 }
        ],
        endEffects: []
    },

    // ⚔️ 7. 亜人襲撃 (EVENT_DEMIHUMAN_RAID)
    {
        id: "EVENT_DEMIHUMAN_RAID",
        category: "THREAT",
        nameKey: "EVENT_DEMIHUMAN_RAID_NAME",
        descKey: "EVENT_DEMIHUMAN_RAID_DESC",
        icon: "⚔️",
        minStage: 2,
        duration: 1,
        baseWeight: 80,
        importance: "MAJOR",
        cooldownTurns: 8,
        conditions: [
            { type: "STAGE_AT_LEAST", value: 2 },
            { type: "TRIAL_DISTANCE_ABOVE", value: 5 }
        ],
        effects: [],
        endEffects: []
    },

    // 🏹 8. 亜人の斥候 (EVENT_DEMIHUMAN_SCOUTS)
    {
        id: "EVENT_DEMIHUMAN_SCOUTS",
        category: "THREAT",
        nameKey: "EVENT_DEMIHUMAN_SCOUTS_NAME",
        descKey: "EVENT_DEMIHUMAN_SCOUTS_DESC",
        icon: "🏹",
        minStage: 2,
        duration: 1,
        baseWeight: 60,
        importance: "MAJOR",
        conditions: [
            { type: "STAGE_AT_LEAST", value: 2 },
            { type: "TRIAL_DISTANCE_ABOVE", value: 4 }
        ],
        effects: [],
        endEffects: []
    }
];

if (typeof window !== "undefined") {
    window.GLOBAL_EVENTS_MASTER = GLOBAL_EVENTS_MASTER;
}
if (typeof globalThis !== "undefined") {
    globalThis.GLOBAL_EVENTS_MASTER = GLOBAL_EVENTS_MASTER;
}

export default GLOBAL_EVENTS_MASTER;
