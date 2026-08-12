/**
 * Trial of the Ages: Last Ember - Step 1 + Connection Bonus & Floating Toast Engine
 * 
 * SPECIFICATIONS:
 * - 2 to 4 Same-attribute Tile Connection Immediate Bonus (Step 925 / 935 / 997).
 * - 2-connection: +1 Food/Wood
 * - 3-connection: +2 Defense 🛡️
 * - 4-connection: +2 Food/Wood
 * - Independent of 2x2 Square Merge Bonus (🔥 +1 recovery & H3 mountain 🛡️ +30).
 * - Floating Icon Toast (+1 🌾 / +2 🛡️) for intuitive non-text feedback.
 */

const BOARD_STAGES = {
    STAGE_1: { size: 5, hqCenter: { r: 2, c: 2 }, name: "5x5 (Stage 1)" }
};

const TERRAIN_TYPES = {
    H1_PLAIN:   { id: "H1_PLAIN",   name: "平地", defense: 0, wood: 0, food: 1, rarity: "C",  shape: [[1]] },
    GL1_GRASS:  { id: "GL1_GRASS",  name: "草原", defense: 1, wood: 0, food: 2, rarity: "C",  shape: [[1]] },
    GL2_FOREST: { id: "GL2_FOREST", name: "森林", defense: 2, wood: 2, food: 0, rarity: "UC", shape: [[1, 1]] },
    H2_HILL:    { id: "H2_HILL",    name: "丘陵", defense: 3, wood: 0, food: 0, rarity: "UC", shape: [[1, 1]] },
    H3_MOUNTAIN:{ id: "H3_MOUNTAIN",name: "山岳", defense: 5, wood: 0, food: 0, rarity: "UC", shape: [[1]] }
};

function rotateShapeMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = [];
    for (let c = 0; c < cols; c++) {
        const newRow = [];
        for (let r = rows - 1; r >= 0; r--) {
            newRow.push(matrix[r][c]);
        }
        result.push(newRow);
    }
    return result;
}

