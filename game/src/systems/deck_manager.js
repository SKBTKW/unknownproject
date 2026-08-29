import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES } from './directive_system.js';
import { LAND_CARDS_MASTER } from '../data/land_cards_data.js';
import { ConditionEvaluator } from '../core/condition_evaluator.js';

const COMMAND_CARDS_MASTER = [
    // 📜 経済・政策カード
    { id: "CMD_CONSERVE_EMBER", category: "COMMAND", nameKey: "CMD_CONSERVE_EMBER_NAME", descriptionKey: "CMD_CONSERVE_EMBER_DESC", cost: {}, maxEmber: 18, minStage: 1, rarity: "C", weight: 0.40 },
    { id: "CMD_RATIONING", category: "COMMAND", nameKey: "CMD_RATIONING_NAME", descriptionKey: "CMD_RATIONING_DESC", cost: {}, maxFood: 40, minStage: 1, rarity: "C", weight: 0.40 },
    { id: "CMD_SINGLE_CLEARING", category: "COMMAND", nameKey: "CMD_SINGLE_CLEARING_NAME", descriptionKey: "CMD_SINGLE_CLEARING_DESC", cost: { ember: 1 }, reqForestOrHillForest: 1, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_WETLAND_RECLAMATION", category: "COMMAND", nameKey: "CMD_WETLAND_RECLAMATION_NAME", descriptionKey: "CMD_WETLAND_RECLAMATION_DESC", cost: { wood: 15, ember: 1 }, reqWetland: 1, reqWood: 15, minStage: 1, rarity: "UC", weight: 0.25 },
    { id: "CMD_SYSTEMATIC_LOGGING", category: "COMMAND", nameKey: "CMD_SYSTEMATIC_LOGGING_NAME", descriptionKey: "CMD_SYSTEMATIC_LOGGING_DESC", cost: { food: 10 }, reqForestOrHillForest: 2, minStage: 2, rarity: "UC", weight: 0.25 },
    { id: "CMD_AGRICULTURAL_POLICY", category: "ECONOMY", nameKey: "CMD_AGRICULTURAL_POLICY_NAME", descriptionKey: "CMD_AGRICULTURAL_POLICY_DESC", cost: { wood: 20 }, reqPlains: 1, reqWood: 20, isUnique: true, minStage: 1, rarity: "R", weight: 0.20 },
    { id: "CMD_LAND_FOCUS", category: "ECONOMY", nameKey: "CMD_LAND_FOCUS_NAME", descriptionKey: "CMD_LAND_FOCUS_DESC", cost: { food: 10, wood: 10 }, maxPlacedBlocks: 5, minStage: 1, rarity: "C", weight: 0.40 },
    { id: "CMD_EMERGENCY_LEVY", category: "COMMAND", nameKey: "CMD_EMERGENCY_LEVY_NAME", descriptionKey: "CMD_EMERGENCY_LEVY_DESC", cost: { food: 20 }, reqTrialWithin: 6, reqFood: 20, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_PASTORAL_EXPANSION", category: "COMMAND", nameKey: "CMD_PASTORAL_EXPANSION_NAME", descriptionKey: "CMD_PASTORAL_EXPANSION_DESC", cost: { wood: 10 }, reqDiscoveredResourceTag: "LIVESTOCK", minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_ABANDONED_SETTLEMENT", category: "COMMAND", nameKey: "CMD_ABANDONED_SETTLEMENT_NAME", descriptionKey: "CMD_ABANDONED_SETTLEMENT_DESC", cost: { ember: 1 }, reqEmptyCells: 8, minStage: 1, rarity: "UC", weight: 0.25 },
    { id: "CMD_BLACK_MARKET", category: "ECONOMY", nameKey: "CMD_BLACK_MARKET_NAME", descriptionKey: "CMD_BLACK_MARKET_DESC", cost: { food: 25 }, reqFood: 25, isUnique: true, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_GRAND_CULTIVATION", category: "COMMAND", nameKey: "CMD_GRAND_CULTIVATION_NAME", descriptionKey: "CMD_GRAND_CULTIVATION_DESC", cost: { wood: 35 }, reqConnectedPlains: 8, minStage: 2, rarity: "UC", weight: 0.25 },
    { id: "CMD_RESETTLEMENT", category: "COMMAND", nameKey: "CMD_RESETTLEMENT_NAME", descriptionKey: "CMD_RESETTLEMENT_DESC", cost: { food: 15, wood: 10 }, reqPlains: 6, maxEmber: 12, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_LIME_CONSTRUCTION", category: "COMMAND", nameKey: "CMD_LIME_CONSTRUCTION_NAME", descriptionKey: "CMD_LIME_CONSTRUCTION_DESC", cost: { food: 10 }, reqDiscoveredResourceTags: ["STONE", "WOOD"], minStage: 2, rarity: "UC", weight: 0.25 },
    { id: "CMD_GREAT_RAMPART_PROJECT", category: "COMMAND", nameKey: "CMD_GREAT_RAMPART_PROJECT_NAME", descriptionKey: "CMD_GREAT_RAMPART_PROJECT_DESC", cost: { wood: 70 }, reqConnectedPlains: 12, reqTrialWithin: 10, isUnique: true, minStage: 3, rarity: "UR", weight: 0.10 },

    // 🛡️ 軍事・防衛カード
    { id: "CMD_VIGILANCE", category: "COMMAND", nameKey: "CMD_VIGILANCE_NAME", descriptionKey: "CMD_VIGILANCE_DESC", cost: { wood: 15 }, reqTrialOrLowDefense: true, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_MUD_OBSTACLE", category: "COMMAND", nameKey: "CMD_MUD_OBSTACLE_NAME", descriptionKey: "CMD_MUD_OBSTACLE_DESC", cost: { wood: 15 }, reqWetlandOrLake: true, reqTrialNotice: true, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_HIGH_GROUND_FORMATION", category: "COMMAND", nameKey: "CMD_HIGH_GROUND_FORMATION_NAME", descriptionKey: "CMD_HIGH_GROUND_FORMATION_DESC", cost: { wood: 10 }, reqHillOrMountain: true, reqTrialNotice: true, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_MILITARY_FOCUS", category: "MILITARY", nameKey: "CMD_MILITARY_FOCUS_NAME", descriptionKey: "CMD_MILITARY_FOCUS_DESC", cost: { wood: 20 }, maxDefense: 20, minStage: 1, rarity: "UC", weight: 0.30 },
    { id: "CMD_CAVALRY_SCOUTS", category: "COMMAND", nameKey: "CMD_CAVALRY_SCOUTS_NAME", descriptionKey: "CMD_CAVALRY_SCOUTS_DESC", cost: { food: 30, wood: 20 }, reqDiscoveredResourceTag: "HORSE", reqPlains: 6, reqTrialNotice: true, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_OUTPOST_SIGNAL", category: "COMMAND", nameKey: "CMD_OUTPOST_SIGNAL_NAME", descriptionKey: "CMD_OUTPOST_SIGNAL_DESC", cost: { wood: 15 }, reqOutpostOrHighGround: true, minStage: 2, rarity: "UC", weight: 0.25 },
    { id: "CMD_IRON_RAMPART", category: "MILITARY", nameKey: "CMD_IRON_RAMPART_NAME", descriptionKey: "CMD_IRON_RAMPART_DESC", cost: { wood: 20 }, reqWood: 20, minStage: 2, rarity: "UC", weight: 0.30 },
    { id: "CMD_BALLISTA_SET", category: "MILITARY", nameKey: "CMD_BALLISTA_SET_NAME", descriptionKey: "CMD_BALLISTA_SET_DESC", cost: { wood: 30 }, reqWood: 30, reqHillOrMountain: true, isUnique: true, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_GUIDED_DEFENSE", category: "COMMAND", nameKey: "CMD_GUIDED_DEFENSE_NAME", descriptionKey: "CMD_GUIDED_DEFENSE_DESC", cost: { wood: 20 }, reqConnectedHillOrForest: 3, minStage: 2, rarity: "C", weight: 0.35 },
    { id: "CMD_SCOUT_ENEMY", category: "COMMAND", nameKey: "CMD_SCOUT_ENEMY_NAME", descriptionKey: "CMD_SCOUT_ENEMY_DESC", cost: { food: 5 }, reqTrialNotice: true, minStage: 2, rarity: "C", weight: 0.35 },
    { id: "CMD_SCORCHED_RETREAT", category: "COMMAND", nameKey: "CMD_SCORCHED_RETREAT_NAME", descriptionKey: "CMD_SCORCHED_RETREAT_DESC", cost: { food: 20 }, reqTrialWithin: 3, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_CAVALRY_HOST", category: "COMMAND", nameKey: "CMD_CAVALRY_HOST_NAME", descriptionKey: "CMD_CAVALRY_HOST_DESC", cost: { food: 30, wood: 20 }, reqConnectedPlains: 12, reqFood: 40, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_LOCAL_IRON_ARMAMENT", category: "COMMAND", nameKey: "CMD_LOCAL_IRON_ARMAMENT_NAME", descriptionKey: "CMD_LOCAL_IRON_ARMAMENT_DESC", cost: { wood: 15 }, reqDiscoveredResourceTag: "IRON", reqTrialWithin: 6, minStage: 2, rarity: "UC", weight: 0.25 },
    { id: "CMD_STONE_STRONGPOINT", category: "COMMAND", nameKey: "CMD_STONE_STRONGPOINT_NAME", descriptionKey: "CMD_STONE_STRONGPOINT_DESC", cost: { wood: 20 }, reqDiscoveredResourceTag: "STONE", minStage: 2, rarity: "C", weight: 0.35 },

    // ✨ 神秘・奇跡カード
    { id: "CMD_MEDITATION", category: "COMMAND", nameKey: "CMD_MEDITATION_NAME", descriptionKey: "CMD_MEDITATION_DESC", cost: {}, maxMystic: 20, minStage: 1, rarity: "UC", weight: 0.30 },
    { id: "CMD_FILL_THE_VOID", category: "COMMAND", nameKey: "CMD_FILL_THE_VOID_NAME", descriptionKey: "CMD_FILL_THE_VOID_DESC", cost: {}, reqMystic: 5, minStage: 1, rarity: "C", weight: 0.35 },
    { id: "CMD_VOICE_BENEATH_EARTH", category: "COMMAND", nameKey: "CMD_VOICE_BENEATH_EARTH_NAME", descriptionKey: "CMD_VOICE_BENEATH_EARTH_DESC", cost: { mystic: 5 }, reqDiscoveredResourcesCount: 2, minStage: 1, rarity: "UC", weight: 0.25 },
    { id: "CMD_OMEN_DREAM", category: "COMMAND", nameKey: "CMD_OMEN_DREAM_NAME", descriptionKey: "CMD_OMEN_DREAM_DESC", cost: { mystic: 5 }, reqTrialWithin: 10, minStage: 1, rarity: "UC", weight: 0.25 },
    { id: "CMD_REKINDLE_EMBER", category: "MYSTIC", nameKey: "CMD_REKINDLE_EMBER_NAME", descriptionKey: "CMD_REKINDLE_EMBER_DESC", cost: { mystic: 10 }, reqMystic: 10, maxEmber: 5, minStage: 1, rarity: "UC", weight: 0.25 },
    { id: "CMD_MYSTIC_FOCUS", category: "MYSTIC", nameKey: "CMD_MYSTIC_FOCUS_NAME", descriptionKey: "CMD_MYSTIC_FOCUS_DESC", cost: { mystic: 10 }, maxMystic: 30, isUnique: true, minStage: 1, rarity: "R", weight: 0.15 },
    { id: "CMD_MANIFEST_MIRACLE", category: "COMMAND", nameKey: "CMD_MANIFEST_MIRACLE_NAME", descriptionKey: "CMD_MANIFEST_MIRACLE_DESC", cost: { mystic: 10 }, reqMystic: 10, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_TRANSMUTE_GOLDEN", category: "MYSTIC", nameKey: "CMD_TRANSMUTE_GOLDEN_NAME", descriptionKey: "CMD_TRANSMUTE_GOLDEN_DESC", cost: { mystic: 20 }, reqMystic: 20, reqUnmergedDesertOrMountain: true, isUnique: true, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_REVELATION_CHOICE", category: "COMMAND", nameKey: "CMD_REVELATION_CHOICE_NAME", descriptionKey: "CMD_REVELATION_CHOICE_DESC", cost: { mystic: 15 }, reqMystic: 15, minStage: 2, rarity: "R", weight: 0.20 },
    { id: "CMD_LEYLINE_RESONANCE", category: "COMMAND", nameKey: "CMD_LEYLINE_RESONANCE_NAME", descriptionKey: "CMD_LEYLINE_RESONANCE_DESC", cost: { mystic: 8 }, reqDiscoveredMysticResourcesCount: 2, minStage: 2, rarity: "C", weight: 0.35 },
    { id: "CMD_TWO_FUTURES", category: "COMMAND", nameKey: "CMD_TWO_FUTURES_NAME", descriptionKey: "CMD_TWO_FUTURES_DESC", cost: { mystic: 20 }, reqMystic: 25, isUnique: true, minStage: 3, rarity: "UR", weight: 0.10 }
];

class DeckManager {
    constructor(gameState, engine = null) {
        this.state = gameState;
        this.engine = engine;
        this._landCardMasterCache = null;
    }

    /**
     * 🎴 マスターデータベース（静的キャッシュ ＆ 即時解決）の取得
     */
    getLandCardMaster() {
        if (this._landCardMasterCache && this._landCardMasterCache.length > 0) {
            return this._landCardMasterCache;
        }

        let baseList = [];
        if (Array.isArray(LAND_CARDS_MASTER) && LAND_CARDS_MASTER.length > 0) {
            baseList = LAND_CARDS_MASTER;
        } else {
            const globalData = (typeof globalThis !== 'undefined' && globalThis.LAND_CARDS_DATA) ? globalThis.LAND_CARDS_DATA : (typeof window !== 'undefined' ? window.LAND_CARDS_DATA : null);
            if (Array.isArray(globalData) && globalData.length > 0) {
                baseList = globalData;
            }
        }

        // 土地カードマスターに全コマンドカードをマージ（重複排除）
        const map = new Map();
        for (const c of baseList) {
            if (c && c.id) map.set(c.id, c);
        }
        for (const c of COMMAND_CARDS_MASTER) {
            if (c && c.id) map.set(c.id, c);
        }
        this._landCardMasterCache = Array.from(map.values());
        return this._landCardMasterCache;
    }

    /**
     * 🔍 カード抽選適格性判定
     */
    isCardEligible(c, stageNum, h2Count) {
        if (!c) return false;
        const cardStage = c.minStage || 1;
        if (cardStage > stageNum) return false;

        // 🚫 バフ発動中は同系統バイアス付与カードの重複提示を遮断
        if (c.biasTarget || c.id === "CMD_LAND_FOCUS" || c.id === "CMD_MILITARY_FOCUS" || c.id === "CMD_MYSTIC_FOCUS") {
            if (this.state && (this.state.activeDrawBias || this.state.drawBias)) {
                return false;
            }
        }

        if (c.reqE2HillsOnBoard && h2Count < c.reqE2HillsOnBoard) return false;

        // ⛰️ 本営周囲に丘陵・山岳が1個以上あることを要求
        if (c.reqHillOrMountainAroundHQ && this.state) {
            if (!ConditionEvaluator.checkHillOrMountainAroundHQ(this.state)) return false;
        }

        // 🛡️ 本営周囲に丘陵・山岳が「0個」であることを要求 (否定条件)
        if (c.reqNoHillOrMountainAroundHQ && this.state) {
            if (!ConditionEvaluator.checkNoHillOrMountainAroundHQ(this.state)) return false;
        }

        if (c.reqUnmergedDesertOrMountain && this.state && this.state.grid) {
            const size = this.state.grid.length;
            let found = false;
            for (let r = 0; r < size; r++) {
                for (let cCol = 0; cCol < size; cCol++) {
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.placed && !cell.merged && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id;
                        if (tid === "GL0_DESERT" || tid === "E3_MOUNTAIN") { found = true; break; }
                    }
                }
                if (found) break;
            }
            if (!found) return false;
        }

        if (c.reqStage2End && this.state) {
            if (this.state.turn < 20) return false;
        }

        if (c.maxPlacedBlocks !== undefined && this.state && typeof this.state.countPlacedTiles === 'function') {
            if (this.state.countPlacedTiles() > c.maxPlacedBlocks) return false;
        }
        if (c.maxDefense !== undefined && this.state && typeof this.state.calculateTotalDefense === 'function') {
            if (this.state.calculateTotalDefense() > c.maxDefense) return false;
        }
        if (c.maxMystic !== undefined && this.state && this.state.mystic !== undefined) {
            if (this.state.mystic > c.maxMystic) return false;
        }
        if (c.maxFood !== undefined && this.state && this.state.food !== undefined) {
            if (this.state.food > c.maxFood) return false;
        }
        if (c.maxEmber !== undefined && this.state && this.state.ember !== undefined) {
            if (this.state.ember > c.maxEmber) return false;
        }
        if (c.reqTrialOrLowDefense && this.state) {
            const notice = (typeof this.state.getTrialNotice === 'function') ? this.state.getTrialNotice() : { active: false };
            const def = (typeof this.state.calculateTotalDefense === 'function') ? this.state.calculateTotalDefense() : (this.state.defense || 0);
            if (!notice.active && def > 30) return false;
        }

        if (c.noSocketsOnBoard && this.state && this.state.grid) {
            const size = this.state.grid.length;
            let hasSocket = false;
            for (let r = 0; r < size; r++) {
                for (let cCol = 0; cCol < size; cCol++) {
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.socketResource) {
                        hasSocket = true;
                        break;
                    }
                }
                if (hasSocket) break;
            }
            if (hasSocket) return false;
        }

        if (c.reqWood !== undefined && this.state && this.state.wood < c.reqWood) return false;
        if (c.reqFood !== undefined && this.state && this.state.food < c.reqFood) return false;

        if (c.reqPlains !== undefined && this.state && this.state.grid) {
            const size = this.state.grid.length;
            let plainsCount = 0;
            for (let r = 0; r < size; r++) {
                for (let cCol = 0; cCol < size; cCol++) {
                    const cell = this.state.grid[r][cCol];
                    if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                        const tid = cell.terrain.terrainId || cell.terrain.id || "";
                        if (tid.includes("PLAINS")) plainsCount++;
                    }
                }
            }
            if (plainsCount < c.reqPlains) return false;
        }

        if (c.reqMystic !== undefined && this.state && (this.state.mystic || 0) < c.reqMystic) return false;

        // ⚠️ 試練予告中 (残り5T以内または notice.active)
        if (c.reqTrialNotice && this.state) {
            const notice = (typeof this.state.getTrialNotice === 'function') ? this.state.getTrialNotice() : { active: false };
            const nextTrialTurn = this.state.nextTrialTurn || 20;
            const currentTurn = this.state.turn || 1;
            const isNotice = (notice && notice.active) || (nextTrialTurn - currentTurn <= 5);
            if (!isNotice) return false;
        }

        // ⏳ 試練までの残りターン数判定 (<= N)
        if (c.reqTrialWithin !== undefined && this.state) {
            const nextTrialTurn = this.state.nextTrialTurn || 20;
            const currentTurn = this.state.turn || 1;
            if ((nextTrialTurn - currentTurn) > c.reqTrialWithin) return false;
        }

        // 🗺️ 盤面に丘陵または山岳が存在すること
        if (c.reqHillOrMountain && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_HILL_OR_MOUNTAIN" }, { state: this.state })) return false;
        }

        // 💧 盤面に湿原または湖が存在すること
        if (c.reqWetlandOrLake && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_WETLAND_OR_LAKE" }, { state: this.state })) return false;
        }

        // 🌲 盤面に森が指定数以上存在すること
        if (c.reqForest !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_FOREST", value: c.reqForest }, { state: this.state })) return false;
        }

        // 💎 発見済みソケット資源タグ判定 (単一: reqDiscoveredResourceTag / 複数配列: reqDiscoveredResourceTags)
        if (c.reqDiscoveredResourceTag && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "SOCKET_FOUND", category: c.reqDiscoveredResourceTag }, { state: this.state })) return false;
        }
        if (c.reqDiscoveredResourceTags && Array.isArray(c.reqDiscoveredResourceTags) && this.state) {
            for (const tag of c.reqDiscoveredResourceTags) {
                if (!ConditionEvaluator.evaluate({ type: "SOCKET_FOUND", category: tag }, { state: this.state })) return false;
            }
        }

        // 💎 発見済みユニーク資源数判定
        if (c.reqDiscoveredResourcesCount !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "DISCOVERED_RESOURCES_COUNT", value: c.reqDiscoveredResourcesCount }, { state: this.state })) return false;
        }

        // ✨ 発見済み神秘系資源数判定
        if (c.reqDiscoveredMysticResourcesCount !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "DISCOVERED_MYSTIC_RESOURCES_COUNT", value: c.reqDiscoveredMysticResourcesCount }, { state: this.state })) return false;
        }

        // 🔗 連結した指定地形の最大マス数判定
        if (c.reqConnectedPlains !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "CONNECTED_TERRAIN_AT_LEAST", terrainType: "PLAINS", value: c.reqConnectedPlains }, { state: this.state })) return false;
        }
        if (c.reqConnectedHillOrForest !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "CONNECTED_TERRAIN_AT_LEAST", terrainType: "HILL_OR_FOREST", value: c.reqConnectedHillOrForest }, { state: this.state })) return false;
        }
        // 🌲 盤面に森または森丘陵が指定数以上存在すること
        if (c.reqForestOrHillForest !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_FOREST_OR_HILL_FOREST", value: c.reqForestOrHillForest }, { state: this.state })) return false;
        }

        // 💧 盤面に湿原が指定数以上存在すること
        if (c.reqWetland !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_WETLAND", value: c.reqWetland }, { state: this.state })) return false;
        }

        // 🔲 盤面の空きマス数判定
        if (c.reqEmptyCells !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "EMPTY_CELLS_AT_LEAST", value: c.reqEmptyCells }, { state: this.state })) return false;
        }

        // 🏜️ 未マージの砂漠または山岳が存在すること
        if (c.reqUnmergedDesertOrMountain && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_UNMERGED_DESERT_OR_MOUNTAIN" }, { state: this.state })) return false;
        }

        // 🗼 前哨塔または丘陵/山岳が存在すること
        if (c.reqOutpostOrHighGround && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "HAS_OUTPOST_OR_HIGH_GROUND" }, { state: this.state })) return false;
        }

        // 📦 盤面に配置済みのブロック数上限
        if (c.maxPlacedBlocks !== undefined && this.state) {
            if (!ConditionEvaluator.evaluate({ type: "PLACED_BLOCKS_AT_MOST", value: c.maxPlacedBlocks }, { state: this.state })) return false;
        }

        // 🛡️ 防衛力の上限
        if (c.maxDefense !== undefined && this.state && (this.state.defense || 0) > c.maxDefense) return false;

        // 🧱 資材保有量判定
        if (c.reqWood !== undefined && this.state && (this.state.wood || 0) < c.reqWood) return false;

        if (c.isUnique && this.state && this.state.usedUniqueCards && this.state.usedUniqueCards.includes(c.id)) {
            return false;
        }

        return true;
    }

    /**
     * 🎲 単一カードの重み付け抽選
     * @param {Array<string>} [excludedCardIds=[]] - 同一オファリング内・保留枠で重複排除するカードIDリスト (土地・コマンド両対応)
     */
    drawSingleCard(excludedCardIds = []) {
        const master = this.getLandCardMaster();
        const stageNum = (this.state && this.state.stage) ? (typeof this.state.stage === 'object' ? (this.state.stage.id || 1) : this.state.stage) : 1;
        const h2Count = (this.state && typeof this.state.countE2HillsOnBoard === 'function') ? this.state.countE2HillsOnBoard() : 0;

        let eligible = master.filter(c => this.isCardEligible(c, stageNum, h2Count));

        // 🛡️ 同一オファリング内における完全同一カード（土地・コマンド問わず）の重複排除
        if (Array.isArray(excludedCardIds) && excludedCardIds.length > 0) {
            const filteredEligible = eligible.filter(c => !excludedCardIds.includes(c.id));
            if (filteredEligible.length > 0) {
                eligible = filteredEligible;
            }
        }

        if (eligible.length === 0) {
            eligible = master.filter(c => (c.category === "LAND" || !c.category) && (c.minStage || 1) <= stageNum);
        }

        const activeBiasCategory = (this.state && this.state.activeDrawBias) ? this.state.activeDrawBias.targetCategory : null;

        let totalW = eligible.reduce((acc, c) => {
            let w = c.weight || 0.1;
            const cat = c.category || "LAND";
            let dirMult = 1.0;
            if (this.state && this.state.directiveSystem) {
                dirMult = this.state.directiveSystem.getCategoryWeightMultiplier(cat);
            }
            let biasMult = 1.0;
            if (activeBiasCategory && cat === activeBiasCategory) {
                biasMult = 2.0;
            }
            return acc + (w * dirMult * biasMult);
        }, 0);

        let rand = Math.random() * totalW;
        let chosen = eligible[0];

        for (let c of eligible) {
            let w = c.weight || 0.1;
            const cat = c.category || "LAND";
            let dirMult = 1.0;
            if (this.state && this.state.directiveSystem) {
                dirMult = this.state.directiveSystem.getCategoryWeightMultiplier(cat);
            }
            let biasMult = 1.0;
            if (activeBiasCategory && cat === activeBiasCategory) {
                biasMult = 2.0;
            }
            const finalW = w * dirMult * biasMult;
            if (rand <= finalW) {
                chosen = c;
                break;
            }
            rand -= finalW;
        }

        const picked = chosen || eligible[0] || master[0];
        return {
            id: `card_${(this.state ? this.state.turn : 1)}_${Date.now()}_${Math.random()}`,
            cardMasterId: picked.id,
            nameKey: picked.nameKey,
            terrain: picked,
            currentShape: picked.shape || [[1]]
        };
    }

    /**
     * 🃏 手札オファリングの生成 (標準 3 枚 ＆ 同一カード完全重複排除)
     */
    generateOfferingCards() {
        const offeringSize = (this.state && this.state.handOfferingSize) ? this.state.handOfferingSize : 3;
        const newCards = [];
        const excludedCardIds = [];

        // 📥 保留スロットにあるコマンドカードも手札重複から除外
        if (this.state && this.state.reserveSlots) {
            this.state.reserveSlots.forEach(rc => {
                if (rc && !rc.isBlank) {
                    const tObj = rc.terrain || rc;
                    if (tObj && tObj.category && tObj.category !== "LAND") {
                        const mId = rc.cardMasterId || tObj.id || rc.id;
                        if (mId) excludedCardIds.push(mId);
                    }
                }
            });
        }

        for (let i = 0; i < offeringSize; i++) {
            const drawn = this.drawSingleCard(excludedCardIds);
            newCards.push(drawn);
            if (drawn) {
                const cId = drawn.cardMasterId || (drawn.terrain ? drawn.terrain.id : null);
                if (cId) excludedCardIds.push(cId);
            }
        }

        if (this.state) {
            this.state.handOffering = newCards;
            this.state.offeringCards = newCards;
        }
        return newCards;
    }

    /**
     * 🎲 1ターン1回マリガン実行 (🔥-1, 連続使用遮断)
     */
    mulligan() {
        if (!this.state) return { success: false, reason: "NO_STATE" };
        if (this.state.hasPickedThisTurn) return { success: false, reason: "ALREADY_PICKED_THIS_TURN" };
        if (this.state.hasMulliganedThisTurn) return { success: false, reason: "ALREADY_MULLIGANED_THIS_TURN" };
        if (this.state.ember < 1) return { success: false, reason: "INSUFFICIENT_EMBER" };

        if (this.state.emberSystem && typeof this.state.emberSystem.consume === 'function') {
            this.state.emberSystem.consume(1);
        } else {
            this.state.ember -= 1;
        }
        this.state.hasMulliganedThisTurn = true;
        this.generateOfferingCards();

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_MULLIGAN_EXECUTED") || "🎲 マリガン実行: 🔥 -1 を消費して手札を再抽選しました。");
        }

        return { success: true };
    }

    /**
     * 📥 手札 ➔ 保留スロットへの移動 (最大3枠)
     */
    moveToReserve(cardIdx) {
        if (!this.state || !this.state.handOffering || !this.state.reserveSlots) return false;
        const card = this.state.handOffering[cardIdx];
        if (!card || card.isBlank) return false;

        const emptyIdx = this.state.reserveSlots.findIndex(slot => slot === null);
        if (emptyIdx === -1) return false;

        card.originalHandIdx = cardIdx;
        this.state.reserveSlots[emptyIdx] = card;

        // 手札の抜け部分はカード裏表示 (isBlank: true)
        this.state.handOffering[cardIdx] = {
            isBlank: true,
            originalCard: card,
            id: `blank_${cardIdx}`
        };

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const cName = card.terrain ? I18n.t(card.terrain.nameKey) : "土地カード";
        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_RESERVE_ADDED", { name: cName, slot: emptyIdx + 1 }) || `📥 保留登録: ${cName} を保留スロット ${emptyIdx + 1} へ移動。`);
        }
        return true;
    }

    /**
     * 📤 保留スロット ➔ 手札への復元
     */
    returnFromReserve(reserveIdx, specificTargetIdx = -1) {
        if (!this.state || !this.state.handOffering || !this.state.reserveSlots) return false;
        const card = this.state.reserveSlots[reserveIdx];
        if (!card) return false;

        // 手札に空きスロット (isBlank: true) が存在するか走査
        let targetIdx = -1;
        if (typeof specificTargetIdx === "number" && specificTargetIdx >= 0 && specificTargetIdx < this.state.handOffering.length && this.state.handOffering[specificTargetIdx] && this.state.handOffering[specificTargetIdx].isBlank) {
            targetIdx = specificTargetIdx;
        } else {
            const origIdx = card.originalHandIdx;
            if (origIdx !== undefined && this.state.handOffering[origIdx] && this.state.handOffering[origIdx].isBlank) {
                targetIdx = origIdx;
            } else {
                targetIdx = this.state.handOffering.findIndex(c => c && c.isBlank);
            }
        }

        if (targetIdx !== -1) {
            this.state.handOffering[targetIdx] = card;
            delete card.originalHandIdx;
            this.state.reserveSlots[reserveIdx] = null;

            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
            const cName = card.terrain ? I18n.t(card.terrain.nameKey) : "土地カード";
            if (typeof this.state.addLog === 'function') {
                this.state.addLog(I18n.t("LOG_RESERVE_RETURNED", { name: cName }) || `↩ [保留復元] ${cName} を手札に戻しました。`);
            }
            return true;
        }

        // 手札が満杯の場合は何もしない（カード消失防止）
        return false;
    }

    /**
     * 📜 コマンドカードの発動処理
     */
    playCommandCard(cardObj, targetTile = null, handIdx = -1, reserveIdx = -1) {
        if (!this.state || !cardObj || cardObj.category === "LAND") return { success: false, reason: "NOT_A_COMMAND_CARD" };

        const cost = cardObj.cost || {};
        const matCost = cost.material !== undefined ? cost.material : (cost.wood || 0);
        const curMat = Math.max(this.state.material !== undefined ? this.state.material : 0, this.state.wood !== undefined ? this.state.wood : 0);

        if (cost.food && this.state.food < cost.food) return { success: false, reason: "NOT_ENOUGH_FOOD" };
        if (matCost > 0 && curMat < matCost) return { success: false, reason: "NOT_ENOUGH_MATERIAL" };
        if (cost.mystic && this.state.mystic < cost.mystic) return { success: false, reason: "NOT_ENOUGH_MYSTIC" };
        if (cost.ember && this.state.ember < cost.ember) return { success: false, reason: "NOT_ENOUGH_EMBER" };

        if (cost.food) this.state.food -= cost.food;
        if (matCost > 0) {
            this.state.wood = Math.max(0, (this.state.wood || 0) - matCost);
            this.state.material = this.state.wood;
        }
        if (cost.mystic) this.state.mystic -= cost.mystic;
        if (cost.ember) this.state.ember -= cost.ember;

        const cId = cardObj.id;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const cName = I18n.t(cardObj.nameKey) || I18n.t(`${cardObj.id}_NAME`) || I18n.t(cardObj.id) || cardObj.id;
        const cDesc = I18n.t(`${cardObj.id}_DESC`) || "";

        // 🎴 発動スロットの消費（手札の場合は空きスロット化、保留の場合は空スロット化）
        if (handIdx >= 0 && this.state.handOffering && this.state.handOffering[handIdx]) {
            this.state.handOffering[handIdx] = { isBlank: true, originalCard: cardObj, id: `blank_${handIdx}_${Date.now()}` };
            this.state.hasPickedThisTurn = true;
        } else if (reserveIdx >= 0 && this.state.reserveSlots) {
            this.state.reserveSlots[reserveIdx] = null;
            this.state.hasPickedThisTurn = true;
        }

        if (cId === "CMD_AGRICULTURAL_POLICY") {
            // 🌾 農地改革: コスト 🧱-20
            this.state.permanentPlainsFoodBonus = (this.state.permanentPlainsFoodBonus || 0) + 1;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `📜【${cName}】`);
        } else if (cId === "CMD_BLACK_MARKET") {
            // 💰 闇市場の一括売却: コスト 🌾-25
            this.state.wood += 35;
            this.state.mystic += 10;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `📜【${cName}】`);
        } else if (cId === "CMD_IRON_RAMPART") {
            // 🛡️ 鉄壁の防壁構築: コスト 🧱-20
            this.state.defense += 25;
            this.state.permanentVicinityDefenseBonus = (this.state.permanentVicinityDefenseBonus || 0) + 2;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🛡️【${cName}】`);
        } else if (cId === "CMD_BALLISTA_SET") {
            // 🏹 迎撃用弩砲陣地: コスト 🧱-30
            this.state.defense += 40;
            this.state.nextTrialDamageMitigation = 0.5;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🏹",
                description: cDesc,
                badgeText: I18n ? I18n.t("UI_DEFENSE_TRIAL_TAG") : "試練対策",
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏹【${cName}】`);
        } else if (cId === "CMD_REKINDLE_EMBER") {
            // ✨ 🔥の聖なる再燃: コスト ✨-10
            this.state.ember = this.state.ember + 3;
            this.state.reserveFeeWaivedTurns = 3;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "✨",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T",
                category: "CARD_EFFECT",
                remainingTurns: 3
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `✨【${cName}】`);
        } else if (cId === "CMD_TRANSMUTE_GOLDEN") {
            // 💎 黄金秘境への変容: コスト ✨-20
            if (targetTile && targetTile.r !== undefined && targetTile.c !== undefined && this.state.grid) {
                const cell = this.state.grid[targetTile.r][targetTile.c];
                cell.socketResource = { nameKey: "SOCKET_SACRED_VEIN", bonusMystic: 5, bonusEmber: 1 };
                this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💎【${cName}】`);
            } else {
                this.state.mystic += 10;
                this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `💎【${cName}】`);
            }
        } else if (cId === "FAC_GREAT_WINDMILL") {
            // 🏛️ 大風車工房の建設: コスト 🧱-15
            if (!this.state.activeConstructionProjects) this.state.activeConstructionProjects = [];
            this.state.activeConstructionProjects.push({ name: "FAC_GREAT_WINDMILL", remainingTurns: 3, woodCostPerTurn: 4 });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏛️【${cName}】`);
        } else if (cId === "LGD_DESPERATE_PACT") {
            // 📜 背水の盟約: コスト なし
            this.state.ember = this.state.ember + 5;
            this.state.handOfferingSize = 4;
            this.state.nextTrialMultiplier = 1.5;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔥【${cName}】`);
        } else if (cId === "CMD_LAND_FOCUS") {
            // 📜 土地探索重視: コスト 🌾-10 🧱-10
            this.state.activeDrawBias = { targetCategory: "LAND", type: "UNTIL_BLOCKS", untilValue: 6 };
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "📜",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            if (typeof this.state.checkConditionalBuffs === "function") this.state.checkConditionalBuffs();
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `📜【${cName}】`);
        } else if (cId === "CMD_MILITARY_FOCUS") {
            // ⚔️ 軍事重視: コスト 🧱-20
            this.state.activeDrawBias = { targetCategory: "MILITARY", type: "UNTIL_DEFENSE", untilValue: 20 };
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🛡️",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            if (typeof this.state.checkConditionalBuffs === "function") this.state.checkConditionalBuffs();
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⚔️【${cName}】`);
        } else if (cId === "CMD_MYSTIC_FOCUS") {
            // ✨ 神秘重視: コスト 🔥-1
            this.state.activeDrawBias = { targetCategory: "MYSTIC", type: "TURNS", remainingTurns: 3 };
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "✨",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T",
                category: "CARD_EFFECT",
                remainingTurns: 3
            });
        } else if (cId === "CMD_CONSERVE_EMBER") {
            // 🔥 残火の節約: コスト 無料
            this.state.emberConsumptionReducedTurns = 1;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🔥",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔥【${cName}】`);
        } else if (cId === "CMD_RATIONING") {
            // 🌾 節約配給: コスト 無料
            this.state.foodCostHalvedTurns = 1;
            this.state.food += 5;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🌾",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌾【${cName}】`);
        } else if (cId === "CMD_MEDITATION") {
            // 🧘 静かなる瞑想: コスト 無料
            this.state.mystic += 3;
            this.state.activeDrawBias = { targetCategory: "LAND", type: "TURNS", remainingTurns: 1 };
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🧘",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🧘【${cName}】`);
        } else if (cId === "CMD_VIGILANCE") {
            // 🛡️ 警戒態勢: コスト 🧱-15 (2ターンの間、獲得する全ての🛡️に+3ボーナス)
            this.state.vigilanceTurns = 2;
            this.state.temporaryDefenseTurns = 2;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🛡️",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 2 }) : "2T",
                category: "CARD_EFFECT",
                remainingTurns: 2
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🛡️【${cName}】`);
        } else if (cId === "CMD_GRAND_CULTIVATION") {
            // 🌾 大規模耕作計画: コスト 🧱-35 (4ターンの間、草原の産出 🌾+1/T)
            this.state.grandCultivationTurns = 4;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🌾",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 4 }) : "4T",
                category: "CARD_EFFECT",
                remainingTurns: 4
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌾【${cName}】`);
        } else if (cId === "CMD_EMERGENCY_LEVY") {
            // 🧱 緊急徴発: コスト 🌾-20 (即座に 🧱+15、次ターン食料維持費 +5)
            this.state.wood = (this.state.wood || 0) + 15;
            this.state.emergencyLevyTurns = 1;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "⚠️",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "DEBUFF",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⚠️【${cName}】`);
        } else if (cId === "CMD_MANIFEST_MIRACLE") {
            // ✨ 奇跡の顕現: コスト ✨-10 (3ターンの間、不足資源補填レート 3→1)
            this.state.manifestMiracleTurns = 3;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "✨",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T",
                category: "CARD_EFFECT",
                remainingTurns: 3
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `✨【${cName}】`);
        } else if (cId === "CMD_FILL_THE_VOID") {
            // ✨ 届かぬ資材を満たすもの: コスト 無料 (今ターンのみ不足資源補填可能)
            this.state.fillTheVoidTurns = 1;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "✨",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `✨【${cName}】`);
        } else if (cId === "CMD_SCORCHED_RETREAT") {
            // 🔥 焦土退却: コスト 🌾-20 (試練後3ターン土地産出 -1/T)
            this.state.scorchedRetreatTurns = 3;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🔥",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T",
                category: "DEBUFF",
                remainingTurns: 3
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔥【${cName}】`);
        } else if (cId === "CMD_RESETTLEMENT") {
            // 👥 人口移住令: コスト 🌾-15 🧱-10 (平地2x2マージ指定 🔥+2 ＆ 🌾+2/T永続)
            this.state.ember = Math.min(30, (this.state.ember || 20) + 2);
            this.state.resettlementFoodBonus = (this.state.resettlementFoodBonus || 0) + 2;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "👥",
                description: cDesc,
                category: "PERMANENT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `👥【${cName}】`);
        } else if (cId === "CMD_GREAT_RAMPART_PROJECT") {
            // 🏯 特別プロジェクト：大防塁 (4T継続投資 🧱-45/T ＆ 試練進軍効率大幅低下)
            this.state.greatRampartTurns = 4;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🏯",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 4 }) : "4T",
                category: "PROJECT",
                remainingTurns: 4
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏯【${cName}】`);
        } else if (cId === "CMD_OUTPOST") {
            // 🗼 前哨塔: コスト 🧱-25 (試練侵攻情報を3T早く取得)
            this.state.hasOutpost = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🗼",
                description: cDesc,
                category: "PERMANENT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🗼【${cName}】`);
        } else if (cId === "CMD_GUIDED_DEFENSE") {
            // 🚧 誘導防衛: コスト 🧱-20 (試練時敵移動コスト+1)
            this.state.guidedDefenseActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🚧",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🚧【${cName}】`);
        } else if (cId === "CMD_HIGH_GROUND_FORMATION") {
            // ⛰️ 高地布陣: コスト 🧱-10 (試練時高地戦術補正強化)
            this.state.highGroundFormationActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "⛰️",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⛰️【${cName}】`);
        } else if (cId === "CMD_CAVALRY_HOST") {
            // 🐎 騎馬軍編成: コスト 🌾-30 🧱-20 (試練時平地機動補正)
            this.state.cavalryHostActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🐎",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐎【${cName}】`);
        } else if (cId === "CMD_REVELATION_CHOICE") {
            // ✨ 天啓の選択: コスト ✨-15 (次ターン指定カテゴリ枠確定)
            this.state.revelationChoiceTurns = 1;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "✨",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `✨【${cName}】`);
        } else if (cId === "CMD_TWO_FUTURES") {
            // 🔮 二つの未来: コスト ✨-20 (次ターン2組手札オファリング)
            this.state.twoFuturesTurns = 1;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🔮",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔮【${cName}】`);
        } else if (cId === "CMD_PASTORAL_EXPANSION") {
            // 🐑 放牧地の拡大: コスト 🧱-10 (次回同属性接続ボーナス強化)
            this.state.pastoralExpansionActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🐑",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐑【${cName}】`);
        } else if (cId === "CMD_LIME_CONSTRUCTION") {
            // 🧱 石灰焼成: コスト 🌾-10 (次回高コスト建築軽減)
            this.state.limeConstructionActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🧱",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🧱【${cName}】`);
        } else if (cId === "CMD_CAVALRY_SCOUTS") {
            // 🐎 騎馬斥候隊: コスト 🌾-10 (試練時平地迎撃/増援コスト軽減)
            this.state.cavalryScoutsActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🐎",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🐎【${cName}】`);
        } else if (cId === "CMD_LOCAL_IRON_ARMAMENT") {
            // ⚔️ 在地鉄器武装: コスト 🧱-15 (赤鉄鉱丘陵の迎撃高地補正強化)
            this.state.localIronArmamentActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "⚔️",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `⚔️【${cName}】`);
        } else if (cId === "CMD_STONE_STRONGPOINT") {
            // 🏰 石造陣地: コスト 🧱-20 (石材地形の初期地形減衰強化)
            this.state.stoneStrongpointActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🏰",
                description: cDesc,
                category: "TACTICAL"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🏰【${cName}】`);
        } else if (cId === "CMD_LEYLINE_RESONANCE") {
            // ✨ 地脈の共鳴: コスト ✨-8 (次回✨不足補填枠拡大)
            this.state.leylineResonanceActive = true;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "✨",
                description: cDesc,
                category: "CARD_EFFECT"
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `✨【${cName}】`);
        } else if (cId === "CMD_VOICE_BENEATH_EARTH") {
            // 🔮 大地の囁き: コスト ✨-5 (次ターン発見資源連動オファリング)
            this.state.voiceBeneathEarthTurns = 1;
            this.state.addBuff({
                id: cId,
                name: cName,
                shortName: cName,
                icon: "🔮",
                description: cDesc,
                badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 1 }) : "1T",
                category: "CARD_EFFECT",
                remainingTurns: 1
            });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔮【${cName}】`);
        } else if (cId === "CMD_SINGLE_CLEARING") {
            // 🪓 伐採: コスト 🔥-1 (森1マス伐採・平地化、🧱+20, 🌾+3)
            let cleared = false;
            if (this.state.grid) {
                for (let r = 0; r < this.state.grid.length && !cleared; r++) {
                    for (let c = 0; c < this.state.grid[r].length && !cleared; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id || "";
                            if (tid.includes("FOREST")) {
                                cell.terrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, food: 4, wood: 0, defense: 0, mystic: 0, category: "BASE" };
                                cleared = true;
                            }
                        }
                    }
                }
            }
            this.state.wood = (this.state.wood || 0) + 20;
            this.state.food = (this.state.food || 0) + 3;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🪓", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🪓【${cName}】`);
        } else if (cId === "CMD_WETLAND_RECLAMATION") {
            // 🌾 干拓: コスト 🧱-15, 🔥-1 (湿原1マスを平地転換)
            let reclaimed = false;
            if (this.state.grid) {
                for (let r = 0; r < this.state.grid.length && !reclaimed; r++) {
                    for (let c = 0; c < this.state.grid[r].length && !reclaimed; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id || "";
                            if (tid.includes("WETLAND")) {
                                cell.terrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, e: 1, food: 4, wood: 0, defense: 0, mystic: 0, category: "BASE" };
                                reclaimed = true;
                            }
                        }
                    }
                }
            }
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🌾", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌾【${cName}】`);
        } else if (cId === "CMD_SYSTEMATIC_LOGGING") {
            // 🌲 計画伐採: コスト 🌾-10 (森林マス数×🧱+6、3T森産出🧱-1/T)
            let forestCount = 0;
            if (this.state.grid) {
                for (let r = 0; r < this.state.grid.length; r++) {
                    for (let c = 0; c < this.state.grid[r].length; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && cell.terrain) {
                            const tid = cell.terrain.terrainId || cell.terrain.id || "";
                            if (tid.includes("FOREST")) forestCount++;
                        }
                    }
                }
            }
            this.state.wood = (this.state.wood || 0) + (forestCount * 6);
            this.state.systematicLoggingTurns = 3;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🌲", description: cDesc, badgeText: I18n ? I18n.t("BUFF_REMAINING_TURNS", { count: 3 }) : "3T", category: "DEBUFF", remainingTurns: 3 });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🌲【${cName}】`);
        } else if (cId === "CMD_ABANDONED_SETTLEMENT") {
            // 🎲 領土探索: コスト 🔥-1 (2D6判定)
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const roll = d1 + d2;
            if (roll <= 5) {
                this.state.food = (this.state.food || 0) + 15;
            } else if (roll <= 8) {
                this.state.wood = (this.state.wood || 0) + 15;
            } else if (roll <= 11) {
                this.state.mystic = (this.state.mystic || 0) + 10;
            } else {
                this.state.food = (this.state.food || 0) + 20;
                this.state.wood = (this.state.wood || 0) + 20;
                this.state.mystic = (this.state.mystic || 0) + 15;
            }
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🎲", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🎲【${cName}】`);
        } else if (cId === "CMD_MUD_OBSTACLE") {
            // 🛡️ 泥濘陣地: コスト 🧱-15 (試練時湿原/清湖敵制圧力-15%)
            this.state.mudObstacleActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🛡️", description: cDesc, category: "TACTICAL" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🛡️【${cName}】`);
        } else if (cId === "CMD_OUTPOST_SIGNAL") {
            // 🗼 狼煙: コスト 🧱-15 (侵攻情報2T早く取得 & 迎撃戦術補正+15%)
            this.state.outpostSignalActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🗼", description: cDesc, category: "TACTICAL" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🗼【${cName}】`);
        } else if (cId === "CMD_SCOUT_ENEMY") {
            // 🔍 敵情偵察: コスト 🌾-5 (試練敵情先行公開)
            this.state.scoutEnemyActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🔍", description: cDesc, category: "TACTICAL" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔍【${cName}】`);
        } else if (cId === "CMD_OMEN_DREAM") {
            // 🔮 予兆: コスト ✨-5 (試練先行情報公開)
            this.state.omenDreamActive = true;
            this.state.addBuff({ id: cId, name: cName, shortName: cName, icon: "🔮", description: cDesc, category: "CARD_EFFECT" });
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: cDesc }) : `🔮【${cName}】`);
        } else if (cId === "CMD_LAND_EXPLORATION") {
            const candidates = [];
            if (this.state.grid) {
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        const cell = this.state.grid[r][c];
                        if (cell && cell.placed && !cell.isHQ && !cell.searched && !cell.merged) {
                            candidates.push({ r, c });
                        }
                    }
                }
            }

            if (candidates.length === 0) {
                return { success: false, reason: "NO_EXPLORABLE_TILES" };
            }

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            const posStr = `${String.fromCharCode(65+chosen.c)}${chosen.r+1}`;
            this.state.addLog(I18n ? I18n.t("LOG_CMD_ACTIVATED", { name: cName, desc: `(${posStr}) 2D6` }) : `📜 ${cName}`);
            const expRes = this.executeExploration(chosen.r, chosen.c);
            return { success: expRes.success };
        }

        if (cardObj.isUnique) {
            if (!this.state.usedUniqueCards) this.state.usedUniqueCards = [];
            this.state.usedUniqueCards.push(cId);
        }

        this.state.hasPickedThisTurn = true;
        return { success: true };
    }

    /**
     * 🔍 2D6 土地探索判定
     */
    executeExploration(r, c) {
        if (!this.state || !this.state.grid) return { success: false, reason: "NO_GRID" };
        const cell = this.state.grid[r][c];
        if (!cell || !cell.placed || cell.isHQ) return { success: false, reason: "INVALID_CELL" };
        if (cell.searched) return { success: false, reason: "ALREADY_SEARCHED" };

        cell.searched = true;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const totalRoll = d1 + d2;
        const posStr = `(${String.fromCharCode(65+c)}${r+1})`;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });

        let resultMsg = "";
        if (totalRoll >= 8) {
            if (!cell.socketResource) {
                const baseTerrainId = cell.terrain ? (cell.terrain.terrainId || cell.terrain.id) : "GL1_PLAINS";
                const sysMaster = (typeof globalThis !== 'undefined' && globalThis.LAND_SYSTEM_DATA && globalThis.LAND_SYSTEM_DATA.sockets) ? globalThis.LAND_SYSTEM_DATA.sockets : null;
                let socketDef = null;

                if (sysMaster && sysMaster[baseTerrainId]) {
                    const pool = sysMaster[baseTerrainId];
                    // 🌊 特殊水系判定
                    if ((baseTerrainId === "E0_WETLAND" || baseTerrainId.includes("WETLAND")) && Math.random() < 0.60) {
                        const lake = pool.find(s => s.id === "SOCKET_LAKE");
                        if (lake) {
                            socketDef = {
                                id: lake.id, nameKey: lake.nameKey, category: lake.category, icon: lake.icon,
                                bonusFood: lake.bonusYields.food || 0, bonusWood: lake.bonusYields.wood || 0,
                                bonusDefense: lake.bonusYields.defense || 0, bonusMystic: lake.bonusYields.mystic || 0
                            };
                        }
                    }
                    if (!socketDef) {
                        const candidates = pool.filter(s => !s.isSpecialWater && (s.weight || 0) > 0);
                        const validPool = candidates.length > 0 ? candidates : pool;
                        const totalWeight = validPool.reduce((sum, s) => sum + (s.weight || 1), 0);
                        let rand = Math.random() * totalWeight;
                        let chosen = validPool[0];
                        for (const s of validPool) {
                            const w = s.weight || 1;
                            if (rand < w) {
                                chosen = s;
                                break;
                            }
                            rand -= w;
                        }
                        socketDef = {
                            id: chosen.id,
                            nameKey: chosen.nameKey,
                            category: chosen.category,
                            icon: chosen.icon,
                            bonusFood: (chosen.bonusYields && chosen.bonusYields.food) || 0,
                            bonusWood: (chosen.bonusYields && (chosen.bonusYields.material !== undefined ? chosen.bonusYields.material : chosen.bonusYields.wood)) || 0,
                            bonusDefense: (chosen.bonusYields && chosen.bonusYields.defense) || 0,
                            bonusMystic: (chosen.bonusYields && chosen.bonusYields.mystic) || 0
                        };
                    }
                } else {
                    socketDef = { id: "SOCKET_WILD_WHEAT", nameKey: "SOCKET_WILD_WHEAT", category: "CAT_GRAIN", icon: "🌾", bonusFood: 3, bonusWood: 0, bonusDefense: 0, bonusMystic: 0 };
                }

                cell.socketResource = socketDef;
                const sName = I18n.t(socketDef.nameKey);
                resultMsg = `🎲 Roll ${totalRoll}: ★ ${sName}`;
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_SOCKET_SPAWNED", { name: sName }) });
                }
            } else {
                this.state.food += 3;
                this.state.wood += 3;
                resultMsg = `🎲 Roll ${totalRoll}: Success 🌾+3 🧱+3`;
                if (this.state.toastQueue) {
                    this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_SUCCESS") });
                }
            }
        } else if (totalRoll >= 5) {
            this.state.food += 2;
            resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+2`;
            if (this.state.toastQueue) {
                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_MED") });
            }
        } else {
            this.state.food += 1;
            resultMsg = `🎲 Roll ${totalRoll}: Result 🌾+1`;
            if (this.state.toastQueue) {
                this.state.toastQueue.push({ r, c, text: I18n.t("TOAST_EXPLORATION_LOW") });
            }
        }

        if (typeof this.state.addLog === 'function') {
            this.state.addLog(I18n.t("LOG_EXPLORATION_RESULT", { pos: posStr, result: resultMsg }));
        }
        return { success: true };
    }

    /**
     * 🔄 ターン進行時のリフレッシュ（マリガン権回復）
     */
    onNextTurn() {
        if (!this.state) return;
        this.state.turn++;
        this.state.hasPickedThisTurn = false;
        this.state.hasMulliganedThisTurn = false;
        this.generateOfferingCards();
    }
}

if (typeof window !== "undefined") {
    window.DeckManager = DeckManager;
    window.Step1DrawSystem = DeckManager;
}
if (typeof globalThis !== "undefined") {
    globalThis.DeckManager = DeckManager;
    globalThis.Step1DrawSystem = DeckManager;
}

const Step1DrawSystem = DeckManager;
export { DeckManager, Step1DrawSystem };
export default DeckManager;

