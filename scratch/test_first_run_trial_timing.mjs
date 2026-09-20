import assert from "node:assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { FirstRunState } from "../game/src/tutorial/first_run_state.js";
import { TrialDueStateService } from "../game/src/trial/systems/trial_due_state_service.js";

{
    const state = new FirstRunState({ active: true });
    assert.equal(state.active, true);
    assert.equal(state.hasSceneOccurred("INTRO"), false);
    state.recordScene("INTRO");
    state.setBasicLoopComplete(true);

    const restored = new FirstRunState();
    restored.restoreState(state.getRestoreState());
    assert.equal(restored.active, true);
    assert.equal(restored.hasSceneOccurred("INTRO"), true);
    assert.equal(restored.basicLoopComplete, true);

    restored.restoreState(null);
    assert.equal(restored.active, true, "missing snapshot must not silently disable FirstRun");
}

{
    const engine = GameEngine.createGame({
        runSeed: 20260920,
        firstRun: true
    });

    assert.equal(engine.firstRunState instanceof FirstRunState, true);
    assert.equal(engine.firstRunState.active, true);
    assert.notEqual(engine.trialTimingAuthorityService, null);

    const authority = engine.trialTimingAuthorityService;
    assert.equal(authority.getScheduledVerse(1), 15);
    assert.equal(authority.getScheduledVerse(2) > 15, true);
    assert.equal(authority.getScheduledVerse(3) > authority.getScheduledVerse(2), true);

    assert.equal(engine.state.trialSchedule.trial1, 15);
    assert.equal(engine.state.nextTrialTurn, 15);

    for (let verse = 1; verse <= 14; verse++) {
        assert.equal(authority.isCurrentTrialDue(verse), false);
    }
    assert.equal(authority.isCurrentTrialDue(15), true);

    const dueService = new TrialDueStateService({
        gameFactHub: engine.gameFactHub,
        timingAuthority: authority
    });
    assert.equal(dueService.evaluateForVerse(14), null);
    const pending = dueService.evaluateForVerse(15);
    assert.equal(pending?.trialIndex, 1);

    assert.equal(engine.state.stage.id, 1);
    assert.equal(engine.state.stage.size, 5);
    engine.state.turn = 15;
    assert.equal(engine.state.stage.id, 1, "reaching Verse15 alone must not advance Stage");
    assert.equal(engine.state.stage.size, 5, "reaching Verse15 alone must keep Stage1 board size");
}

{
    const normal = GameEngine.createGame({
        runSeed: 20260920,
        firstRun: false
    });
    assert.equal(normal.firstRunState.active, false);

    const unspecified = GameEngine.createGame({
        runSeed: 20260920
    });
    assert.equal(unspecified.firstRunState.active, false);

    const explicit = GameEngine.createGame({
        runSeed: 20260920,
        firstRunState: new FirstRunState({ active: true })
    });
    assert.equal(explicit.firstRunState.active, true);
    assert.equal(explicit.trialTimingAuthorityService.getScheduledVerse(1), 15);
}

{
    const engine = GameEngine.createGame({
        runSeed: 20260920,
        firstRun: true
    });

    engine.firstRunState.recordScene("FIRST_LAND");
    engine.state.ember = 18;
    engine.nextTurn();

    const point = engine.historySnapshotService.getRestorePoint(2);
    assert.notEqual(point, null);
    assert.equal(point.runtime.trialTimingState.schedule.find(entry => entry.trialIndex === 1)?.verse, 15);
    assert.deepEqual(point.runtime.firstRunState.occurredScenes, ["FIRST_LAND"]);

    engine.firstRunState.recordScene("FUTURE_SCENE");
    assert.equal(engine.firstRunState.hasSceneOccurred("FUTURE_SCENE"), true);

    const restored = engine.historyRestoreService.restoreVerse(2);
    assert.equal(restored.success, true);
    assert.equal(engine.trialTimingAuthorityService.getScheduledVerse(1), 15);
    assert.equal(engine.firstRunState.active, true);
    assert.equal(engine.firstRunState.hasSceneOccurred("FIRST_LAND"), true);
    assert.equal(engine.firstRunState.hasSceneOccurred("FUTURE_SCENE"), false);
}

console.log("FirstRun Trial1=Verse15 timing/state contract: PASS");
