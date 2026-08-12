/**
 * Trial of the Ages: Last Ember - v2 Unity-Ready Clean Architecture Logic
 * 
 * DESIGN PHILOSOPHY & UNITY C# MAPPING:
 * - Pure Javascript Game Logic separated from DOM UI/Rendering.
 * - 1-to-1 Mapping for Unity C# Monobehaviour / ScriptableObject conversion:
 *   - LeaderRole.cs (General, Prophet, Pioneer 3 Roles)
 *   - I18NTable.cs (Zero Encoding Mojibake Protection)
 *   - BoardModel.cs (Grid 5x5 / 7x7 / 9x9, A1..I9 Coordinates, Outermost Tile Invasion)
 *   - OutpostSystem.cs (Outpost Construction, 5 Constraints, Cost Scaling, 1-Direction Sight, Cap 3)
 *   - DefenseModel.cs (Real-time Non-cumulative Sum of Defense)
 *   - TrialManager.cs (1-Step Invasion Combat, Route Depletion, C-B Rank Balance Target)
 *   - ResonanceDrawSystem.cs (Hand Offering 3-Pick, Alignment Resonance Bias)
 *   - CitizenSpeechUI.cs (Into the Breach Style 1.2s Non-blocking Toast Popups)
 */

// ==========================================
// 1. I18N DICTIONARY (Zero Mojibake Protection)
// ==========================================
const I18N = {
    JA: {
        TITLE: "Trial of the Ages: Last Ember",
        SELECT_ROLE_TITLE: "🛡️ 指導者ロール (Leader Role) を選択せよ",
        ROLE_GENERAL_NAME: "🛡️ 将軍 (General)",
        ROLE_GENERAL_DESC: "【王道防衛】 場の全防衛力 +10% ✕ 迎撃戦術効果 +10%",
        ROLE_PROPHET_NAME: "✨ 預言者 (Prophet)",
        ROLE_PROPHET_DESC: "【上級者向け】 試練最長 7T 前予報 ✕ 予報中全産出 +10% ✕ 砂漠ドロー率UP",
        ROLE_PIONEER_NAME: "🌾 開拓者 (Pioneer)",
        ROLE_PIONEER_DESC: "【内政・省エネ】 中・高レア土地ドロー率UP ✕ 試練中全🔥行動コスト-1",
        
        STAGE_1: "5x5 盤面 (Stage 1)",
        STAGE_2: "7x7 盤面 (Stage 2)",
        STAGE_3: "9x9 盤面 (Stage 3)",

        ERR_MAX_OUTPOSTS: "全ラン拠点最大上限(3個)に達しています",
        ERR_STAGE_1_OUTPOST: "Stage 1 (5x5) では拠点建設は未解禁です",
        ERR_WOOD_SHORT: "資材 🧱 が足りません",
        ERR_EMBER_SHORT: "生命力 🔥 が足りません",
        ERR_TILES_SHORT: "開拓土地数が足りません",
        ERR_ALREADY_PLACED: "すでに土地が配置されているマスには建てられません",
        ERR_HQ_TILE: "本営マス自体には建てられません",
        ERR_DISTANCE_3: "本営から 3 マス以上離れる必要があります",
        ERR_ADJACENT_LAND: "配置済みの土地ブロックに 1 面以上隣接する必要があります",
        ERR_MOUNTAIN_ADJACENT: "H3 山岳に隣接するマスには拠点を出力できません",
        
        SPEECH_OUTPOST_BUILT: "前哨拠点が完成したぞ！方角を監視せよ！",
        SPEECH_DAMAGED: "防壁を固めろ！本営を守れ！",
        SPEECH_SURVIVED: "生き残った…！炎は消えていない！"
    }
};

function t(key, defaultVal = "") {
    return I18N.JA[key] || defaultVal || key;
}

