import { GameEngine, BoardGridComponent, I18n } from '../game/src/app.js';

console.log('🧪 L字型ブロック配置時の 2x2 吸収 ＆ 縦1x2 分裂の再現テスト開始');

const engine = new GameEngine();
const pTerrain = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };

// 1. C2 (1,2) ➔ C1 (0,2) ➔ D1 (0,3) を配置
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(1, 2, [[1]], pTerrain); // C2 (1,2)
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(0, 2, [[1]], pTerrain); // C1 (0,2)
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(0, 3, [[1]], pTerrain); // D1 (0,3)

// 2. L字ブロック: (D2, E2, E1) ➔ マトリクス:
// [0, 1] (E1)
// [1, 1] (D2, E2)
// 開始位置: (r=0, c=3) ➔ D1は0,3、E1は0,4、D2は1,3、E2は1,4
// したがって startR = 0, startC = 3 で shapeMatrix = [[0, 1], [1, 1]]
console.log('\n--- L字ブロック [[0, 1], [1, 1]] を (0,3) に配置 (D2★, E2, E1) ---');
engine.state.hasPickedThisTurn = false;
const placeRes = engine.gridEngine.placeShape(0, 3, [[0, 1], [1, 1]], pTerrain);
console.log('配置結果:', placeRes);

const c1 = engine.state.grid[0][2];
const d1 = engine.state.grid[0][3];
const e1 = engine.state.grid[0][4];
const c2 = engine.state.grid[1][2];
const d2 = engine.state.grid[1][3];
const e2 = engine.state.grid[1][4];

console.log('\n【各マスの状態 (State)】');
console.log('C1 (0,2): placed =', c1.placed, 'merged =', c1.merged, 'mergeType =', c1.mergeType, 'mergeGroupId =', c1.mergeGroupId);
console.log('D1 (0,3): placed =', d1.placed, 'merged =', d1.merged, 'mergeType =', d1.mergeType, 'mergeGroupId =', d1.mergeGroupId);
console.log('E1 (0,4): placed =', e1.placed, 'merged =', e1.merged, 'mergeType =', e1.mergeType, 'mergeGroupId =', e1.mergeGroupId);
console.log('C2 (1,2): placed =', c2.placed, 'merged =', c2.merged, 'mergeType =', c2.mergeType, 'mergeGroupId =', c2.mergeGroupId);
console.log('D2 (1,3): placed =', d2.placed, 'merged =', d2.merged, 'mergeType =', d2.mergeType, 'mergeGroupId =', d2.mergeGroupId);
console.log('E2 (1,4): placed =', e2.placed, 'merged =', e2.merged, 'mergeType =', e2.mergeType, 'mergeGroupId =', e2.mergeGroupId);

console.log('\n【2x2マージグループの確認】');
console.log('C1-D1-C2-D2 が 2x2 マージ成立しているか:', (c1.merged && d1.merged && c2.merged && d2.merged && c1.mergeGroupId === d2.mergeGroupId));
console.log('E1, E2 が 2x2 マージから外れているか:', (!e1.merged && !e2.merged && e1.mergeGroupId !== c1.mergeGroupId));

// DOM 描画の検証
let gridEl = null;
const mockDoc = {
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        className: "",
        classList: {
            classes: new Set(),
            add(...cls) { cls.forEach(c => this.classes.add(c)); },
            remove(...cls) { cls.forEach(c => this.classes.delete(c)); },
            contains(c) { return this.classes.has(c); }
        },
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        children: [],
        appendChild(child) { this.children.push(child); },
        dataset: {},
        style: { setProperty: () => {} }
    }),
    getElementById: (id) => (id === 'gridBoard' ? gridEl : null),
    querySelector: () => null,
    body: { appendChild: () => {} }
};
gridEl = mockDoc.createElement('div');
globalThis.document = mockDoc;
globalThis.window = { I18n, document: mockDoc };

const uiMock = { state: engine.state, engine: engine };
const boardComp = new BoardGridComponent(uiMock);
boardComp.render(I18n);

const cellD1 = gridEl.children.find(c => c.attributes && c.attributes["data-r"] == 0 && c.attributes["data-c"] == 3);
const cellE1 = gridEl.children.find(c => c.attributes && c.attributes["data-r"] == 0 && c.attributes["data-c"] == 4);
const cellD2 = gridEl.children.find(c => c.attributes && c.attributes["data-r"] == 1 && c.attributes["data-c"] == 3);
const cellE2 = gridEl.children.find(c => c.attributes && c.attributes["data-r"] == 1 && c.attributes["data-c"] == 4);

console.log('\n【DOM描画境界線の検証】');
console.log('D1-E1 間の境界線 (D1に no-border-right が付いていないか):', cellD1 ? !cellD1.classList.contains('no-border-right') : false);
console.log('D2-E2 間の境界線 (D2に no-border-right が付いていないか):', cellD2 ? !cellD2.classList.contains('no-border-right') : false);
console.log('E1-E2 間の縦連結 (E1に no-border-bottom が付いているか):', cellE1 ? cellE1.classList.contains('no-border-bottom') : false);
console.log('E1-E2 間の縦連結 (E2に no-border-top が付いているか):', cellE2 ? cellE2.classList.contains('no-border-top') : false);
