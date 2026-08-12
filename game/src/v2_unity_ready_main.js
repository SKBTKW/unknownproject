/**
 * Trial of the Ages: Last Ember - v2 Unity-Ready Clean Architecture Logic
 * 
 * DESIGN PHILOSOPHY & UNITY C# MAPPING:
 * - Pure Javascript Game Logic separated from DOM UI/Rendering.
 * - 1-to-1 Mapping for Unity C# Monobehaviour / ScriptableObject conversion:
 *   - BoardModel.cs (Grid 5x5 / 7x7 / 9x9, A1..I9 Coordinates, Outermost Tile Invasion)
 *   - OutpostSystem.cs (Outpost Construction, 5 Constraints, Cost Scaling, 1-Direction Sight, Cap 3)
 *   - DefenseModel.cs (Real-time Non-cumulative Sum of Defense)
 *   - TrialManager.cs (1-Step Invasion Combat, Route Depletion, C-B Rank Balance Target)
 *   - ResonanceDrawSystem.cs (Hand Offering 3-Pick, Alignment Resonance Bias)
 *   - CitizenSpeechUI.cs (Into the Breach Style 1.2s Non-blocking Toast Popups)
 */

// ==========================================
// 1. CONSTANTS & ENUMS (Unity C# Structs)
// ==========================================
const BOARD_STAGES = {
    STAGE_1: { size: 5, hqCenter: { r: 2, c: 2 }, name: "5x5 (Stage 1)" },
    STAGE_2: { size: 7, hqCenter: { r: 3, c: 3 }, name: "7x7 (Stage 2)" },
    STAGE_3: { size: 9, hqCenter: { r: 4, c: 4 }, name: "9x9 (Stage 3)" }
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
    GL0_DESERT:  { id: "GL0_DESERT",  name: "砂漠", defense: 0, mystic: 3 },
    LAKE:        { id: "LAKE",        name: "清湖", defense: 0, slowRate: 0.3 }
};

// ==========================================
// 2. CORE GAME STATE (Unity GameState.cs)
// ==========================================
class GameState {
    constructor() {
        this.turn = 1;
        this.maxTurns = 50;
        this.ember = 20; // 🔥 生命線 (0で敗北, 1以上で50T完走勝利)
        
        // リソース (ストック型)
        this.food = 50;   // 🌾
        this.wood = 50;   // 🧱
        this.mystic = 0;  // ✨
        
        // 盤面ステージ
        this.currentStageIndex = 0; // 0: 5x5, 1: 7x7, 2: 9x9
        this.stage = BOARD_STAGES.STAGE_1;
        
        // 拠点 (Outpost) トラッキング
        this.outpostCount = 0;
        this.maxOutposts = 3; // 全ラン絶対上限
        this.outposts = []; // [{ id, r, c, direction, level, dormantTurns }]
        
        // 盤面データ (2D Grid Array)
        this.grid = [];
        this.initGrid(BOARD_STAGES.STAGE_3.size); // 9x9を最大サイズとして確保
        
        // 手札ドロー
        this.handOffering = [];
        
        // ログ ＆ 市民フキダシキュー
        this.speechQueue = [];
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
                    isHQ: (r === 4 && c === 4) // 中心E5(4,4)
                });
            }
            this.grid.push(row);
        }
    }

    // リアルタイム 🛡️ 総和算出 (非累積の原則)
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
                    total += 10; // 拠点パッシブ遮断 🛡️ 10
                }
            }
        }
        return total;
    }

    // 拠点建設コスト算出 (スケーリング重厚コスト)
    getOutpostCost(count) {
        if (count === 0) return { wood: 60,  ember: 3, reqTiles: 12 };
        if (count === 1) return { wood: 120, ember: 5, reqTiles: 24 };
        if (count === 2) return { wood: 240, ember: 8, reqTiles: 40 };
        return null; // 上限超え
    }

    // 配置済み土地数のカウント
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

    // 方角領域判定 (北: 青 / 東: 金 / 南: 赤 / 西: 緑)
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
// 3. OUTPOST SYSTEM (Unity OutpostSystem.cs)
// ==========================================
class OutpostSystem {
    constructor(state) {
        this.state = state;
    }

