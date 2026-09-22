import assert from 'node:assert/strict';

import { createBoardPresentationDto } from '../game/src/presentation/board_presentation_contract.js';
import { TrialBoardSemanticAdapter } from '../game/src/presentation/trial_board_semantic_adapter.js';
import {
    projectTrialTacticalEffects,
    resolveTrialTacticalEffectGlyph,
    TRIAL_TACTICAL_EFFECT_PHASES,
    TRIAL_TACTICAL_EFFECT_POLARITIES
} from '../game/src/presentation/trial_tactical_effect_semantic.js';
import {
    MODIFIER_TARGETS,
    TRIAL_TERRAIN_EFFECTS
} from '../game/src/trial/domain/trial_types.js';

const available = projectTrialTacticalEffects({
    success: true,
    modifiers: [{
        source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
        target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
        operation: 'MULTIPLY',
        value: 1.2
    }]
}, {
    cell: { r: 1, c: 2 },
    routeId: 'route:a',
    phase: TRIAL_TACTICAL_EFFECT_PHASES.AVAILABLE
});

assert.equal(available.length, 1);
assert.equal(available[0].effectId, TRIAL_TERRAIN_EFFECTS.HIGH_GROUND);
assert.equal(available[0].phase, 'AVAILABLE');
assert.equal(available[0].polarity, TRIAL_TACTICAL_EFFECT_POLARITIES.NEUTRAL);
assert.deepEqual(available[0].cell, { r: 1, c: 2 });
assert.equal(available[0].changes[0].value, 1.2);
assert.equal(resolveTrialTacticalEffectGlyph(TRIAL_TERRAIN_EFFECTS.HIGH_GROUND), '▲');

const applied = projectTrialTacticalEffects({
    success: true,
    appliedModifiers: [
        {
            source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
            target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
            before: 50,
            after: 45
        },
        {
            source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
            target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
            before: 70,
            after: 55
        },
        {
            source: TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT,
            target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
            before: 55,
            after: 44
        }
    ]
}, {
    cell: { r: 3, c: 4 },
    routeId: 'route:b',
    phase: TRIAL_TACTICAL_EFFECT_PHASES.APPLIED
});

assert.equal(applied.length, 2);
assert.equal(applied[0].effectId, TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT);
assert.equal(applied[0].changes.length, 2);
assert.equal(applied[0].polarity, TRIAL_TACTICAL_EFFECT_POLARITIES.MIXED);
assert.equal(applied[1].effectId, TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT);
assert.equal(applied[1].polarity, TRIAL_TACTICAL_EFFECT_POLARITIES.ADVANTAGE);

assert.deepEqual(
    projectTrialTacticalEffects(
        { success: false, modifiers: [{ source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND }] },
        { cell: { r: 0, c: 0 } }
    ),
    []
);

const previewCandidate = {
    cell: { r: 0, c: 1 },
    canIntercept: true,
    tacticalEffects: available
};
const planningProjection = TrialBoardSemanticAdapter.fromRuntime({
    trialState: {
        planActivated: false,
        routes: [{ id: 'route:a', cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }] }],
        enemy: {}
    },
    trialPresentationState: {
        activeEnemyRoute: 'route:a',
        routePlanDrafts: new Map()
    },
    boardSize: { rows: 1, columns: 2 },
    interceptionCandidates: [previewCandidate]
});
assert.equal(planningProjection.tacticalEffects.length, 1);
assert.equal(planningProjection.tacticalEffects[0].phase, 'AVAILABLE');

const resolvedProjection = TrialBoardSemanticAdapter.fromRuntime({
    trialState: {
        planActivated: true,
        routes: [{ id: 'route:b', cells: [{ r: 3, c: 4 }] }],
        battleQueue: [{
            routeId: 'route:b',
            interceptCell: { r: 3, c: 4 },
            defenseAllocation: 3,
            status: 'RESOLVED'
        }],
        battleResults: [{
            routeId: 'route:b',
            interceptCell: { r: 3, c: 4 },
            success: true,
            appliedModifiers: [{
                source: TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT,
                target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
                before: 55,
                after: 44
            }]
        }],
        currentBattleIndex: 0,
        enemy: {}
    },
    trialPresentationState: {
        activeEnemyRoute: 'route:b',
        routePlanDrafts: new Map()
    },
    boardSize: { rows: 5, columns: 5 },
    interceptionCandidates: [previewCandidate]
});
assert.equal(resolvedProjection.tacticalEffects.length, 1);
assert.equal(resolvedProjection.tacticalEffects[0].phase, 'APPLIED');
assert.equal(resolvedProjection.tacticalEffects[0].effectId, TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT);
assert.deepEqual(resolvedProjection.tacticalEffects[0].cell, { r: 3, c: 4 });

const dto = createBoardPresentationDto({
    presentation: {
        viewMode: '2D',
        contextMode: 'TRIAL',
        viewPreset: 'WORLD',
        selectedCell: null,
        hoveredCell: null,
        focusCell: null
    },
    profile: { tacticalEffects: 'PRIMARY' },
    board: { rows: 1, columns: 1 },
    trial: {
        ...resolvedProjection,
        routes: []
    },
    cells: [[{
        r: 0,
        c: 0,
        trial: {
            available: true,
            tacticalEffects: resolvedProjection.tacticalEffects
        }
    }]]
});
assert.equal(dto.trial.tacticalEffects[0].effectId, TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT);
assert.equal(dto.cells[0][0].trial.tacticalEffects[0].phase, 'APPLIED');

console.log('TRIAL_TACTICAL_EFFECT_BOARD_SEMANTICS_OK');
