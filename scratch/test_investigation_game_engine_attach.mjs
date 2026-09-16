import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { GameEngine } from '../game/src/core/game_engine.js';
import { WARNING_STATES } from '../game/src/warning/domain/warning_state.js';

const engine = GameEngine.createGame({ runSeed: 20260915 });

if (!engine) throw new Error('GameEngine.createGame() returned no engine');
if (engine.investigationSubsystem?.success !== true) {
    throw new Error(`investigation subsystem did not attach: ${engine.investigationSubsystem?.reason || 'unknown'}`);
}
if (engine.investigationSubsystem?.cardRuntimePolicyAttached !== true) {
    throw new Error('card runtime policy was not composed before live Offering generation');
}
if (engine.investigationSubsystem?.warningAttached !== true) {
    throw new Error('semantic Warning subsystem was not composed with Investigation');
}
if (engine.__investigationRuntimeAttached !== true) {
    throw new Error('investigation runtime attach marker missing');
}
if (engine.__warningSubsystemAttached !== true) {
    throw new Error('Warning runtime attach marker missing');
}
if (!engine.warningStateService || engine.warningStateService.getState() !== WARNING_STATES.CALM) {
    throw new Error('Warning state service missing or did not start at CALM');
}
if (!engine.trialTimingAuthorityService || typeof engine.trialTimingAuthorityService.getCurrentTrialIndex !== 'function') {
    throw new Error('fresh-run Trial timing authority was not attached');
}
if (engine.trialTimingAuthorityService.getCurrentTrialIndex() !== 1) {
    throw new Error('fresh-run Trial timing authority did not start at Trial 1');
}
if (engine.trialTimingAuthorityService.getNextScheduledVerse() !== engine.state.trialSchedule?.trial1) {
    throw new Error('timing authority did not mirror the current legacy schedule during migration');
}
if (engine.deckManager?.__cardRuntimePolicyAttached !== true) {
    throw new Error('DeckManager runtime category gate marker missing');
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

engine.gameFactHub.emit(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
    trialIndex: 1,
    verse: engine.state.turn,
    cardId: 'TEST_INVESTIGATION',
    reportId: 'TEST_REPORT'
});
if (engine.warningStateService.getState() !== WARNING_STATES.WATCH) {
    throw new Error('committed investigation fact did not advance live Warning state to WATCH');
}
engine.warningStateService.resetForNextTrial({ source: 'TEST_RESET', verse: engine.state.turn });

const deck = engine.deckManager;
const land = { id: 'TEST_RUNTIME_LAND', category: 'LAND', minStage: 1 };
const investigation = { id: 'TEST_RUNTIME_INVESTIGATION', category: 'INVESTIGATION', minStage: 1 };
const command = {
    id: 'CMD_TEST_RUNTIME_DISABLED',
    category: 'COMMAND',
    minStage: 1,
    cost: { food: 5, material: 4, mystic: 3, ember: 2 }
};
const project = { id: 'TEST_RUNTIME_PROJECT_DISABLED', category: 'PROJECT', minStage: 1 };

if (deck.isCardEligible(land, 1, 0) !== true) {
    throw new Error('LAND card was blocked by runtime category policy');
}
if (deck.isCardEligible(investigation, 1, 0) !== true) {
    throw new Error('INVESTIGATION card was blocked by runtime category policy');
}
if (deck.isCardEligible(command, 1, 0) !== false) {
    throw new Error('COMMAND card leaked into runtime Offering eligibility');
}
if (deck.isCardEligible(command, 1, 0, { ignoreCooldown: true, ignoreHold: true }) !== false) {
    throw new Error('fallback eligibility reopened disabled COMMAND category');
}
if (deck.isCardEligible(project, 1, 0) !== false) {
    throw new Error('PROJECT card leaked into runtime Offering eligibility');
}

engine.state.food = 100;
engine.state.wood = 100;
engine.state.material = 100;
engine.state.mystic = 100;
engine.state.ember = 20;
engine.state.hasPickedThisTurn = false;
const before = JSON.stringify({
    food: engine.state.food,
    wood: engine.state.wood,
    material: engine.state.material,
    mystic: engine.state.mystic,
    ember: engine.state.ember,
    hasPickedThisTurn: engine.state.hasPickedThisTurn
});

const disabledCommand = deck.playCommandCard(command);
if (disabledCommand?.success !== false || disabledCommand?.reason !== 'CARD_RUNTIME_DISABLED') {
    throw new Error(`disabled COMMAND reached legacy execution: ${JSON.stringify(disabledCommand)}`);
}
const afterDisabledCommand = JSON.stringify({
    food: engine.state.food,
    wood: engine.state.wood,
    material: engine.state.material,
    mystic: engine.state.mystic,
    ember: engine.state.ember,
    hasPickedThisTurn: engine.state.hasPickedThisTurn
});
if (afterDisabledCommand !== before) {
    throw new Error('disabled COMMAND mutated resources or consumed the Verse action');
}

const wrongInvestigationPath = deck.playCommandCard(investigation);
if (wrongInvestigationPath?.success !== false || wrongInvestigationPath?.reason !== 'NOT_A_COMMAND_CARD') {
    throw new Error('INVESTIGATION leaked into legacy command execution');
}
const afterWrongInvestigationPath = JSON.stringify({
    food: engine.state.food,
    wood: engine.state.wood,
    material: engine.state.material,
    mystic: engine.state.mystic,
    ember: engine.state.ember,
    hasPickedThisTurn: engine.state.hasPickedThisTurn
});
if (afterWrongInvestigationPath !== before) {
    throw new Error('wrong INVESTIGATION execution path mutated live state');
}

console.log('PASS investigation GameEngine composition attach');
