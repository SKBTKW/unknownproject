// Monte Carlo Simulation for Initial 3 Sockets Pickup Turns before 1st Trial (T1-T15)
const numSimulations = 10000;
const boardSize = 5;

// HQ is at (2,2)
// Sockets are at (0,1), (0,3), (4,1) -> (B1, D1, B5)
const sockets = [
    { r: 0, c: 1 },
    { r: 0, c: 3 },
    { r: 4, c: 1 }
];

function isSocket(r, c) {
    return sockets.some(s => s.r === r && s.c === c);
}

function runOneSimulation() {
    // grid[r][c] = true if placed
    const grid = Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
    grid[2][2] = true; // HQ placed

    let turn = 0;
    let socketsObtained = 0;

    // Available unplaced tiles adjacent to placed tiles
    while (socketsObtained < 3 && turn < 50) {
        turn++;
        
        // Find all placeable empty cells (adjacent to placed)
        const candidates = [];
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (!grid[r][c]) {
                    // Check adjacency
                    const dirs = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
                    const hasAdj = dirs.some(([nr, nc]) => nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize && grid[nr][nc]);
                    if (hasAdj) {
                        candidates.push({ r, c, isSock: isSocket(r, c) });
                    }
                }
            }
        }

        if (candidates.length === 0) break;

        // Player Strategy: Prioritize candidates that ARE sockets or get CLOSER to unobtained sockets
        candidates.sort((a, b) => {
            if (a.isSock !== b.isSock) return a.isSock ? -1 : 1;
            
            // Distance to closest remaining socket
            const minDistA = Math.min(...sockets.filter(s => !grid[s.r][s.c]).map(s => Math.abs(s.r - a.r) + Math.abs(s.c - a.c)));
            const minDistB = Math.min(...sockets.filter(s => !grid[s.r][s.c]).map(s => Math.abs(s.r - b.r) + Math.abs(s.c - b.c)));
            return minDistA - minDistB;
        });

        // Pick best candidate (or random among top 2 for variance)
        const chosen = candidates[0];
        grid[chosen.r][chosen.c] = true;

        if (chosen.isSock) {
            socketsObtained++;
        }
    }

    return turn;
}

let totalTurns = 0;
let minTurns = 999;
let maxTurns = 0;
let successWithinT12 = 0;
let successWithinT15 = 0;

const distribution = {};

for (let i = 0; i < numSimulations; i++) {
    const turns = runOneSimulation();
    totalTurns += turns;
    if (turns < minTurns) minTurns = turns;
    if (turns > maxTurns) maxTurns = turns;
    if (turns <= 12) successWithinT12++;
    if (turns <= 15) successWithinT15++;

    distribution[turns] = (distribution[turns] || 0) + 1;
}

const avgTurns = (totalTurns / numSimulations).toFixed(2);
const rateT12 = ((successWithinT12 / numSimulations) * 100).toFixed(1);
const rateT15 = ((successWithinT15 / numSimulations) * 100).toFixed(1);

console.log('=============================================================');
console.log('1ST TRIAL SOCKET PICKUP SIMULATION RESULTS (10,000 RUNS)');
console.log('=============================================================');
console.log(`- Average Turns to Pickup ALL 3 Sockets: ${avgTurns} Turns`);
console.log(`- Theoretical Minimum Turns: ${minTurns} Turns`);
console.log(`- Completion Rate within T12 (Trial Start): ${rateT12}%`);
console.log(`- Completion Rate within T15 (Trial End): ${rateT15}%`);
console.log('-------------------------------------------------------------');
console.log('Turn Distribution:');
for (let t = minTurns; t <= Math.min(20, maxTurns); t++) {
    const count = distribution[t] || 0;
    const pct = ((count / numSimulations) * 100).toFixed(1);
    console.log(`  Turn ${t}: ${pct}% (${count} runs)`);
}
console.log('=============================================================');
