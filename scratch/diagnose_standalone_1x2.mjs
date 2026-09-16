import { GameEngine, I18n } from '../game/src/app.js';

console.log('🧪 1. 手札から 1x2 を単独配置した時のボーナス検証 (手札内部マスではボーナスが出ないこと)');

const engine = new GameEngine();
const pTerrain = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };

// 本営は C3 (2,2)
// 本営 (2,2) に隣接して、周囲に平地がない場所 (C2, D2) に 1x2 平地を配置
const foodBefore = engine.state.food; // 初期 50
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(1, 2, [[1, 1]], pTerrain); // C2, D2 (本営にのみ隣接、平地隣接なし)
const foodAfter = engine.state.food;

console.log(`単独 1x2 配置前食料: ${foodBefore}, 配置後食料: ${foodAfter}, 獲得ボーナス: 🌾+${foodAfter - foodBefore}`);
console.log(`判定: 手札から 1x2 を出しただけでは接続ボーナスはもらえないか: ${foodAfter === foodBefore}`);
