import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { ChronicleSystem } from '../game/src/systems/chronicle_system.js';
import { GLOBAL_EVENTS_MASTER } from '../game/src/data/global_events.js';

const engine = GameEngine.createGame({ runSeed: 9045 });
const history = engine.historySnapshotService;
const first = history.getRestorePoint(1);
for (let completedTurn = 1; completedTurn <= 3; completedTurn++) {
    engine.state.turn = completedTurn;
    history.capture({ completedTurn, nextTurn: completedTurn + 1 });
    engine.state.turn = completedTurn + 1;
    history.captureRestorePoint({ verse: completedTurn + 1, sourceCompletedTurn: completedTurn });
}
const third = history.getRestorePoint(3);
assert.deepEqual(history.truncateAfterVerse(3), { snapshots: 2, restorePoints: 3 });
assert.deepEqual(history.getAll().map(item => item.completedTurn), [1, 2]);
assert.deepEqual(history.getAllRestorePoints().map(item => item.verse), [1, 2, 3]);
assert.equal(history.getRestorePoint(1), first);
assert.equal(history.getRestorePoint(3), third);
assert.equal(history.getRestorePoint(4), null);
assert.throws(() => history.truncateAfterVerse(0), /HISTORY_TRUNCATE_VERSE_INVALID/);
assert.deepEqual(history.getAll().map(item => item.completedTurn), [1, 2]);

const chronicle = new ChronicleSystem();
let recorded = 0;
let emitted = 0;
const originalRecord = chronicle.record;
chronicle.record = (...args) => { recorded++; return originalRecord.apply(chronicle, args); };
chronicle.attachGameFactHub({ subscribe() { return () => {}; }, emit() { emitted++; } });
const input = [{ id: 'VERSE_COMMITTED_2', turn: 2, meta: { nested: [1, 2] } }];
const output = chronicle.restoreEvents(input);
assert.deepEqual(output, input);
assert.equal(recorded, 0);
assert.equal(emitted, 0);
input[0].meta.nested.push(3);
assert.deepEqual(chronicle.getAllEvents()[0].meta.nested, [1, 2], 'input not aliased');
assert.throws(() => chronicle.restoreEvents(null), /CHRONICLE_RESTORE_EVENTS_REQUIRED/);
assert.equal(chronicle.getAllEvents().length, 1, 'invalid restore is atomic');
assert.equal(chronicle.record({ id: 'NEW', turn: 3 }).id, 'NEW', 'record API still works');
chronicle.clear();
assert.deepEqual(chronicle.getAllEvents(), []);

// V5 policy contract: only non-derived Buffs are authoritative. The existing
// systems derive environment Buffs and GlobalEvent display proxies from state.
const buffSystem = engine.buffSystem;
const eventManager = engine.globalEventManager;
const eventId = GLOBAL_EVENTS_MASTER[0].id;
engine.state.ember = 24;
engine.state.activeGlobalEvents = [{ definitionId: eventId, remainingTurns: 2 }];
const savedBuffs = [
    { id: 'CARD_EFFECT_TEST', category: 'CARD_EFFECT', remainingTurns: 2 },
    { id: 'ENV_EMBER_PROSPERITY', category: 'ENVIRONMENT' },
    { id: eventId, category: 'GLOBAL_EVENT', isProxy: true }
];
buffSystem.buffs = structuredClone(savedBuffs.filter(buff =>
    buff.category !== 'ENVIRONMENT' && buff.category !== 'GLOBAL_EVENT' && !buff.isProxy));
buffSystem.updateEnvironmentBuffs();
eventManager.syncBuffProxy();
assert.equal(buffSystem.buffs.filter(buff => buff.id === 'CARD_EFFECT_TEST').length, 1);
assert.equal(buffSystem.buffs.filter(buff => buff.category === 'ENVIRONMENT').length, 1);
assert.equal(buffSystem.buffs.filter(buff => buff.id === eventId && buff.isProxy).length, 1);
eventManager.syncBuffProxy();
assert.equal(buffSystem.buffs.filter(buff => buff.id === eventId).length, 1, 'proxy sync is idempotent');

console.log('History/Chronicle/derived Buff restore primitives: PASS');
