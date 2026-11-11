import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RandomSource } from '../game/src/core/check_system/random_source.js';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import {
    EnemyActivityDirectionSnapshot,
    ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION,
    ENEMY_ACTIVITY_DIRECTIONS
} from '../game/src/trial/domain/enemy_activity_direction_snapshot.js';
import { EnemyInvasionPlan } from '../game/src/trial/domain/enemy_invasion_plan.js';
import {
    EnemyInvasionEntryResolver,
    ENEMY_INVASION_RESOLUTION_POLICY,
    listEdgeCells,
    oppositeDirection,
    resolveIngressDirection
} from '../game/src/trial/systems/enemy_invasion_entry_resolver.js';
import { deriveEnemyArmyStreamSeed } from '../game/src/trial/systems/enemy_army_seed_derivation.js';
import { EnemyInvasionFoundationLifecycleService } from '../game/src/trial/systems/enemy_invasion_foundation_lifecycle_service.js';
import { InvestigationResolver } from '../game/src/warning/systems/investigation_resolver.js';
import { createKnownEnemyState, recordInvestigationReport } from '../game/src/warning/domain/known_enemy_state.js';
import { ENEMY_OBSERVATION_SCOPES } from '../game/src/warning/domain/enemy_observation_subject.js';

const armyId = 'ENEMY_ARMY_V1_42_STAGE_1';
const forceId = slot => `${armyId}_${slot}`;

function directions(values = ['NORTH', 'EAST', 'SOUTH']) {
    return new EnemyActivityDirectionSnapshot({
        schemaVersion: ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION,
        stageId: 1,
        armyId,
        forces: ['A', 'B', 'C'].map((slot, index) => ({
            sourceForceId: forceId(slot),
            slot,
            activityDirection: values[index]
        }))
    });
}

function participants(slots = ['A', 'B', 'C']) {
    return slots.map(slot => ({ sourceForceId: forceId(slot), participantUnitId: `UNIT_${slot}` }));
}

function resolve(runSeed = 42, boardSize = 5, slots = ['A', 'B', 'C'], snapshot = directions()) {
    return new EnemyInvasionEntryResolver().resolve({
        stageId: 1,
        armyId,
        runSeed,
        boardSize,
        directionSnapshot: snapshot,
        participants: participants(slots)
    });
}

function hydrateOptions(engine) {
    const masters = [
        ...engine.deckManager.getLandCardMaster(),
        ...(engine.getAdditionalCardMastersForRestore?.() || [])
    ];
    return { resolveCardMaster: id => masters.find(card => card.id === id) };
}

test('70/15/15 direction weights are symmetric and never select the opposite direction', () => {
    assert.deepEqual(ENEMY_INVASION_RESOLUTION_POLICY.weights, {
        same: 70, clockwise: 15, counterclockwise: 15, opposite: 0
    });
    const expected = {
        NORTH: ['NORTH', 'EAST', 'WEST'],
        EAST: ['EAST', 'SOUTH', 'NORTH'],
        SOUTH: ['SOUTH', 'WEST', 'EAST'],
        WEST: ['WEST', 'NORTH', 'SOUTH']
    };
    for (const direction of ENEMY_ACTIVITY_DIRECTIONS) {
        assert.equal(resolveIngressDirection(direction, 0), expected[direction][0]);
        assert.equal(resolveIngressDirection(direction, 0.699999), expected[direction][0]);
        assert.equal(resolveIngressDirection(direction, 0.70), expected[direction][1]);
        assert.equal(resolveIngressDirection(direction, 0.849999), expected[direction][1]);
        assert.equal(resolveIngressDirection(direction, 0.85), expected[direction][2]);
        assert.equal(resolveIngressDirection(direction, 0.999999), expected[direction][2]);
        assert.ok(!expected[direction].includes(oppositeDirection(direction)));
    }
});

test('5x5, 7x7 and 9x9 expose exactly N cells on every named edge', () => {
    for (const size of [5, 7, 9]) {
        for (const direction of ENEMY_ACTIVITY_DIRECTIONS) {
            const cells = listEdgeCells(size, direction);
            assert.equal(cells.length, size);
            assert.equal(new Set(cells.map(cell => `${cell.r}:${cell.c}`)).size, size);
            for (const cell of cells) {
                if (direction === 'NORTH') assert.equal(cell.r, 0);
                if (direction === 'EAST') assert.equal(cell.c, size - 1);
                if (direction === 'SOUTH') assert.equal(cell.r, size - 1);
                if (direction === 'WEST') assert.equal(cell.c, 0);
            }
        }
    }
    assert.ok(listEdgeCells(5, 'NORTH').some(cell => cell.r === 0 && cell.c === 4));
    assert.ok(listEdgeCells(5, 'EAST').some(cell => cell.r === 0 && cell.c === 4));
});

