import { GameEngine, I18n } from '../game/src/app.js';

console.log('🧪 1x2 + 1x2 (横1列 1x4) 即時ボーナス実測テスト開始');

const engine = new GameEngine();
const pTerrain = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };

// 本営は C3 (2,2)
// 1. まず C2 (1,2) に 1x1 を置いて本営から上方向へ接続口を作る
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(1, 2, [[1]], pTerrain);

const foodBefore1 = engine.state.food;
console.log('--- 1回目の 1x2 (C1-D1) を (0,2)-(0,3) に配置 ---');
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(0, 2, [[1, 1]], pTerrain); // C1, D1
const foodAfter1 = engine.state.food;
const bonus1 = foodAfter1 - foodBefore1;
console.log(`1回目の 1x2 配置後の食料獲得量 (ボーナス): 🌾+${bonus1} (food: ${foodBefore1} ➔ ${foodAfter1})`);

const foodBefore2 = engine.state.food;
console.log('\n--- 2回目の 1x2 (A1-B1) を (0,0)-(0,1) に配置 (A1-B1-C1-D1 の横1x4 完成) ---');
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(0, 0, [[1, 1]], pTerrain); // A1, B1
const foodAfter2 = engine.state.food;
const bonus2 = foodAfter2 - foodBefore2;
console.log(`2回目の 1x2 配置後の食料獲得量 (ボーナス): 🌾+${bonus2} (food: ${foodBefore2} ➔ ${foodAfter2})`);

console.log(`\n【合計ボーナス獲得量】`);
console.log(`合計ボーナス: 🌾+${bonus1 + bonus2}`);

const a1 = engine.state.grid[0][0];
const b1 = engine.state.grid[0][1];
const c1 = engine.state.grid[0][2];
const d1 = engine.state.grid[0][3];

console.log('\n【各マスのグループ統合状態】');
console.log('A1 (0,0): mergeGroupId =', a1.mergeGroupId, 'mergeType =', a1.mergeType);
console.log('B1 (0,1): mergeGroupId =', b1.mergeGroupId, 'mergeType =', b1.mergeType);
console.log('C1 (0,2): mergeGroupId =', c1.mergeGroupId, 'mergeType =', c1.mergeType);
console.log('D1 (0,3): mergeGroupId =', d1.mergeGroupId, 'mergeType =', d1.mergeType);
console.log('4マスすべて同じ mergeGroupId に統合されているか:', (a1.mergeGroupId === b1.mergeGroupId && b1.mergeGroupId === c1.mergeGroupId && c1.mergeGroupId === d1.mergeGroupId));
