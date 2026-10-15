import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { TooltipSystem } from '../game/src/ui/tooltip_system.js';
import { serializeGameState } from '../game/src/core/state_serializer_base.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state_base.js';
import { readResourceStorage } from '../game/src/core/resource_storage_policy.js';
const engine = GameEngine.createGame({ runSeed: 20261015, firstRun: true });
const state = engine.state;
// Card restoration is covered by completion certification; this fixture isolates economy.
state.handOffering = [];
assert.deepEqual([state.food, state.wood, state.material], [50, 50, 50]);
assert.deepEqual([readResourceStorage(state).food, readResourceStorage(state).wood], [200, 200]);
function verify(s) {
    const center = Math.floor(s.grid.length / 2);
    const t = s.grid[center][center].terrain;
    assert.deepEqual([t.food, t.wood, t.defense, t.mystic], [5, 5, 5, 1]);
    const bd = s.getResourceBreakdown();
    assert.deepEqual(['food','wood','defense','mystic'].map(k => bd[k].hqBase), [5,5,5,1]);
    const html = TooltipSystem.prototype.renderDataPanelBreakdown.call({}, s);
    assert.ok(!html.includes('undefined'));
    assert.ok(html.includes('+5'));
}
verify(state);
for (const [id,size] of [[2,7],[3,9]]) {
    const before = [state.food,state.wood,state.mystic,state.ember];
    state.stage = { id, size, maxTiles: size*size-1 };
    engine.gridEngine.expandGrid(size);
    assert.deepEqual([state.food,state.wood,state.mystic,state.ember], before);
    verify(state);
    const restored = GameEngine.createGame({ runSeed: 20261015 }).state;
    hydrateGameState(restored, serializeGameState(state));
    verify(restored);
    assert.deepEqual(readResourceStorage(restored), readResourceStorage(state));
}
console.log('PASS: baseline 50/50, storage 200, HQ/tooltip parity and Stage2/3 restore');
