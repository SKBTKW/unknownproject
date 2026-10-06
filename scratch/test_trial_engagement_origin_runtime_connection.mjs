import assert from "node:assert/strict";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { EngagementOriginRuntime } from "../game/src/trial/systems/engagement_origin_runtime.js";
import { TRIAL_BATTLE_STATUSES } from "../game/src/trial/domain/trial_types.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

function makeCell(r, c, capabilities = []) {
    return {
        r, c,
        placed: true,
        isHQ: false,
        terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", e: 1, gl: 1 },
        trialEngagementCapabilities: [...capabilities]
    };
}

function createHarness(originCells = [], controllerOptions = {}) {
    const cells = new Map([
        ["2:1", makeCell(2, 1)],
        ["2:2", makeCell(2, 2)],
        ...originCells.map(cell => [`${cell.r}:${cell.c}`, cell])
    ]);
    let capturedSnapshotInput = null;
    const controller = new TrialController({
        powerResolver: {
            resolveSuppression: value => Number(value) || 0,
            resolveDefense: value => Number(value) || 0
        },
        combatResolver: {
            resolve: context => ({
                success: true,
                routeId: "R1",
                interceptCell: { r: context.interceptCell.r, c: context.interceptCell.c },
                human: { finalPower: context.human.baseInterceptionPower },
                enemy: { finalPower: 1 },
                prediction: { outcome: "REPEL", margin: context.human.baseInterceptionPower - 1 },
                damageToSuppression: 0,
                remainingSuppression: 0
            })
        },
        battleResolutionSnapshotFactory: {
            create(input) {
                capturedSnapshotInput = input;
                return Object.freeze({ battleId: input.battleId, actions: input.actions });
            }
        },
        ...controllerOptions
    });

    controller.startScenario({
        id: "ENGAGEMENT_ORIGIN_RUNTIME_TEST",
        trialIndex: 1,
        availableDefense: 10,
        enemySuppression: 1,
        routes: [{ id: "R1", cells: [{ r: 2, c: 1 }, { r: 2, c: 2 }] }]
    }, {
        cellResolver: (r, c) => cells.get(`${r}:${c}`) || null
    });

    controller.state.planActivated = true;
    controller.state.battleQueue = [{
        routeId: "R1",
        interceptCell: { r: 2, c: 2 },
        interceptBlockId: "cell:2:2",
        defenseAllocation: 3,
        status: TRIAL_BATTLE_STATUSES.PENDING
    }];
    controller.state.currentBattleIndex = null;

    return {
        controller,
        getCapturedSnapshotInput: () => capturedSnapshotInput
    };
}

test("one semantic local origin auto-selects at battle start", () => {
    const { controller } = createHarness([
        makeCell(1, 2, ["LOCAL_ENGAGEMENT_ORIGIN", "CONCEALMENT_SUPPORT"])
    ]);
    const started = controller.startNextBattle();
    assert.equal(started.success, true);
    assert.equal(started.engagementOrigin.applicable, true);
    assert.equal(started.engagementOrigin.candidateCount, 1);
    assert.equal(started.engagementOrigin.autoSelected, true);
    assert.deepEqual(
        { r: started.engagementOrigin.selectedOrigin.cell.r, c: started.engagementOrigin.selectedOrigin.cell.c },
        { r: 1, c: 2 }
    );

    const runtime = controller.getCurrentBattleEngagementOrigins();
    assert.equal(runtime.requiresSelection, false);
    assert.equal(runtime.selectedOrigin.cell.r, 1);
});

test("multiple origins require explicit selection and reject non-candidates", () => {
    const { controller } = createHarness([
        makeCell(1, 2, ["LOCAL_ENGAGEMENT_ORIGIN"]),
        makeCell(3, 2, ["PROJECTILE_DELIVERY"])
    ]);
    const started = controller.startNextBattle();
    assert.equal(started.engagementOrigin.candidateCount, 2);
    assert.equal(started.engagementOrigin.autoSelected, false);

    const before = controller.getCurrentBattleEngagementOrigins();
    assert.equal(before.requiresSelection, true);
    assert.equal(before.selectedOrigin, null);

    const invalid = controller.selectCurrentBattleEngagementOrigin({ r: 0, c: 0 });
    assert.equal(invalid.success, false);
    assert.equal(invalid.reason, "ENGAGEMENT_ORIGIN_NOT_CANDIDATE");

    const selected = controller.selectCurrentBattleEngagementOrigin({ r: 3, c: 2 });
    assert.equal(selected.success, true);
    assert.deepEqual(
        { r: selected.selectedOrigin.cell.r, c: selected.selectedOrigin.cell.c },
        { r: 3, c: 2 }
    );
    assert.equal(controller.getCurrentBattleEngagementOrigins().requiresSelection, false);
});

test("selected origin enters BattleContext and INTERCEPT action provenance without changing combat contract", () => {
    const { controller, getCapturedSnapshotInput } = createHarness([
        makeCell(1, 2, ["LOCAL_ENGAGEMENT_ORIGIN"])
    ]);
    controller.startNextBattle();
    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, true);

    const captured = getCapturedSnapshotInput();
    assert.ok(captured);
    assert.equal(captured.battleContext.humanEngagementOrigin.r, 1);
    assert.equal(captured.battleContext.humanEngagementOrigin.c, 2);
    assert.deepEqual(captured.actions[0].origin, { r: 1, c: 2 });
    assert.equal(captured.actions[0].type, "INTERCEPT");
});

test("no origin candidate preserves current Trial resolution", () => {
    const { controller, getCapturedSnapshotInput } = createHarness([]);
    const started = controller.startNextBattle();
    assert.equal(started.success, true);
    assert.equal(started.engagementOrigin.applicable, true);
    assert.equal(started.engagementOrigin.candidateCount, 0);
    assert.equal(started.engagementOrigin.selectedOrigin, null);

    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, true);
    const captured = getCapturedSnapshotInput();
    assert.equal(captured.battleContext.humanEngagementOrigin, null);
    assert.equal(captured.actions[0].origin, null);
});

test("multiple unselected candidates never create a new progression blocker", () => {
    const { controller, getCapturedSnapshotInput } = createHarness([
        makeCell(1, 2, ["LOCAL_ENGAGEMENT_ORIGIN"]),
        makeCell(3, 2, ["PROJECTILE_DELIVERY"])
    ]);
    const started = controller.startNextBattle();
    assert.equal(started.success, true);
    assert.equal(started.engagementOrigin.candidateCount, 2);
    assert.equal(started.engagementOrigin.selectedOrigin, null);
    assert.equal(controller.getCurrentBattleEngagementOrigins().requiresSelection, true);

    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, true);
    const captured = getCapturedSnapshotInput();
    assert.equal(captured.battleContext.humanEngagementOrigin, null);
    assert.equal(captured.actions[0].origin, null);
});

test("explicit no-resolver runtime preserves legacy Trial progression", () => {
    const { controller, getCapturedSnapshotInput } = createHarness(
        [makeCell(1, 2, ["LOCAL_ENGAGEMENT_ORIGIN"])],
        { engagementOriginRuntime: new EngagementOriginRuntime() }
    );
    const started = controller.startNextBattle();
    assert.equal(started.success, true);
    assert.equal(started.engagementOrigin.applicable, false);
    assert.equal(started.engagementOrigin.candidateCount, 0);

    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, true);
    const captured = getCapturedSnapshotInput();
    assert.equal(captured.battleContext.humanEngagementOrigin, null);
    assert.equal(captured.actions[0].origin, null);
});

console.log(`Trial Engagement Origin Runtime Connection: ${cases}/${cases} cases PASS`);