test('resolution is deterministic, A-B-C ordered, unique and skips non-participants', () => {
    const engine = new GameEngine({ runSeed: 773, firstRun: true });
    const gameplayRandomBefore = engine.gameplayRandom.getState();
    const checkRandomBefore = engine.checkSystem.getState();
    const first = new EnemyInvasionEntryResolver().resolve({
        stageId: 1,
        armyId,
        runSeed: 773,
        boardSize: 7,
        directionSnapshot: directions(),
        participants: participants(['C', 'A', 'B'])
    }).getSnapshot();
    const second = resolve(773, 7).getSnapshot();
    assert.deepEqual(first, second);
    assert.deepEqual(engine.gameplayRandom.getState(), gameplayRandomBefore);
    assert.deepEqual(engine.checkSystem.getState(), checkRandomBefore);
    assert.deepEqual(first.entries.map(entry => entry.sourceForceId), participants().map(item => item.sourceForceId));
    assert.equal(new Set(first.entries.map(entry => `${entry.ingressCell.r}:${entry.ingressCell.c}`)).size, 3);
    assert.equal(first.boardSize, 7);
    assert.equal(first.resolutionPolicy.runSeed, 773);

    const onlyC = resolve(773, 7, ['C']).getSnapshot();
    assert.deepEqual(onlyC.entries.map(entry => entry.sourceForceId), [forceId('C')]);
});

test('cross-edge corner collisions are removed before the later force draw', () => {
    const snapshot = directions(['NORTH', 'EAST', 'SOUTH']);
    let collisionSeed = null;
    for (let runSeed = 0; runSeed < 100000 && collisionSeed === null; runSeed += 1) {
        const raw = ['A', 'B'].map(slot => {
            const sourceForceId = forceId(slot);
            const activity = snapshot.getForce(sourceForceId).activityDirection;
            const directionSeed = deriveEnemyArmyStreamSeed([
                'enemy-invasion-entry-v1', runSeed, 1, armyId, sourceForceId, 'direction'
            ]);
            const cellSeed = deriveEnemyArmyStreamSeed([
                'enemy-invasion-entry-v1', runSeed, 1, armyId, sourceForceId, 'cell'
            ]);
            const ingressDirection = resolveIngressDirection(activity, new RandomSource(directionSeed).nextFloat());
            const cells = listEdgeCells(5, ingressDirection);
            const ingressCell = cells[new RandomSource(cellSeed).nextInt(0, cells.length - 1)];
            return { ingressDirection, ingressCell };
        });
        if (raw[0].ingressDirection !== raw[1].ingressDirection
            && raw[0].ingressCell.r === raw[1].ingressCell.r
            && raw[0].ingressCell.c === raw[1].ingressCell.c) {
            collisionSeed = runSeed;
        }
    }
    assert.notEqual(collisionSeed, null);
    const entries = resolve(collisionSeed, 5, ['A', 'B'], snapshot).getSnapshot().entries;
    assert.notEqual(entries[0].ingressDirection, entries[1].ingressDirection);
    assert.notDeepEqual(entries[0].ingressCell, entries[1].ingressCell);
});

test('candidate exhaustion fails closed without changing direction or allowing overlap', () => {
    assert.throws(() => resolve(42, 1, ['A', 'B']), error =>
        error instanceof RangeError
        && error.message === 'ENEMY_INVASION_CANDIDATES_EXHAUSTED'
        && error.sourceForceId === forceId('B')
    );
});

