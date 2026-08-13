/**
 * Trial of the Ages: Last Ember - Master HQ & Layout Engine
 * 
 * SPECIFICATIONS:
 * 1. HQ Base Production (rules/00):
 *    - Food +10/T, Wood +10/T, Defense 10 (base), Mystic +1/T.
 * 2. Ember Maintenance:
 *    - Flame Age (24+) -25 Food/T, Standard (10-23) -20 Food/T, Extinction (<=9) -15 Food/T.
 * 3. Reserve Slot System:
 *    - Up to 3 cards can be reserved. Reserved cards cost Ember -1/T maintenance.
 * 4. 2D6 Land Exploration & Sockets:
 *    - Sockets un-opened at start, blooming on placement.
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
        this.trialCountdown = 4;
        this.ember = 20;
        this.food = 30;
        this.wood = 30;
        this.mystic = 10;
        
        this.stage = BOARD_STAGES.STAGE_1;
        this.grid = [];
        this.hasPickedThisTurn = false;
        this.handOffering = [];
        this.reserveSlots = [null, null, null];
        this.lastMergeMessage = "";
        this.toastQueue = [];
        this.gameLogs = [];

        this.initGrid(this.stage.size);
    }

    addLog(msg) {
        const timeStr = `[T${this.turn}]`;
        this.gameLogs.unshift(`${timeStr} ${msg}`);
        if (this.gameLogs.length > 50) this.gameLogs.pop();
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

        // 初期未開花 ★ ソケットを配置
        this.grid[0][1].hasSocket = true;
        this.grid[1][3].hasSocket = true;
        this.grid[3][1].hasSocket = true;

        this.addLog("ゲーム開始: 5x5 盤面が初期化されました。");
    }

    isHQVicinity(r, c) {
        const hqR = this.stage.hqCenter.r;
        const hqC = this.stage.hqCenter.c;
        return Math.abs(r - hqR) <= 1 && Math.abs(c - hqC) <= 1 && !(r === hqR && c === hqC);
    }

    countPlacedTiles() {
        let count = 0;
        const size = this.stage.size;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (this.grid[r][c].placed) count++;
            }
        }
        return count;
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

                    this.addLog(`土地配置: (${String.fromCharCode(65+targetC)}${targetR+1}) ${terrain.name}`);

                    if (cell.hasSocket && !cell.socketResource) {
                        const socketDef = SOCKET_RESOURCES[terrain.id] || SOCKET_RESOURCES.GL1_GRASS;
                        cell.socketResource = socketDef;
                        this.toastQueue.push({ r: targetR, c: targetC, text: `★ ${socketDef.name} 開花!` });
                        this.addLog(`★ ソケット開花: (${String.fromCharCode(65+targetC)}${targetR+1}) ${socketDef.name}`);
                    }

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
            this.addLog(`2連結即時ボーナス獲得 (${terrain.name})`);
        } else if (connectionCount === 3) {
            this.food += 1;
            this.wood += 1;
            this.toastQueue.push({ r, c, text: "🌾🧱 +1 (3連結)" });
            this.addLog(`3連結即時ボーナス獲得 (${terrain.name})`);
        } else if (connectionCount >= 4) {
            this.ember += 1;
            this.food += 2;
            this.wood += 2;
            this.toastQueue.push({ r, c, text: "🔥+1 🌾🧱+2 (4連結)" });
            this.addLog(`★ 4連結最大即時ボーナス! 🔥+1 回復! (${terrain.name})`);
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

        // 保留枠のカード1枚につき 🔥 -1 維持コスト発生
        let reserveCost = 0;
        this.reserveSlots.forEach(card => {
            if (card) reserveCost++;
        });
        this.ember -= reserveCost;
        if (reserveCost > 0) {
            this.addLog(`保留カード維持費: 🔥 -${reserveCost} 消費`);
        }

        let deficit = 0;
        if (this.food >= foodCost) {
            this.food -= foodCost;
        } else {
            deficit = foodCost - this.food;
            this.food = 0;
            this.ember -= deficit;
            this.addLog(`⚠️ 食料不足! 🔥 -${deficit} ダメージ!`);
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

    calculateTotalDefense() {
        let total = 10;
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

    calculateTotalProduction() {
        let totalFood = 10;
        let totalWood = 10;
        let totalMystic = 1;
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

                    if (this.isHQVicinity(r, c)) {
                        food += 1;
                        wood += 1;
                    }

                    totalFood += food;
                    totalWood += wood;
                }
            }
        }

        return { totalFood, totalWood, totalMystic };
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
                            this.addLog("🎉 H3 凸字山岳マージ成立!");
                        } else {
                            this.lastMergeMessage = `🎉 2x2 正方形マージ成立 (${c1.terrain.name})！ 🔥 +1 即時回復！`;
                            this.toastQueue.push({ r, c, text: "🔥 +1 (マージ)" });
                            this.addLog(`🎉 2x2 正方形マージ成立 (${c1.terrain.name})!`);
                        }
                    }
                }
            }
        }
        return mergeFound;
    }

    moveToReserve(cardIndex) {
        if (cardIndex < 0 || cardIndex >= this.handOffering.length) return false;
        const card = this.handOffering[cardIndex];

        for (let i = 0; i < 3; i++) {
            if (this.reserveSlots[i] === null) {
                this.reserveSlots[i] = card;
                this.handOffering.splice(cardIndex, 1);
                this.addLog(`カードを保留エリアへ移動: ${card.name}`);
                return true;
            }
        }
        return false;
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
