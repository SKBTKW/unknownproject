/**
 * Trial of the Ages: Last Ember - Master Specification HQ & Land Engine
 * 
 * MASTER HQ SPECIFICATIONS (rules/00, rules/02, rules/03_land_system/01_land_base.md):
 * 1. HQ Base Defense (rules/02 Line 98): Defense +10 constant.
 * 2. HQ Vicinity Bonus (rules/00 Line 93): All 8 neighboring tiles around HQ (3x3 area) gain +1 to all yields (Food/Wood/Defense) per tile.
 * 3. Primary Spec Terrain Names (rules/03 Line 8): GL1_GRASS is "🌾 草原", GL2_FOREST is "🌲 森".
 * 4. Ember Maintenance Costs (rules/00 Line 63-66): Flame Age (24+) -25 Food/T, Standard (10-23) -20 Food/T, Extinction (<=9) -15 Food/T.
 * 5. Resource Sockets: Unopened ★ Sockets at initial setup, blooming into matching resources upon placement.
 */

const BOARD_STAGES = {
    STAGE_1: { size: 5, hqCenter: { r: 2, c: 2 }, name: "5x5 (Stage 1)" }
};

const TERRAIN_TYPES = {
    GL1_GRASS:  { id: "GL1_GRASS",  name: "草原", defense: 0, wood: 0, food: 4, rarity: "C",  shape: [[1]] },
    GL2_FOREST: { id: "GL2_FOREST", name: "森",   defense: 0, wood: 2, food: 2, rarity: "UC", shape: [[1, 1]] },
    H2_HILL:    { id: "H2_HILL",    name: "丘陵", defense: 3, wood: 1, food: 2, rarity: "UC", shape: [[1, 1]] },
    H3_MOUNTAIN:{ id: "H3_MOUNTAIN",name: "山岳", defense: 5, wood: 4, food: 0, rarity: "UC", shape: [[1]] }
};