    // 拠点建設の 5 大判定条件
    canBuildOutpost(r, c) {
        if (this.state.outpostCount >= this.state.maxOutposts) return { can: false, reason: "全ラン拠点最大上限(3個)に達しています" };
        if (this.state.currentStageIndex === 0) return { can: false, reason: "Stage 1 (5x5) では拠点建設は未解禁です" };
        
        const cost = this.state.getOutpostCost(this.state.outpostCount);
        if (!cost) return { can: false, reason: "これ以上建設できません" };
        
        if (this.state.wood < cost.wood) return { can: false, reason: `資材 🧱 が足りません (必要: 🧱 ${cost.wood})` };
        if (this.state.ember < cost.ember) return { can: false, reason: `生命力 🔥 が足りません (必要: 🔥 ${cost.ember})` };
        if (this.state.getPlacedTileCount() < cost.reqTiles) return { can: false, reason: `開拓土地数が足りません (必要: ${cost.reqTiles} マス)` };

        const cell = this.state.grid[r][c];
        if (cell.placed) return { can: false, reason: "すでに土地が配置されているマスには建てられません" };
        if (cell.isHQ) return { can: false, reason: "本営マス自体には建てられません" };

        // 条件 1: 本営離隔 3 マス以上
        const hq = this.state.stage.hqCenter;
        const dist = Math.abs(r - hq.r) + Math.abs(c - hq.c);
        if (dist < 3) return { can: false, reason: "本営から 3 マス以上離れる必要があります" };

        // 条件 3: 配置済み土地に 1 面以上隣接
        let hasAdjacentPlaced = false;
        const neighbors = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
        for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < this.state.stage.size && nc >= 0 && nc < this.state.stage.size) {
                if (this.state.grid[nr][nc].placed) hasAdjacentPlaced = true;
            }
        }
        if (!hasAdjacentPlaced) return { can: false, reason: "配置済みの土地ブロックに 1 面以上隣接する必要があります" };

        // 条件 4: H3 山岳に隣接していない
        for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < this.state.stage.size && nc >= 0 && nc < this.state.stage.size) {
                const nCell = this.state.grid[nr][nc];
                if (nCell.placed && nCell.terrain && nCell.terrain.id === "H3_MOUNTAIN") {
                    return { can: false, reason: "H3 山岳に隣接するマスには拠点を出力できません" };
                }
            }
        }

        return { can: true, cost };
    }

    // 拠点建設実行 (1 拠点 1 方角限定)
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
            direction: sector, // 1 方角限定カバー
            level: 1,
            dormantTurns: 0
        };

        const cell = this.state.grid[r][c];
        cell.isOutpost = true;
        this.state.outposts.push(outpost);
        this.state.outpostCount++;

        // 市民セリフフキダシ演出キュー追加
        this.state.speechQueue.push({
            r, c, text: "前哨拠点が完成したぞ！方角を監視せよ！"
        });

        return { success: true, outpost };
    }
}

// ==========================================
// 4. ALIGNMENT RESONANCE DRAW SYSTEM
// ==========================================
class ResonanceDrawSystem {
    constructor(state) {
        this.state = state;
    }

    // 盤面のこだわり傾向を高速スキャン (0.05ms)
    generateOfferingCards() {
        const pool = [
            { id: "C_PLAIN",    name: "🌱 平地ブロック", terrain: TERRAIN_TYPES.H1_PLAIN, weight: 100 },
            { id: "C_FOREST",   name: "🌲 森林ブロック", terrain: TERRAIN_TYPES.GL2_FOREST, weight: 100 },
            { id: "C_MOUNTAIN", name: "⛰️ 山岳ブロック", terrain: TERRAIN_TYPES.H3_MOUNTAIN, weight: 100 },
            { id: "C_DESERT",   name: "🏜️ 砂漠ブロック", terrain: TERRAIN_TYPES.GL0_DESERT, weight: 100 },
            { id: "C_LAKE",     name: "🌊 清湖ブロック", terrain: TERRAIN_TYPES.LAKE, weight: 100 }
        ];

        // 盤面スキャン
        let desertCount = 0;
        let lakeCount = 0;
        let mountainCount = 0;

        const size = this.state.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.state.grid[r][c];
                if (cell.placed && cell.terrain) {
                    if (cell.terrain.id === "GL0_DESERT") desertCount++;
                    if (cell.terrain.id === "LAKE") lakeCount++;
                    if (cell.terrain.id === "H3_MOUNTAIN") mountainCount++;
                }
            }
        }

        // 段階的隠し味バイアス (ライト: +10% 隠し味 / 熟練: +30%〜+50% 重み付け)
        if (desertCount >= 1) pool.find(c => c.id === "C_DESERT").weight += 10;
        if (lakeCount >= 1) pool.find(c => c.id === "C_LAKE").weight += 10;
        if (mountainCount >= 2) pool.find(c => c.id === "C_MOUNTAIN").weight += 25; // マージ狙い熟練バイアス

        // 重み付けルーレットピック (3 択)
        const drawn = [];
        for (let i = 0; i < 3; i++) {
            const pick = this.weightedPick(pool);
            drawn.push(pick);
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
        BOARD_STAGES,
        DIRECTION_ZONES,
        TERRAIN_TYPES,
        GameState,
        OutpostSystem,
        ResonanceDrawSystem
    };
}