// ==========================================
// 2. CONSTANTS & LEADER ROLES (Unity C# Structs)
// ==========================================
const LEADER_ROLES = {
    GENERAL: {
        id: "GENERAL",
        nameKey: "ROLE_GENERAL_NAME",
        descKey: "ROLE_GENERAL_DESC",
        defenseBonus: 0.10,      // 防衛力 +10%
        tacticsBonus: 0.10,      // 迎撃戦術効果 +10%
        forecastTurns: 5
    },
    PROPHET: {
        id: "PROPHET",
        nameKey: "ROLE_PROPHET_NAME",
        descKey: "ROLE_PROPHET_DESC",
        desertDrawBias: 20,     // 砂漠ドロー重み +20
        forecastTurns: 7,        // 7T 前超早期予報
        forecastYieldBonus: 0.10 // 7T 予報中の全産出 +10%
    },
    PIONEER: {
        id: "PIONEER",
        nameKey: "ROLE_PIONEER_NAME",
        descKey: "ROLE_PIONEER_DESC",
        uncommonDrawBias: 15,   // 中高レア土地重み +15
        fireCostDiscount: 1,     // 試練中 🔥 行動コスト -1 軽減
        forecastTurns: 5
    }
};

const BOARD_STAGES = {
    STAGE_1: { size: 5, hqCenter: { r: 2, c: 2 }, nameKey: "STAGE_1" },
    STAGE_2: { size: 7, hqCenter: { r: 3, c: 3 }, nameKey: "STAGE_2" },
    STAGE_3: { size: 9, hqCenter: { r: 4, c: 4 }, nameKey: "STAGE_3" }
};

const DIRECTION_ZONES = {
    NORTH: "NORTH", // Blue Zone (A1..E4)
    EAST:  "EAST",  // Gold Zone (F1..I5)
    SOUTH: "SOUTH", // Red Zone (E6..I9)
    WEST:  "WEST"   // Green Zone (A5..E9)
};

const TERRAIN_TYPES = {
    H1_PLAIN:    { id: "H1_PLAIN",    name: "平地", defense: 0, cost: 0 },
    GL1_GRASS:   { id: "GL1_GRASS",   name: "草原", defense: 1, food: 2 },
    GL2_FOREST:  { id: "GL2_FOREST",  name: "森林", defense: 2, wood: 2 },
    GL3_DEEP:    { id: "GL3_DEEP",    name: "密林", defense: 3, wood: 4 },
    H2_HILL:     { id: "H2_HILL",     name: "丘陵", defense: 3, stone: 3 },
    H3_MOUNTAIN: { id: "H3_MOUNTAIN", name: "山岳", defense: 5, stone: 1 },
    GL0_DESERT:  { id: "GL0_DESERT",  name: "砂漠", defense: 0, mystic: 3 }
};

// ==========================================
// 3. CORE GAME STATE (Unity GameState.cs)
// ==========================================
class GameState {
    constructor() {
        this.turn = 1;
        this.maxTurns = 50;
        this.ember = 20; // 🔥 生命線 (0で敗北, 1以上で50T完走勝利)
        
        // 指導者ロール
        this.leaderRole = LEADER_ROLES.GENERAL; // デフォルト: 将軍
        
        // リソース
        this.food = 50;   // 🌾
        this.wood = 50;   // 🧱
        this.mystic = 0;  // ✨
        
        // 盤面ステージ
        this.currentStageIndex = 0; // 0: 5x5, 1: 7x7, 2: 9x9
        this.stage = BOARD_STAGES.STAGE_1;
        
        // 拠点トラッキング
        this.outpostCount = 0;
        this.maxOutposts = 3; // 全ラン絶対上限
        this.outposts = [];
        
        // 盤面データ
        this.grid = [];
        this.initGrid(BOARD_STAGES.STAGE_3.size);
        
        // 手札ドロー
        this.handOffering = [];
        this.speechQueue = [];
    }

    setLeaderRole(roleId) {
        if (LEADER_ROLES[roleId]) {
            this.leaderRole = LEADER_ROLES[roleId];
        }
    }

    initGrid(maxSize) {
        this.grid = [];
        for (let r = 0; r < maxSize; r++) {
            const row = [];
            for (let c = 0; c < maxSize; c++) {
                row.push({
                    r, c,
                    placed: false,
                    terrain: null,
                    isOutpost: false,
                    isHQ: false
                });
            }
            this.grid.push(row);
        }
        this.updateHQPosition();
    }

