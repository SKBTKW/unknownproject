import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';

const engine = GameEngine.createGame({ runSeed: 81271 });
const point = engine.historySnapshotService.getRestorePoint(1);
assert.ok(point.rngState && point.gameplayRngState);
const continuation = () => [
    engine.checkSystem.resolve({ checkId: 'standard_2d6' }),
    engine.gameplayRandom.nextFloat(),
    engine.gameplayRandom.nextId('card', engine.state.turn),
    engine.checkSystem.resolveDefinition({
        definition: {
            id: 'land_exploration',
            dice: { count: 2, sides: 6, keep: 'all' },
            resolution: { type: 'sum' },
            outcomes: [{ max: 4, id: 'low' }, { min: 5, max: 7, id: 'medium' }, { min: 8, id: 'discovery' }]
        }
    }),
    engine.gameplayRandom.nextFloat()
];
const expected = continuation();
engine.checkSystem.setState(point.rngState);
engine.gameplayRandom.setState(point.gameplayRngState);
assert.deepEqual(continuation(), expected, 'both streams and deterministic IDs resume exactly');
assert.deepEqual(engine.historySnapshotService.getRestorePoint(1), point, 'stored point stays immutable');
console.log('Mixed RNG Restore determinism: PASS');
