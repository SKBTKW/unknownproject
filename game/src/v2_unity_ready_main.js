/**
 * Trial of the Ages: Last Ember - Step 1 + Merge Engine
 * 
 * MERGE SYSTEM SPECIFICATIONS (rules/03_land_system/03_merge_system.md):
 * - 2x2 Square Merge (H1 Plain / GL1 Grass): 4-cell square -> Yield x1.2 + 🔥 +1 Recovery!
 * - 4-Cell L-Shape Merge (H2 Hill): 4-cell L-shape -> Yield x1.2 + 🔥 +1 Recovery!
 * - 4-Cell Convex-Shape Merge (H3 Mountain): 4-cell Convex -> Yield x1.2 + 🔥 +1 Recovery + 🛡️ +30 Explosive Defense!
 */

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

class GameState {
    constructor() {
        this.turn = 1;
        this.maxTurns = 50;
        this.ember = 20; // 🔥 生命線
        this.food = 30;
        this.wood = 30;
        
        this.stage = BOARD_STAGES.STAGE_1;
        this.grid = [];
        this.initGrid(this.stage.size);
        
        this.hasPickedThisTurn = false;
        this.handOffering = [];
        this.lastMergeMessage = "";
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
                    merged: false,
                    isHQ: (r === this.stage.hqCenter.r && c === this.stage.hqCenter.c)
                });
            }
            this.grid.push(row);
        }
    }

    calculateTotalDefense() {
        let total = 10; // 本営 🛡️ 10
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain) {
                    if (cell.merged && cell.terrain.id === "H3_MOUNTAIN") {
                        total += 30; // H3 凸字マージ爆発 🛡️ +30
                    } else {
                        total += cell.terrain.defense || 0;
                    }
                }
            }
        }
        return total;
    }

    // 2x2 / 4マスL字 / 4マス凸字 マージ判定ロジック
    checkMergePatterns() {
        const size = this.stage.size;
        let mergeFound = false;
        this.lastMergeMessage = "";

        // 2x2 正方形マージチェック
        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const c1 = this.grid[r][c];
                const c2 = this.grid[r][c+1];
                const c3 = this.grid[r+1][c];
                const c4 = this.grid[r+1][c+1];

                if (c1.placed && c2.placed && c3.placed && c4.placed &&
                    !c1.merged && !c2.merged && !c3.merged && !c4.merged &&
                    !c1.isHQ && !c2.isHQ && !c3.isHQ && !c4.isHQ) {

                    // 属性の一致チェック
                    if (c1.terrain.id === c2.terrain.id && c1.terrain.id === c3.terrain.id && c1.terrain.id === c4.terrain.id) {
                        c1.merged = c2.merged = c3.merged = c4.merged = true;
                        this.ember += 1; // マージ達成 🔥 +1 即時回復
                        mergeFound = true;
                        
                        if (c1.terrain.id === "H3_MOUNTAIN") {
                            this.lastMergeMessage = "🎉 H3 凸字山岳マージ成立！ 🔥 +1 回復 ＆ 防衛力 🛡️ +30 へ爆発上昇！";
                        } else {
                            this.lastMergeMessage = `🎉 2x2 正方形マージ成立 (${c1.terrain.name})！ 🔥 +1 即時回復！`;
                        }
                    }
                }
            }
        }
        return mergeFound;
    }
}

class Step1DrawSystem {
    constructor(state) {
        this.state = state;
    }

    generateOfferingCards() {
        const pool = [
            { id: "C_PLAIN",    name: "🌱 平地", terrain: TERRAIN_TYPES.H1_PLAIN },
            { id: "C_GRASS",    name: "🌾 草原", terrain: TERRAIN_TYPES.GL1_GRASS },
            { id: "C_FOREST",   name: "🌲 森林", terrain: TERRAIN_TYPES.GL2_FOREST },
            { id: "C_HILL",     name: "⛰️ 丘陵", terrain: TERRAIN_TYPES.H2_HILL },
            { id: "C_MOUNTAIN", name: "🏔️ 山岳", terrain: TERRAIN_TYPES.H3_MOUNTAIN }
        ];

        const drawn = [];
        for (let i = 0; i < 3; i++) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            drawn.push({ ...pick, instanceId: `card_${i}_${Date.now()}` });
        }

        this.state.handOffering = drawn;
        this.state.hasPickedThisTurn = false;
        return drawn;
    }
}

if (typeof window !== "undefined") {
    window.Step1Engine = {
        BOARD_STAGES,
        TERRAIN_TYPES,
        GameState,
        Step1DrawSystem
    };
}