const SOCKET_RESOURCES = {
    GL1_GRASS:  { name: "野麦", icon: "🍎", bonusFood: 3, bonusWood: 0, bonusDefense: 0 },
    GL2_FOREST: { name: "杉",   icon: "🌲", bonusFood: 0, bonusWood: 3, bonusDefense: 0 },
    H2_HILL:    { name: "石灰岩",icon: "⛏️", bonusFood: 0, bonusWood: 3, bonusDefense: 0 },
    H3_MOUNTAIN:{ name: "花崗岩",icon: "🛡️", bonusFood: 0, bonusWood: 0, bonusDefense: 3 }
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
        this.toastQueue = [];
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
                    hasSocket: false,
                    socketResource: null,
                    isHQ: (r === this.stage.hqCenter.r && c === this.stage.hqCenter.c)
                });
            }
            this.grid.push(row);
        }

        // 初期未開花 ★ ソケットを本営周囲の固定座標（1,1 / 1,3 / 3,1）に配置
        this.grid[1][1].hasSocket = true;
        this.grid[1][3].hasSocket = true;
        this.grid[3][1].hasSocket = true;
    }

    // 本営 HQ 周囲 8 マス（3x3本営近郊）判定 (rules/00 Line 93)
    isHQVicinity(r, c) {
        const hqR = this.stage.hqCenter.r;
        const hqC = this.stage.hqCenter.c;
        return Math.abs(r - hqR) <= 1 && Math.abs(c - hqC) <= 1 && !(r === hqR && c === hqC);
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

        let isAdjacentToHQOrPlaced = false;

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (shape[dr][dc] === 1) {
                    const tr = r + dr;
                    const tc = c + dc;

                    const neighbors = [
                        [tr - 1, tc], [tr + 1, tc], [tr, tc - 1], [tr, tc + 1]
                    ];

                    for (const [nr, nc] of neighbors) {
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                            const neighborCell = this.grid[nr][nc];
                            if (neighborCell.isHQ || neighborCell.placed) {
                                isAdjacentToHQOrPlaced = true;
                                break;
                            }
                        }
                    }
                }
                if (isAdjacentToHQOrPlaced) break;
            }
        }

        if (!isAdjacentToHQOrPlaced) {
            return { can: false, reason: "土地は本営(HQ)または既存の土地に面隣接させて配置してください" };
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
                    const targetR = r + dr;
                    const targetC = c + dc;
                    const cell = this.grid[targetR][targetC];
                    cell.placed = true;
                    cell.terrain = terrain;

                    // ★ ソケットマスの場合、地形に応じたソケットが開花
                    if (cell.hasSocket && !cell.socketResource) {
                        const socketDef = SOCKET_RESOURCES[terrain.id] || SOCKET_RESOURCES.GL1_GRASS;
                        cell.socketResource = socketDef;
                        this.toastQueue.push({ r: targetR, c: targetC, text: `★ ${socketDef.name} 開花!` });
                    }

                    // 本営周囲 8 マス（本営近郊）の場合、全産出 +1 ボーナスを通知
                    if (this.isHQVicinity(targetR, targetC)) {
                        this.toastQueue.push({ r: targetR, c: targetC, text: "🏰 本営近郊 (+1産出)" });
                    }

                    this.checkConnectionBonus(targetR, targetC, terrain);
                }
            }
        }
        return { success: true };
    }

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

        if (connectionCount === 2) {
            if (terrain.id === "GL1_GRASS") this.food += 1;
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

    processTurnEndMaintenance() {
        let foodCost = 20;
        let stageName = "標準期 (10-23)";

        if (this.ember >= 24) {
            foodCost = 25;
            stageName = "炎上期 (24以上)";
            this.ember += 2;
        } else if (this.ember <= 9) {
            foodCost = 15;
            stageName = "鎮火期 (9以下)";
        }

        let deficit = 0;
        if (this.food >= foodCost) {
            this.food -= foodCost;
        } else {
            deficit = foodCost - this.food;
            this.food = 0;
            this.ember -= deficit;
        }

        const isGameOver = (this.ember <= 0);
        const isGameClear = (!isGameOver && this.turn >= this.maxTurns);

        return {
            foodCost,
            deficit,
            stageName,
            isGameOver,
            isGameClear
        };
    }

    // 全防衛力計算 (本営 HQ 固有基礎防衛力 🛡️ 10 復元: rules/02 Line 98)
    calculateTotalDefense() {
        let total = 10; // 本営 HQ 固有基礎防衛力 🛡️ 10
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain) {
                    let tileDef = cell.terrain.defense || 0;
                    if (cell.merged && cell.terrain.id === "H3_MOUNTAIN") {
                        tileDef = 30;
                    }
                    total += tileDef;

                    // 本営周囲 8 マス（本営近郊）の場合、防衛力 +1 ボーナス
                    if (this.isHQVicinity(r, c)) {
                        total += 1;
                    }

                    if (cell.socketResource && cell.socketResource.bonusDefense) {
                        total += cell.socketResource.bonusDefense;
                    }
                }
            }
        }
        return total;
    }

    // 全食料・資材持続産出計算 (本営周囲 8 マス +1/マス ボーナス復元: rules/00 Line 93)
    calculateTotalProduction() {
        let totalFood = 0;
        let totalWood = 0;
        const size = this.stage.size;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.grid[r][c];
                if (cell.placed && cell.terrain) {
                    let food = cell.terrain.food || 0;
                    let wood = cell.terrain.wood || 0;

                    if (cell.socketResource) {
                        food += cell.socketResource.bonusFood || 0;
                        wood += cell.socketResource.bonusWood || 0;
                    }

                    // 本営周囲 8 マス（3x3本営近郊）の場合、全産出 +1 / マス (rules/00 Line 93)
                    if (this.isHQVicinity(r, c)) {
                        food += 1;
                        wood += 1;
                    }

                    totalFood += food;
                    totalWood += wood;
                }
            }
        }

        return { totalFood, totalWood };
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
            { id: "C_GRASS",  name: "🌾 草原", terrain: TERRAIN_TYPES.GL1_GRASS },
            { id: "C_FOREST", name: "🌲 森",   terrain: TERRAIN_TYPES.GL2_FOREST },
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
        SOCKET_RESOURCES,
        GameState,
        Step1DrawSystem,
        rotateShapeMatrix
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        BOARD_STAGES,
        TERRAIN_TYPES,
        SOCKET_RESOURCES,
        GameState,
        Step1DrawSystem,
        rotateShapeMatrix
    };
}