class GameState {
    constructor() {
        this.turn = 1;
        this.maxTurns = 50;
        this.ember = 20;
        this.food = 30;
        this.wood = 30;
        
        this.stage = BOARD_STAGES.STAGE_1;
        this.grid = [];
        this.initGrid(this.stage.size);
        
        this.hasPickedThisTurn = false;
        this.handOffering = [];
        this.lastMergeMessage = "";
        this.toastQueue = []; // マス直上ポップアップ用キュー [{r, c, text}]
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

    countH2HillPlaced() {
        let count = 0;
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain && cell.terrain.id === "H2_HILL") {
                    count++;
                }
            }
        }
        return count;
    }

    canPlaceShape(r, c, shape) {
        const size = this.stage.size;
        const rows = shape.length;
        const cols = shape[0].length;

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shape[dr][dc] === 1) {
                    const targetR = r + dr;
                    const targetC = c + dc;

                    if (targetR >= size || targetC >= size) {
                        return { can: false, reason: "盤面からはみ出しています" };
                    }

                    const targetCell = this.grid[targetR][targetC];
                    if (targetCell.isHQ) {
                        return { can: false, reason: "本営 HQ マスの上には置けません" };
                    }
                    if (targetCell.placed) {
                        return { can: false, reason: "すでに土地が配置されています" };
                    }
                }
            }
        }
        return { can: true };
    }

    placeShape(r, c, shape, terrain) {
        const check = this.canPlaceShape(r, c, shape);
        if (!check.can) return check;

        const rows = shape.length;
        const cols = shape[0].length;

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shape[dr][dc] === 1) {
                    const cell = this.grid[r + dr][c + dc];
                    cell.placed = true;
                    cell.terrain = terrain;

                    // 配置マスごとに同属性段階的連結即時ボーナス判定 (Step 925)
                    this.checkConnectionBonus(r + dr, c + dc, terrain);
                }
            }
        }
        return { success: true };
    }

    // 同属性マス 2〜4 段階的連結即時ボーナス判定 (Step 925 / 935 / 997)
    checkConnectionBonus(r, c, terrain) {
        const size = this.stage.size;
        const visited = new Set();
        const queue = [[r, c]];
        visited.add(`${r},${c}`);

        while (queue.length > 0) {
            const [currR, currC] = queue.shift();
            const neighbors = [[currR-1, currC], [currR+1, currC], [currR, currC-1], [currR, currC+1]];
            
            for (const [nr, nc] of neighbors) {
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                    const key = `${nr},${nc}`;
                    if (!visited.has(key)) {
                        const nCell = this.grid[nr][nc];
                        if (nCell.placed && nCell.terrain && nCell.terrain.id === terrain.id && !nCell.isHQ) {
                            visited.add(key);
                            queue.push([nr, nc]);
                        }
                    }
                }
            }
        }

        const connectionCount = visited.size;

        // 2〜4 段階的連結即時ボーナス配給 (Step 925: 2度目より3度目の方がボーナス増)
        if (connectionCount === 2) {
            if (terrain.id === "GL1_GRASS" || terrain.id === "H1_PLAIN") this.food += 1;
            else this.wood += 1;
            this.toastQueue.push({ r, c, text: "🌾 +1 (2連結)" });
        } else if (connectionCount === 3) {
            this.toastQueue.push({ r, c, text: "🛡️ +2 (3連結即時)" });
        } else if (connectionCount >= 4) {
            this.food += 2;
            this.wood += 2;
            this.toastQueue.push({ r, c, text: "✨ +2 🌾🧱 (4連結)" });
        }
    }

    calculateTotalDefense() {
        let total = 10;
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain) {
                    if (cell.merged && cell.terrain.id === "H3_MOUNTAIN") {
                        total += 30;
                    } else {
                        total += cell.terrain.defense || 0;
                    }
                }
            }
        }
        return total;
    }

    checkMergePatterns() {
        const size = this.stage.size;
        let mergeFound = false;
        this.lastMergeMessage = "";

        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                const c1 = this.grid[r][c];
                const c2 = this.grid[r][c+1];
                const c3 = this.grid[r+1][c];
                const c4 = this.grid[r+1][c+1];

                if (c1.placed && c2.placed && c3.placed && c4.placed &&
                    !c1.merged && !c2.merged && !c3.merged && !c4.merged &&
                    !c1.isHQ && !c2.isHQ && !c3.isHQ && !c4.isHQ) {

                    if (c1.terrain.id === c2.terrain.id && c1.terrain.id === c3.terrain.id && c1.terrain.id === c4.terrain.id) {
                        c1.merged = c2.merged = c3.merged = c4.merged = true;
                        this.ember += 1;
                        mergeFound = true;
                        
                        if (c1.terrain.id === "H3_MOUNTAIN") {
                            this.lastMergeMessage = "🎉 H3 凸字山岳マージ成立！ 🔥 +1 回復 ＆ 防衛力 🛡️ +30 へ爆発上昇！";
                            this.toastQueue.push({ r, c, text: "🔥 +1 🛡️ +30 (マージ)" });
                        } else {
                            this.lastMergeMessage = `🎉 2x2 正方形マージ成立 (${c1.terrain.name})！ 🔥 +1 即時回復！`;
                            this.toastQueue.push({ r, c, text: "🔥 +1 (マージ)" });
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
            { id: "C_PLAIN",  name: "🌱 平地", terrain: TERRAIN_TYPES.H1_PLAIN },
            { id: "C_GRASS",  name: "🌾 草原", terrain: TERRAIN_TYPES.GL1_GRASS },
            { id: "C_FOREST", name: "🌲 森林", terrain: TERRAIN_TYPES.GL2_FOREST },
            { id: "C_HILL",   name: "⛰️ 丘陵", terrain: TERRAIN_TYPES.H2_HILL }
        ];

        if (this.state.countH2HillPlaced() >= 3) {
            pool.push({ id: "C_MOUNTAIN", name: "🏔️ 山岳", terrain: TERRAIN_TYPES.H3_MOUNTAIN });
        }

        const drawn = [];
        const availablePool = [...pool];

        for (let i = 0; i < 3 && availablePool.length > 0; i++) {
            const randIdx = Math.floor(Math.random() * availablePool.length);
            const pick = availablePool.splice(randIdx, 1)[0];
            
            drawn.push({
                ...pick,
                instanceId: `card_${i}_${Date.now()}`,
                currentShape: JSON.parse(JSON.stringify(pick.terrain.shape))
            });
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
        Step1DrawSystem,
        rotateShapeMatrix
    };
}
