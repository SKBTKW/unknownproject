import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import {
    EnemyArmyBlueprint, ENEMY_BLUEPRINT_SCHEMA_VERSION, blueprintArmyId
} from '../game/src/trial/domain/enemy_army_blueprint.js';
import {
    EnemyActivityDirectionSnapshot, ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION,
    ENEMY_ACTIVITY_DIRECTIONS
} from '../game/src/trial/domain/enemy_activity_direction_snapshot.js';
import {
    classifyEnemyActivityDirectionRelationship,
    ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS
} from '../game/src/trial/domain/enemy_activity_direction_relationship.js';
import {
    EnemyForceConsolidationResolver,
    resolveParticipatingForceSourceSnapshots
} from '../game/src/trial/systems/enemy_force_consolidation_resolver.js';
import { EnemyInvasionFoundationLifecycleService } from '../game/src/trial/systems/enemy_invasion_foundation_lifecycle_service.js';
import { resolveParticipatingForceInvestigationProvenance } from '../game/src/warning/domain/participating_force_investigation_provenance.js';
import { ENEMY_OBSERVATION_SCOPES } from '../game/src/warning/domain/enemy_observation_subject.js';

const runSeed = 73;
const stageId = 1;
const armyId = blueprintArmyId(runSeed, stageId);
const sourceId = slot => `${armyId}_${slot}`;

function composition(slot) {
    const species = { A: 'LARGE', B: 'MEDIUM', C: 'SMALL' }[slot];
    const equipment = { A: 'HEAVY', B: 'STANDARD', C: 'LIGHT' }[slot];
    return {
        speciesComposition: [{ type: species, share: 1 }],
        equipmentComposition: [{ type: equipment, share: 1 }]
    };
}

function blueprint() {
    return new EnemyArmyBlueprint({
        schemaVersion: ENEMY_BLUEPRINT_SCHEMA_VERSION,
        runSeed,
        stageId,
        armyId,
        generationPolicy: { id: 'test-policy', version: 1 },
        forces: ['A', 'B', 'C'].map(slot => ({
            id: sourceId(slot), slot, composition: composition(slot)
        }))
    });
}

function directions(values = ['NORTH', 'EAST', 'SOUTH']) {
    return new EnemyActivityDirectionSnapshot({
        schemaVersion: ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION,
        stageId,
        armyId,
        forces: ['A', 'B', 'C'].map((slot, index) => ({
            sourceForceId: sourceId(slot), slot, activityDirection: values[index]
        }))
    });
}

function resolve(participantCount, values) {
    return new EnemyForceConsolidationResolver().resolve({
        blueprint: blueprint(),
        directionSnapshot: directions(values),
        participantCount
    });
}

function hydrateOptions(engine) {
    const masters = [
        ...engine.deckManager.getLandCardMaster(),
        ...(engine.getAdditionalCardMastersForRestore?.() || [])
    ];
    return { resolveCardMaster: id => masters.find(card => card.id === id) };
}

test('direction utility classifies every ordered cardinal pair', () => {
    for (const first of ENEMY_ACTIVITY_DIRECTIONS) {
        for (const second of ENEMY_ACTIVITY_DIRECTIONS) {
            const relation = classifyEnemyActivityDirectionRelationship(first, second);
            if (first === second) assert.equal(relation, ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.SAME);
            else if ((first === 'NORTH' && second === 'SOUTH')
                || (first === 'SOUTH' && second === 'NORTH')
                || (first === 'EAST' && second === 'WEST')
                || (first === 'WEST' && second === 'EAST')) {
                assert.equal(relation, ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.OPPOSITE);
            } else assert.equal(relation, ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.ADJACENT);
        }
    }
});

