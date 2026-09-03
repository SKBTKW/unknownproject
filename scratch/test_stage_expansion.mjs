import { GameEngine, TerritoryBadgeComponent } from '../game/src/app.js';

console.log('=== 🧪 盤面拡大・ステージ連動バッジ自動検証テスト ===');

let total = 0;
let passed = 0;

function assert(condition, message, details = '') {
    total++;
    if (!condition) {
        console.error(`  ❌ [FAIL] ${message}${details ? ` (${details})` : ''}`);
        process.exitCode = 1;
        return;
    }
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
}

const engine = GameEngine.createGame();

console.log('\n[1/3] Stage 1 (5x5)');
assert(engine.state.grid.length === 5, 'Stage 1盤面が5x5で開始する');
assert(TerritoryBadgeComponent.getMaxTilesForStage(1) === 24, 'Stage 1最大開発数が24マスである');
assert(engine.state.currentDefense === 10 && engine.state.maxDefense === 10, 'Stage 1防衛力が10 / 10で開始する');

console.log('\n[2/3] Stage 2 (7x7)');
engine.state.stage = { id: 2, name: 'Stage 2', size: 7 };
engine.gridEngine.expandGrid(7);
assert(engine.state.grid.length === 7, 'Stage 2盤面が7x7へ拡張される');
assert(TerritoryBadgeComponent.getMaxTilesForStage(2) === 48, 'Stage 2最大開発数が48マスである');
assert(engine.state.currentDefense === 10 && engine.state.maxDefense === 14, 'Stage 2本営強化で最大🛡️のみ14へ増える');

console.log('\n[3/3] Stage 3 (9x9)');
engine.state.stage = { id: 3, name: 'Stage 3', size: 9 };
engine.gridEngine.expandGrid(9);
assert(engine.state.grid.length === 9, 'Stage 3盤面が9x9へ拡張される');
assert(TerritoryBadgeComponent.getMaxTilesForStage(3) === 80, 'Stage 3最大開発数が80マスである');
assert(engine.state.currentDefense === 10 && engine.state.maxDefense === 14, 'Stage 3拡張後も現在🛡️を自動回復しない');

console.log(`\n盤面拡張: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
