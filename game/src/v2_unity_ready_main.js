/**
 * Trial of the Ages: Last Ember - Step 1 Core Puzzle Engine
 * 
 * STEP 1 SCOPE:
 * - 2D Top-Down Board with Fixed Outer Coordinate Headers (1-9 / A-I)
 * - Dynamic HQ Center (Stage 1: 5x5 center at r:2, c:2)
 * - 4-Layer Card Component UI with 3x3 Shape Previews
 * - 1 Pick Per Turn Limit (Lock remaining 2 cards upon pick)
 * - Ember Cost (🔥 -1 per land tile placement)
 * - Real-time Sum of Defense 🛡️ (Board Lands + HQ 10)
 * - Pure Logic separated for Unity C# 1-to-1 conversion
 */

// ==========================================
// 1. CONSTANTS & TERRAINS (Unity C# Structs)
// ==========================================
const BOARD_STAGES = {
    STAGE_1: { size: 5, hqCenter: { r: 2, c: 2 }, name: "5x5 (Stage 1)" }
};

const TERRAIN_TYPES = {
    H1_PLAIN:  { id: "H1_PLAIN",  name: "平地", defense: 0, wood: 0, food: 1, rarity: "C", shape: [[1]] },
    GL1_GRASS: { id: "GL1_GRASS", name: "草原", defense: 1, wood: 0, food: 2, rarity: "C", shape: [[1]] },
    GL2_FOREST:{ id: "GL2_FOREST",name: "森林", defense: 2, wood: 2, food: 0, rarity: "UC", shape: [[1, 1]] },
    H2_HILL:   { id: "H2_HILL",   name: "丘陵", defense: 3, wood: 0, food: 0, rarity: "UC", shape: [[1, 1]] },
    H3_MOUNTAIN:{id: "H3_MOUNTAIN",name: "山岳", defense: 5, wood: 0, food: 0, rarity: "UC", shape: [[1]] }
};

// ==========================================
// 2. CORE GAME STATE (Unity GameState.cs)
// ==========================================
class GameState {
    constructor() {
        this.turn = 1;
        this.maxTurns = 50;
        this.ember = 20; // 🔥 生命線 (0で配置不可)
        
        // ストックリソース
        this.food = 30;
        this.wood = 30;
        
        // 盤面設定
        this.stage = BOARD_STAGES.STAGE_1;
        this.grid = [];
        this.initGrid(this.stage.size);
        
        // ターン内 1 ピック制限フラグ
        this.hasPickedThisTurn = false;
        
        // 手札オファリング (3 択)
        this.handOffering = [];
    }

    initGrid(size) {
        this.grid = [];
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                row.push({
                    r, c,
                    placed: false,
                    terrain: null,
                    isHQ: (r === this.stage.hqCenter.r && c === this.stage.hqCenter.c)
                });
            }
            this.grid.push(row);
        }
    }

    // リアルタイム全防衛 🛡️ 総和算出 (非累積)
    calculateTotalDefense() {
        let total = 10; // 本営単体防衛力 🛡️ 10
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain) {
                    total += cell.terrain.defense || 0;
                }
            }
        }
        return total;
    }
}

// ==========================================
// 3. DRAW SYSTEM (Unity DrawSystem.cs)
// ==========================================
class Step1DrawSystem {
    constructor(state) {
        this.state = state;
    }

    generateOfferingCards() {
        const pool = [
            { id: "C_PLAIN",    name: "🌱 平地", terrain: TERRAIN_TYPES.H1_PLAIN },
            { id: "C_GRASS",    name: "🌾 草原", terrain: TERRAIN_TYPES.GL1_GRASS },
            { id: "C_FOREST",   name: "🌲 森林", terrain: TERRAIN_TYPES.GL2_FOREST },
            { id: "C_HILL",     name: "⛰️ 丘陵", terrain: TERRAIN_TYPES.H2_HILL }
            // 清湖 (LAKE) および 砂漠 (GL0) は Step 1 ドローから 100% 除外
        ];

        const drawn = [];
        for (let i = 0; i < 3; i++) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            drawn.push({ ...pick, instanceId: `card_${i}_${Date.now()}` });
        }

        this.state.handOffering = drawn;
        this.state.hasPickedThisTurn = false; // ターン開始時にピック枠を解除
        return drawn;
    }
}

// Global Export for Browser Test
if (typeof window !== "undefined") {
    window.Step1Engine = {
        BOARD_STAGES,
        TERRAIN_TYPES,
        GameState,
        Step1DrawSystem
    };
}