test('3, 2 and 1 participating forces preserve all source assignments exactly once', () => {
    const expected = ['A', 'B', 'C'].map(sourceId);
    for (const count of [3, 2, 1]) {
        const snapshot = resolve(count).getSnapshot();
        assert.equal(snapshot.participatingForces.length, count);
        const assigned = snapshot.participatingForces.flatMap(item => item.sourceForceIds);
        assert.deepEqual([...assigned].sort(), [...expected].sort());
        assert.equal(new Set(assigned).size, 3);
        assert.deepEqual(snapshot.sourceForceIds, expected);
    }
    assert.deepEqual(resolve(3).getSnapshot().participatingForces.map(item => item.sourceForceIds),
        [[sourceId('A')], [sourceId('B')], [sourceId('C')]]);
    assert.deepEqual(resolve(1).getSnapshot().participatingForces[0].sourceForceIds, expected);
});

test('2-force resolution prefers same, then adjacent, and avoids an opposite pair when possible', () => {
    const same = resolve(2, ['NORTH', 'NORTH', 'SOUTH']).getSnapshot();
    assert.deepEqual(same.participatingForces[0].sourceForceIds, [sourceId('A'), sourceId('B')]);
    assert.equal(same.candidateEvaluations[0].relationship, 'SAME');

    const avoidOpposite = resolve(2, ['NORTH', 'SOUTH', 'EAST']).getSnapshot();
    const merged = avoidOpposite.participatingForces.find(item => item.sourceForceIds.length === 2);
    assert.deepEqual(merged.sourceForceIds, [sourceId('A'), sourceId('C')]);
    assert.equal(merged.directionDiagnostics.hasOppositePair, false);
    assert.equal(avoidOpposite.candidateEvaluations.at(-1).relationship, 'OPPOSITE');
});

test('all 64 direction triples resolve deterministically with diagnosable candidates', () => {
    for (const first of ENEMY_ACTIVITY_DIRECTIONS) {
        for (const second of ENEMY_ACTIVITY_DIRECTIONS) {
            for (const third of ENEMY_ACTIVITY_DIRECTIONS) {
                const values = [first, second, third];
                const one = resolve(2, values).getSnapshot();
                const two = resolve(2, values).getSnapshot();
                assert.deepEqual(one, two);
                assert.equal(one.candidateEvaluations.length, 3);
                assert.ok(one.resolutionPolicy.selectionReason.includes(
                    one.candidateEvaluations[0].relationship
                ));
            }
        }
    }
});

test('single participant exposes opposite conflict without selecting or changing a direction', () => {
    const original = directions(['NORTH', 'SOUTH', 'EAST']);
    const before = original.getSnapshot();
    const participant = new EnemyForceConsolidationResolver().resolve({
        blueprint: blueprint(), directionSnapshot: original, participantCount: 1
    }).getSnapshot().participatingForces[0];
    assert.equal(participant.directionDiagnostics.hasOppositePair, true);
    assert.equal(participant.directionDiagnostics.hasDirectionConflict, true);
    assert.deepEqual(participant.directionDiagnostics.sourceDirections.map(item => item.activityDirection),
        ['NORTH', 'SOUTH', 'EAST']);
    assert.deepEqual(original.getSnapshot(), before);
    assert.equal(Object.hasOwn(participant, 'ingressDirection'), false);
});

test('invalid participant counts fail and source composition remains Blueprint-owned', () => {
    for (const value of [0, 4, null, 2.5]) {
        assert.throws(() => resolve(value), /PARTICIPANT_COUNT_INVALID/);
    }
    const truth = blueprint();
    const before = truth.getSnapshot();
    const snapshot = new EnemyForceConsolidationResolver().resolve({
        blueprint: truth, directionSnapshot: directions(), participantCount: 1
    }).getSnapshot();
    assert.deepEqual(truth.getSnapshot(), before);
    assert.equal(Object.hasOwn(snapshot.participatingForces[0], 'composition'), false);
    const sources = resolveParticipatingForceSourceSnapshots({
        participatingForce: snapshot.participatingForces[0], blueprint: truth
    });
    assert.deepEqual(sources, before.forces);
    sources[0].composition.speciesComposition[0].share = 0.5;
    assert.deepEqual(truth.getSnapshot(), before);
});