    // 本営を現在 Stage の動的絶対中央へ固定設定
    updateHQPosition() {
        const maxSize = BOARD_STAGES.STAGE_3.size;
        for (let r = 0; r < maxSize; r++) {
            for (let c = 0; c < maxSize; c++) {
                this.grid[r][c].isHQ = false;
            }
        }
        const center = this.stage.hqCenter;
        this.grid[center.r][center.c].isHQ = true;
    }

    // リアルタイム 🛡️ 総和算出 (非累積の原則 ✕ 将軍ロールパッシブ +10%)
    calculateTotalDefense() {
        let total = 10; // 本営単体防衛力 🛡️ 10
        const activeSize = this.stage.size;
        
        for (let r = 0; r < activeSize; r++) {
            for (let c = 0; c < activeSize; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain) {
                    total += cell.terrain.defense || 0;
                }
                if (cell.isOutpost && cell.dormantTurns <= 0) {
                    total += 10; // 拠点パッシブ 🛡️ 10
                }
            }
        }

        // 将軍ロールパッシブ: 🛡️ 防衛力 +10%
        if (this.leaderRole && this.leaderRole.id === "GENERAL") {
            total = Math.floor(total * (1 + this.leaderRole.defenseBonus));
        }

        return total;
    }

    // 拠点スケーリングコスト
    getOutpostCost(count) {
        if (count === 0) return { wood: 60,  ember: 3, reqTiles: 12 };
        if (count === 1) return { wood: 120, ember: 5, reqTiles: 24 };
        if (count === 2) return { wood: 240, ember: 8, reqTiles: 40 };
        return null;
    }

    getPlacedTileCount() {
        let count = 0;
        const activeSize = this.stage.size;
        for (let r = 0; r < activeSize; r++) {
            for (let c = 0; c < activeSize; c++) {
                if (this.grid[r][c].placed) count++;
            }
        }
        return count;
    }

    getDirectionSector(r, c) {
        const centerR = this.stage.hqCenter.r;
        const centerC = this.stage.hqCenter.c;
        const dr = r - centerR;
        const dc = c - centerC;
        
        if (dr < 0 && Math.abs(dr) >= Math.abs(dc)) return DIRECTION_ZONES.NORTH;
        if (dc > 0 && Math.abs(dc) >= Math.abs(dr)) return DIRECTION_ZONES.EAST;
        if (dr > 0 && Math.abs(dr) >= Math.abs(dc)) return DIRECTION_ZONES.SOUTH;
        if (dc < 0 && Math.abs(dc) >= Math.abs(dr)) return DIRECTION_ZONES.WEST;
        return DIRECTION_ZONES.NORTH;
    }
}

// ==========================================
// 4. OUTPOST SYSTEM (Unity OutpostSystem.cs)
// ==========================================
class OutpostSystem {
    constructor(state) {
        this.state = state;
    }