test('foundation state owns explicit directions and resolved plans across save/restore', () => {
    const engine = new GameEngine({ runSeed: 42, firstRun: true });
    const lifecycle = new EnemyInvasionFoundationLifecycleService({ gameState: engine.state });
    const directionSnapshot = directions();
    const plan = resolve(42, 5);
    assert.equal(lifecycle.registerDirectionSnapshot(directionSnapshot).registered, true);
    assert.equal(lifecycle.registerPlan(plan).registered, true);
    assert.equal(lifecycle.registerPlan(EnemyInvasionPlan.fromSnapshot(plan.getSnapshot())).registered, false);
    assert.deepEqual(lifecycle.getDirectionSnapshot(1, armyId).getSnapshot(), directionSnapshot.getSnapshot());
    assert.deepEqual(lifecycle.getPlan(1, armyId).getSnapshot(), plan.getSnapshot());

    const saved = serializeGameState(engine.state);
    const restored = new GameEngine({ runSeed: 999, firstRun: true });
    hydrateGameState(restored.state, saved, hydrateOptions(restored));
    assert.deepEqual(restored.state.enemyInvasionFoundationState, lifecycle.getSnapshot());
    assert.deepEqual(
        restored.state.enemyInvasionFoundationState.plans[0],
        plan.getSnapshot()
    );

    const legacy = structuredClone(saved);
    delete legacy.enemyInvasionFoundationState;
    hydrateGameState(restored.state, legacy, hydrateOptions(restored));
    assert.equal(Object.hasOwn(restored.state, 'enemyInvasionFoundationState'), false);
});

test('investigation observations retain force, army and unattributed-region subjects', () => {
    const forceSubject = { scope: ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE, sourceForceId: forceId('C') };
    const armySubject = { scope: ENEMY_OBSERVATION_SCOPES.ARMY, armyId };
    const regionSubject = { scope: ENEMY_OBSERVATION_SCOPES.REGION_UNATTRIBUTED, regionId: 'NORTH_FRONTIER' };
    const profile = {
        trialIndex: 1,
        physiqueTraits: [{ tag: 'LARGE_BODY_PRESENT', subject: forceSubject }],
        equipmentTraits: [{ tag: 'HEAVY_EQUIPMENT', subject: armySubject }],
        terrainTraits: [{ tag: 'NORTH_TRACKS', subject: regionSubject }]
    };
    const report = new InvestigationResolver({ rng: () => 0 }).resolve({
        profile,
        observedAtVerse: 4,
        reportId: 'identity-report',
        sourcePolicy: {
            sourceType: 'TEST',
            allowedFacets: ['physiqueTraits', 'equipmentTraits', 'terrainTraits'],
            maxObservations: 3
        }
    });
    assert.deepEqual(report.observations.map(item => item.subject), [forceSubject, armySubject, regionSubject]);
    assert.equal(report.observations[1].subject.sourceForceId, undefined);
    assert.equal(report.observations[2].subject.sourceForceId, undefined);

    profile.physiqueTraits[0].subject.sourceForceId = forceId('A');
    assert.equal(report.observations[0].subject.sourceForceId, forceId('C'));
});

test('multiple observations for one source force persist while Truth remains unchanged', () => {
    const truth = {
        sourceForceId: forceId('C'),
        species: ['LARGE'],
        equipment: ['HEAVY'],
        hidden: 'UNOBSERVED_ROUTE'
    };
    const before = structuredClone(truth);
    const subject = { scope: ENEMY_OBSERVATION_SCOPES.SOURCE_FORCE, sourceForceId: truth.sourceForceId };
    const known = createKnownEnemyState({ trialIndex: 1 });
    const resolver = new InvestigationResolver({ rng: () => 0 });
    for (const [index, tag] of ['LARGE_BODY_PRESENT', 'HEAVY_EQUIPMENT'].entries()) {
        const report = resolver.resolve({
            profile: { trialIndex: 1, physiqueTraits: [{ tag, subject }] },
            knownEnemyState: known,
            observedAtVerse: index + 1,
            reportId: `force-c-${index}`,
            sourcePolicy: { sourceType: 'TEST', allowedFacets: ['physiqueTraits'], maxObservations: 1 }
        });
        recordInvestigationReport(known, report);
    }
    assert.equal(known.reports.length, 2);
    assert.ok(known.reports.every(report => report.observations[0].subject.sourceForceId === forceId('C')));
    assert.deepEqual(truth, before);
    assert.equal(JSON.stringify(known).includes('UNOBSERVED_ROUTE'), false);
});

test('legacy reports without subjects round-trip unchanged', () => {
    const engine = new GameEngine({ runSeed: 42, firstRun: true });
    engine.state.knownEnemyState = {
        trialIndex: 1,
        reports: [{
            id: 'legacy-report', observedAtVerse: 1, trialIndex: 1, sourceType: 'LEGACY',
            threatRevision: null, observations: [{ facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' }], textKey: null
        }],
        observedTags: ['LARGE_BODY_PRESENT']
    };
    const saved = serializeGameState(engine.state);
    const restored = new GameEngine({ runSeed: 42, firstRun: true });
    hydrateGameState(restored.state, saved, hydrateOptions(restored));
    assert.deepEqual(restored.state.knownEnemyState, engine.state.knownEnemyState);
});
