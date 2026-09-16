import { GameEngine } from '../game/src/app.js';

console.log('🧪 1x2 配置時の 2x2 吸収 ＆ 1x1 分裂の再現テスト開始');

const engine = new GameEngine();
const pTerrain = { id: "GL1_PLAINS", terrainId: "PLAINS", nameKey: "TERRAIN_PLAINS", yields: { food: 4 } };

// C2 (1,2) [本営C3(2,2)に隣接] ➔ C1 (0,2) [C2に隣接] ➔ D1 (0,3) [C1に隣接]
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(1, 2, [[1]], pTerrain); // C2 (1,2)
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(0, 2, [[1]], pTerrain); // C1 (0,2)
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(0, 3, [[1]], pTerrain); // D1 (0,3)

console.log('配置前: C1, D1, C2 配置完了');
console.log('C1 mergeGroupId:', engine.state.grid[0][2].mergeGroupId);
console.log('D1 mergeGroupId:', engine.state.grid[0][3].mergeGroupId);
console.log('C2 mergeGroupId:', engine.state.grid[1][2].mergeGroupId);

// D2, E2 に 1x2 平地を配置 (1,3), (1,4)
console.log('\n--- D2(1,3), E2(1,4) に 1x2 平地を配置 ---');
engine.state.hasPickedThisTurn = false;
engine.gridEngine.placeShape(1, 3, [[1, 1]], pTerrain);

const c1 = engine.state.grid[0][2];
const d1 = engine.state.grid[0][3];
const c2 = engine.state.grid[1][2];
const d2 = engine.state.grid[1][3];
const e2 = engine.state.grid[1][4];

console.log('\n【各マスの状態】');
console.log('C1 (0,2): placed =', c1.placed, 'merged =', c1.merged, 'mergeType =', c1.mergeType, 'mergeGroupId =', c1.mergeGroupId, 'placeId =', c1.placementGroupId);
console.log('D1 (0,3): placed =', d1.placed, 'merged =', d1.merged, 'mergeType =', d1.mergeType, 'mergeGroupId =', d1.mergeGroupId, 'placeId =', d1.placementGroupId);
console.log('C2 (1,2): placed =', c2.placed, 'merged =', c2.merged, 'mergeType =', c2.mergeType, 'mergeGroupId =', c2.mergeGroupId, 'placeId =', c2.placementGroupId);
console.log('D2 (1,3): placed =', d2.placed, 'merged =', d2.merged, 'mergeType =', d2.mergeType, 'mergeGroupId =', d2.mergeGroupId, 'placeId =', d2.placementGroupId);
console.log('E2 (1,4): placed =', e2.placed, 'merged =', e2.merged, 'mergeType =', e2.mergeType, 'mergeGroupId =', e2.mergeGroupId, 'placeId =', e2.placementGroupId);

console.log('\n【2x2マージグループの確認】');
console.log('C1-D1-C2-D2 の mergeGroupId が全て同一か:', (c1.mergeGroupId === d1.mergeGroupId && d1.mergeGroupId === c2.mergeGroupId && c2.mergeGroupId === d2.mergeGroupId));
console.log('E2 の mergeGroupId が 2x2 と異なっているか:', e2.mergeGroupId !== d2.mergeGroupId);

// DOM 描画クラスの検証
import { UIController } from '../game/src/app.js';
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

import { BoardGridComponent } from '../game/src/app.js';

const uiMock = { state: engine.state, engine: engine };
const boardComp = new BoardGridComponent(uiMock);
boardComp.render(I18n);

console.log('gridEl children count:', gridEl.children.length);

const cellD2 = gridEl.children.find(c => c.attributes && c.attributes["data-r"] == 1 && c.attributes["data-c"] == 3);
const cellE2 = gridEl.children.find(c => c.attributes && c.attributes["data-r"] == 1 && c.attributes["data-c"] == 4);

console.log('\n【DOM描画クラスの検証】');
console.log('D2 (1,3) classes:', cellD2 ? [...cellD2.classList.classes].join(' ') : 'not found');
console.log('E2 (1,4) classes:', cellE2 ? [...cellE2.classList.classes].join(' ') : 'not found');
console.log('D2 の右境界線が残っているか (no-border-right が付いていないこと):', cellD2 ? !cellD2.classList.contains('no-border-right') : false);
console.log('E2 の左境界線が残っているか (no-border-left が付いていないこと):', cellE2 ? !cellE2.classList.contains('no-border-left') : false);