    canBuildOutpost(r, c) {
        if (this.state.outpostCount >= this.state.maxOutposts) return { can: false, reason: t("ERR_MAX_OUTPOSTS") };
        if (this.state.currentStageIndex === 0) return { can: false, reason: t("ERR_STAGE_1_OUTPOST") };
        
        const cost = this.state.getOutpostCost(this.state.outpostCount);
        if (!cost) return { can: false, reason: "上限超え" };
        
        if (this.state.wood < cost.wood) return { can: false, reason: `${t("ERR_WOOD_SHORT")} (必要: 🧱 ${cost.wood})` };
        if (this.state.ember < cost.ember) return { can: false, reason: `${t("ERR_EMBER_SHORT")} (必要: 🔥 ${cost.ember})` };
        if (this.state.getPlacedTileCount() < cost.reqTiles) return { can: false, reason: `${t("ERR_TILES_SHORT")} (必要: ${cost.reqTiles} マス)` };

        const cell = this.state.grid[r][c];
        if (cell.placed) return { can: false, reason: t("ERR_ALREADY_PLACED") };
        if (cell.isHQ) return { can: false, reason: t("ERR_HQ_TILE") };

        const hq = this.state.stage.hqCenter;
        const dist = Math.abs(r - hq.r) + Math.abs(c - hq.c);
        if (dist < 3) return { can: false, reason: t("ERR_DISTANCE_3") };

        let hasAdjacentPlaced = false;
        const neighbors = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
        for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < this.state.stage.size && nc >= 0 && nc < this.state.stage.size) {
                if (this.state.grid[nr][nc].placed) hasAdjacentPlaced = true;
            }
        }
        if (!hasAdjacentPlaced) return { can: false, reason: t("ERR_ADJACENT_LAND") };

        for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < this.state.stage.size && nc >= 0 && nc < this.state.stage.size) {
                const nCell = this.state.grid[nr][nc];
                if (nCell.placed && nCell.terrain && nCell.terrain.id === "H3_MOUNTAIN") {
                    return { can: false, reason: t("ERR_MOUNTAIN_ADJACENT") };
                }
            }
        }

        return { can: true, cost };
    }

    buildOutpost(r, c) {
        const check = this.canBuildOutpost(r, c);
        if (!check.can) return check;

        const cost = check.cost;
        this.state.wood -= cost.wood;
        this.state.ember -= cost.ember;

        const sector = this.state.getDirectionSector(r, c);
        const outpost = {
            id: `outpost_${Date.now()}`,
            r, c,
            direction: sector,
            level: 1,
            dormantTurns: 0
        };

        const cell = this.state.grid[r][c];
        cell.isOutpost = true;
        this.state.outposts.push(outpost);
        this.state.outpostCount++;

        this.state.speechQueue.push({ r, c, text: t("SPEECH_OUTPOST_BUILT") });
        return { success: true, outpost };
    }
}

// ==========================================
// 5. RESONANCE DRAW SYSTEM & SHAPE UNLOCK
// ==========================================
class ResonanceDrawSystem {
    constructor(state) {
        this.state = state;
    }

    // 試練 (Stage) 突破連動の形状アンロックフィルタリング
    getUnlockedShapes() {
        if (this.state.currentStageIndex === 0) return ["1x1", "1x2"]; // Stage 1: 1〜2マスのみ
        if (this.state.currentStageIndex === 1) return ["1x1", "1x2", "1x3", "L3"]; // Stage 2: 3マス解禁
        return ["1x1", "1x2", "1x3", "L3", "1x4", "L4", "CONVEX4", "2x2"]; // Stage 3: 4マス全解禁
    }

    generateOfferingCards() {
        const pool = [
            { id: "C_PLAIN",    name: "🌱 平地ブロック", terrain: TERRAIN_TYPES.H1_PLAIN, weight: 100 },
            { id: "C_FOREST",   name: "🌲 森林ブロック", terrain: TERRAIN_TYPES.GL2_FOREST, weight: 100 },
            { id: "C_MOUNTAIN", name: "⛰️ 山岳ブロック", terrain: TERRAIN_TYPES.H3_MOUNTAIN, weight: 100 },
            { id: "C_DESERT",   name: "🏜️ 砂漠ブロック", terrain: TERRAIN_TYPES.GL0_DESERT, weight: 100 }
            // 清湖 (LAKE) は手札ドローから 100% 物理除外
        ];

        // 預言者ロールパッシブ: 砂漠ドロー率 UP
        if (this.state.leaderRole && this.state.leaderRole.id === "PROPHET") {
            pool.find(c => c.id === "C_DESERT").weight += this.state.leaderRole.desertDrawBias;
        }

        // 重み付けルーレットピック (3 択)
        const drawn = [];
        for (let i = 0; i < 3; i++) {
            const pick = this.weightedPick(pool);
            drawn.push({ ...pick, shape: "1x1" });
        }
        this.state.handOffering = drawn;
        return drawn;
    }

    weightedPick(pool) {
        const totalWeight = pool.reduce((acc, c) => acc + c.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const card of pool) {
            if (rand < card.weight) return card;
            rand -= card.weight;
        }
        return pool[0];
    }
}

// Global Export for Browser Test
if (typeof window !== "undefined") {
    window.V2UnityReadyEngine = {
        I18N,
        t,
        LEADER_ROLES,
        BOARD_STAGES,
        DIRECTION_ZONES,
        TERRAIN_TYPES,
        GameState,
        OutpostSystem,
        ResonanceDrawSystem
    };
}
