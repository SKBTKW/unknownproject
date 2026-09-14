import { GameEngine } from '../game/src/core/game_engine.js';

const engine = GameEngine.createGame({ runSeed: 20260915 });

if (!engine) throw new Error('GameEngine.createGame() returned no engine');
if (engine.investigationSubsystem?.success !== true) {
    throw new Error(`investigation subsystem did not attach: ${engine.investigationSubsystem?.reason || 'unknown'}`);
}
if (engine.__investigationRuntimeAttached !== true) {
    throw new Error('investigation runtime attach marker missing');
}
if (typeof engine.executeInvestigationCard !== 'function') {
    throw new Error('executeInvestigationCard API missing from live GameEngine');
}
if (typeof engine.getAdditionalCardMastersForRestore !== 'function') {
    throw new Error('investigation restore master provider missing from live GameEngine');
}
if (!engine.enemyTruthReadModel || typeof engine.enemyTruthReadModel.getSnapshot !== 'function') {
    throw new Error('enemy truth read model missing before investigation composition');
}

console.log('PASS investigation GameEngine composition attach');