test('investigation provenance references only matching SOURCE_FORCE observations', () => {
    const consolidation = resolve(2, ['NORTH', 'SOUTH', 'EAST']).getSnapshot();
    const merged = consolidation.participatingForces.find(item => item.sourceForceIds.length === 2);
    const knownEnemyState = {
        reports: [{
            id: 'mixed',
            observations: [
                { tag: 'A_KNOWN', subject: { scope: ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE, sourceForceId: sourceId('A') } },
                { tag: 'C_KNOWN', subject: { scope: ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE, sourceForceId: sourceId('C') } },
                { tag: 'ARMY_KNOWN', subject: { scope: ENEMY_OBSERVATION_SCOPES.ARMY, armyId } },
                { tag: 'REGION_KNOWN', subject: { scope: ENEMY_OBSERVATION_SCOPES.REGION_UNATTRIBUTED, regionId: 'EAST' } }
            ]
        }, {
            id: 'c-second',
            observations: [{ tag: 'C_SECOND', subject: {
                scope: ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE, sourceForceId: sourceId('C')
            } }]
        }]
    };
    const before = structuredClone(knownEnemyState);
    const provenance = resolveParticipatingForceInvestigationProvenance({ merged, participatingForce: merged, knownEnemyState });
    assert.deepEqual(provenance.reportReferences.map(item => item.reportId), ['mixed', 'c-second']);
    assert.deepEqual(provenance.reportReferences[0].observationIndexes, [0, 1]);
    assert.deepEqual(provenance.reportReferences[0].sourceForceIds, [sourceId('A'), sourceId('C')]);
    assert.deepEqual(knownEnemyState, before);
    assert.equal(JSON.stringify(provenance).includes('ARMY_KNOWN'), false);
    assert.equal(JSON.stringify(provenance).includes('REGION_KNOWN'), false);
});

test('unobserved Blueprint truth never enters provenance projections', () => {
    const participant = resolve(1).getSnapshot().participatingForces[0];
    const knownEnemyState = { reports: [{
        id: 'limited',
        observations: [{ tag: 'SMALL_PRESENT', subject: {
            scope: ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE, sourceForceId: sourceId('C')
        } }]
    }] };
    const provenance = resolveParticipatingForceInvestigationProvenance({
        participatingForce: participant, knownEnemyState
    });
    assert.equal(JSON.stringify(provenance).includes('SMALL'), false);
    assert.equal(JSON.stringify(provenance).includes('share'), false);
    assert.deepEqual(provenance.reportReferences[0].observationIndexes, [0]);
});

test('consolidation persists exactly and legacy v1 invasion state upgrades compatibly', () => {
    const engine = new GameEngine({ runSeed, firstRun: true });
    const lifecycle = new EnemyInvasionFoundationLifecycleService({ gameState: engine.state });
    const directionSnapshot = directions(['WEST', 'WEST', 'EAST']);
    const consolidation = new EnemyForceConsolidationResolver().resolve({
        blueprint: blueprint(), directionSnapshot, participantCount: 2
    });
    lifecycle.registerDirectionSnapshot(directionSnapshot);
    assert.equal(lifecycle.registerConsolidation(consolidation).registered, true);
    assert.equal(lifecycle.registerConsolidation(consolidation).registered, false);
    const saved = serializeGameState(engine.state);
    const restored = new GameEngine({ runSeed: 999, firstRun: true });
    hydrateGameState(restored.state, saved, hydrateOptions(restored));
    assert.deepEqual(
        restored.state.enemyInvasionFoundationState.consolidations[0],
        consolidation.getSnapshot()
    );
    assert.deepEqual(
        new EnemyInvasionFoundationLifecycleService({ gameState: restored.state })
            .getConsolidation(stageId, armyId).getSnapshot(),
        consolidation.getSnapshot()
    );

    const legacy = {
        schemaVersion: 1,
        directionSnapshots: [directionSnapshot.getSnapshot()],
        plans: []
    };
    const legacySave = structuredClone(saved);
    legacySave.enemyInvasionFoundationState = legacy;
    hydrateGameState(restored.state, legacySave, hydrateOptions(restored));
    assert.equal(restored.state.enemyInvasionFoundationState.schemaVersion, 2);
    assert.deepEqual(restored.state.enemyInvasionFoundationState.consolidations, []);
});

