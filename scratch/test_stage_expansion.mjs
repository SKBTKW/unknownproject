import { GameEngine, UIController, TerritoryBadgeComponent } from '../game/src/app.js';

console.log("=== 🧪 盤面拡大・ステージ連動バッジ自動検証テスト ===");

const dom = {
    title: '',
    getElementById: (id) => ({
        id,
        innerHTML: '',
        innerText: '',
        style: { setProperty: () => {} },
        children: [],
        hasChildNodes: () => false,
        appendChild: () => {},
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {},
        querySelector: () => ({ innerText: '', onclick: null })
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
        tagName: tag,
        innerHTML: '',
        innerText: '',
        style: { setProperty: () => {} },
        children: [],
        appendChild: function(c) { this.children.push(c); },
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {},
        querySelector: () => ({ innerText: '', onclick: null })
    })
};
globalThis.document = dom;
globalThis.window = { document: dom, TerritoryBadgeComponent };

const engine = GameEngine.createGame();
const ui = new UIController(engine);
ui.init();

// --- Test 1: Stage 1 (5x5) ---
console.log("\n[1/3] Stage 1 (5x5)");
console.log(`  盤面サイズ: ${engine.state.grid.length}x${engine.state.grid[0].length}`);
console.log(`  最大開拓数: ${TerritoryBadgeComponent.getMaxTilesForStage(1)} マス`);
if (engine.state.grid.length === 5 && TerritoryBadgeComponent.getMaxTilesForStage(1) === 24) {
    console.log("  ✅ [PASS] Stage 1 正常 (5x5, 24マス)");
} else {
    process.exit(1);
}

// --- Test 2: Stage 2 (7x7) ---
console.log("\n[2/3] Stage 2 (7x7)");
engine.state.stage = { id: 2, name: "Stage 2", size: 7 };
engine.state.grid = engine.state.gridEngine.initGrid(7);
ui.render();
console.log(`  盤面サイズ: ${engine.state.grid.length}x${engine.state.grid[0].length}`);
console.log(`  最大開拓数: ${TerritoryBadgeComponent.getMaxTilesForStage(2)} マス`);
if (engine.state.grid.length === 7 && TerritoryBadgeComponent.getMaxTilesForStage(2) === 48) {
    console.log("  ✅ [PASS] Stage 2 拡大成功 (7x7, 48マス)");
} else {
    process.exit(1);
}

// --- Test 3: Stage 3 (9x9) ---
console.log("\n[3/3] Stage 3 (9x9)");
engine.state.stage = { id: 3, name: "Stage 3", size: 9 };
engine.state.grid = engine.state.gridEngine.initGrid(9);
ui.render();
console.log(`  盤面サイズ: ${engine.state.grid.length}x${engine.state.grid[0].length}`);
console.log(`  最大開拓数: ${TerritoryBadgeComponent.getMaxTilesForStage(3)} マス`);
if (engine.state.grid.length === 9 && TerritoryBadgeComponent.getMaxTilesForStage(3) === 80) {
    console.log("  ✅ [PASS] Stage 3 拡大成功 (9x9, 80マス)");
} else {
    process.exit(1);
}

console.log("\n🎉 全ステージ盤面拡大・バッジ連動テスト 100% 成功！");
