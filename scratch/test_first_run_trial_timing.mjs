import assert from "assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { FirstRunState } from "../game/src/tutorial/first_run_state.js";
import { GAME_FACT_TYPES } from "../game/src/core/game_fact.js";
import { TrialDueStateService } from "../game/src/trial/systems/trial_due_state_service.js";
import { TrialStageProgressionService } from "../game/src/trial/systems/trial_stage_progression_service.js";

// ============================================================================
// 1. FirstRunState 単体契約
// ============================================================================
{
    const state = new FirstRunState({ active: true });
    assert.equal(state.active, true);
    assert.equal(state.hasSceneOccurred("SCENE_INTRO"), false);
    assert.equal(state.basicLoopComplete, false);

    state.recordScene("SCENE_INTRO");
    assert.equal(state.hasSceneOccurred("SCENE_INTRO"), true);
    assert.equal(state.hasSceneOccurred("SCENE_OTHER"), false);

    state.setBasicLoopComplete(true);
    assert.equal(state.basicLoopComplete, true);

    const snapshot = state.getRestoreState();
    assert.equal(snapshot.active, true);
    assert.deepEqual(snapshot.occurredScenes, ["SCENE_INTRO"]);
    assert.equal(snapshot.basicLoopComplete, true);

    const restored = new FirstRunState();
    restored.restoreState(snapshot);
    assert.equal(restored.active, true);
    assert.equal(restored.hasSceneOccurred("SCENE_INTRO"), true);
    assert.equal(restored.basicLoopComplete, true);

    // 空スナップショットで勝手にinactiveにならないこと
    restored.restoreState(null);
    assert.equal(restored.active, true);
    restored.restoreState({});
    assert.equal(restored.active, true);
}

// ============================================================================
// 2. Focused Diagnostic A: fresh FirstRun 開始
// ============================================================================
{
    const engine = GameEngine.createGame({
        runSeed: 20260919,
        firstRun: true
    });

    // modern timing authority が存在
    const authority = engine.trialTimingAuthorityService;
    assert.notEqual(authority, null, "TrialTimingAuthorityService must be present");

    const readModel = authority.getReadModel();
    assert.equal(readModel.currentTrialIndex, 1, "Current trial index must start at 1");

    // Trial1 = 15固定, 15 < trial2 < trial3
    const scheduled1 = authority.getScheduledVerse(1);
    const scheduled2 = authority.getScheduledVerse(2);
    const scheduled3 = authority.getScheduledVerse(3);

    assert.equal(scheduled1, 15, "Trial1 scheduled verse must be strictly 15 for fresh FirstRun");
    assert.equal(scheduled2 > 15, true, `Trial2 verse (${scheduled2}) must be > 15`);
    assert.equal(scheduled3 > scheduled2, true, `Trial3 verse (${scheduled3}) must be > Trial2 (${scheduled2})`);

    // legacy compatibility mirror 同期
    assert.equal(engine.state.trialSchedule.trial1, 15, "legacy trialSchedule.trial1 must be mirrored to 15");
    assert.equal(engine.state.nextTrialTurn, 15, "legacy nextTrialTurn must be mirrored to 15");

    // firstRunState が engine 所有で存在
    assert.equal(engine.firstRunState instanceof FirstRunState, true, "engine.firstRunState must be service-owned");
    assert.equal(engine.firstRunState.active, true, "engine.firstRunState must be active");
}

// ============================================================================
// 3. 非初回Run（推測防止・通常スケジュール維持）
// ============================================================================
{
    const normalEngine = GameEngine.createGame({
        runSeed: 20260919,
        firstRun: false
    });
    assert.equal(normalEngine.firstRunState.active, false, "firstRun=false must not activate FirstRunState");

    const unspecifiedEngine = GameEngine.createGame({
        runSeed: 20260919
    });
    assert.equal(unspecifiedEngine.firstRunState.active, false, "unspecified firstRun must not guess true");

    // firstRunState を明示的に渡した場合のみ active
    const explicitStateEngine = GameEngine.createGame({
        runSeed: 20260919,
        firstRunState: new FirstRunState({ active: true })
    });
    assert.equal(explicitStateEngine.firstRunState.active, true, "explicit firstRunState.active=true must activate");
    assert.equal(explicitStateEngine.trialTimingAuthorityService.getScheduledVerse(1), 15);
}

// ============================================================================
// 4. Focused Diagnostic B: TrialTimingAuthorityService.isCurrentTrialDue(currentVerse)
//    および Verse14 commit -> Verse15 TrialDueStateService
// ============================================================================
{
    const engine = GameEngine.createGame({
        runSeed: 20260919,
        firstRun: true
    });

    const authority = engine.trialTimingAuthorityService;

    // 正式 API isCurrentTrialDue(currentVerse) の検証
    for (let verse = 1; verse <= 14; verse++) {
        assert.equal(
            authority.isCurrentTrialDue(verse),
            false,
            `isCurrentTrialDue(${verse}) must be false for Verse ${verse} (scheduled: 15)`
        );
        assert.equal(
            authority.getDistanceToNextTrial(verse),
            15 - verse,
            `distance to next trial at Verse ${verse} must be ${15 - verse}`
        );
    }

    assert.equal(
        authority.isCurrentTrialDue(15),
        true,
        "isCurrentTrialDue(15) must be true when reaching scheduled Verse 15"
    );
    assert.equal(
        authority.getDistanceToNextTrial(15),
        0,
        "distance to next trial at Verse 15 must be 0"
    );

    const dueService = new TrialDueStateService({
        gameFactHub: engine.gameFactHub,
        timingAuthority: authority
    });

    // Verse 13 -> 14: not due
    assert.equal(dueService.evaluateForVerse(14), null);

    // Verse 14 commit: nextTurn = 15
    const pending = dueService.evaluateForVerse(15);
    assert.notEqual(pending, null, "Trial1 must be pending when nextTurn reaches 15");
    assert.equal(pending.trialIndex, 1);

    // FirstRun コードが直接 pending を作っていないことの確認
    // (FirstRunService や FirstRunState に pending / launch メソッドが存在しない)
    assert.equal(typeof engine.firstRunService.tryStartPending, "undefined");
    assert.equal(typeof engine.firstRunState.tryStartPending, "undefined");
}

// ============================================================================
// 5. Focused Diagnostic C, D, E, F: Verse15 到達 〜 Stage1 維持 〜 解決後遷移
// ============================================================================
{
    const engine = GameEngine.createGame({
        runSeed: 20260919,
        firstRun: true
    });

    // Verse 15 到達前
    assert.equal(engine.state.stage.id, 1, "Initial Stage must be 1");
    assert.equal(engine.state.stage.size, 5, "Initial Grid size must be 5");

    // Verse 15 到達時 (仮に Verse 15 に直接進行した場合でも)
    engine.state.turn = 15;
    assert.equal(engine.state.stage.id, 1, "Verse 15 arrival alone must not change Stage");
    assert.equal(engine.state.stage.size, 5, "Grid size must remain 5 on Verse 15 arrival");

    // TrialStageProgressionService の正規経路確認
    const stageProgressionService = new TrialStageProgressionService(engine);

    // Settlement 前: Stage 1 / 5x5 維持
    assert.equal(stageProgressionService.getPending(), null, "No transition before settlement");
    assert.equal(engine.state.stage.id, 1);
    assert.equal(engine.state.stage.size, 5);

    // TRIAL_RESULT_SETTLED 発行 -> Stage 2 pending
    engine.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        outcome: "SURVIVED",
        survived: true
    });

    // Focused Diagnostic E: TRIAL_RESULT_SETTLED後、transitionはpendingだが
    // state.stage.id === 1, size === 5 のままであること
    const pending = stageProgressionService.getPending();
    assert.notEqual(pending, null, "Transition must be pending after settlement");
    assert.equal(pending.fromStageId, 1);
    assert.equal(pending.toStageId, 2);
    assert.equal(engine.state.stage.id, 1, "state.stage.id must remain 1 while pending");
    assert.equal(engine.state.stage.size, 5, "grid size must remain 5 while pending");

    // Focused Diagnostic F: presentation cleanup 後、applyPending() 経由でのみ Stage2 / 7x7 になること
    const applyResult = stageProgressionService.applyPending();
    assert.equal(applyResult.success, true);
    assert.equal(engine.state.stage.id, 2, "Stage must become 2 after applyPending");
    assert.equal(engine.state.stage.size, 7, "Grid size must become 7 after applyPending");
}

// ============================================================================
// 6. Focused Diagnostic G: History Restore
// ============================================================================
{
    const engine = GameEngine.createGame({
        runSeed: 20260919,
        firstRun: true
    });

    engine.firstRunState.recordScene("SCENE_FIRST_LAND");

    // ターン進行してスナップショット採取
    engine.state.ember = 18;
    engine.nextTurn(); // Verse 1 -> 2

    const snapshot = engine.historySnapshotService.getRestorePoint(2);
    assert.notEqual(snapshot, null, "Restore point for Verse 2 must exist");
    assert.notEqual(snapshot.runtime.trialTimingState, undefined, "trialTimingState must be in snapshot runtime");
    assert.notEqual(snapshot.runtime.firstRunState, undefined, "firstRunState must be in snapshot runtime");
    assert.deepEqual(snapshot.runtime.firstRunState.occurredScenes, ["SCENE_FIRST_LAND"]);

    // authority の schedule が snapshot 内に保持されていること
    assert.equal(snapshot.runtime.trialTimingState.schedule.find(e => e.trialIndex === 1)?.verse, 15);

    // 状態を改変
    engine.firstRunState.recordScene("SCENE_VERSE_2");
    assert.equal(engine.firstRunState.hasSceneOccurred("SCENE_VERSE_2"), true);

    // Restore 実行
    const restoreResult = engine.historyRestoreService.restoreVerse(2);
    assert.equal(restoreResult.success, true, "History restore must succeed");

    // snapshot 由来の TrialTimingAuthority state が保持され、再計算されないこと
    assert.equal(engine.trialTimingAuthorityService.getScheduledVerse(1), 15);
    assert.equal(engine.firstRunState.hasSceneOccurred("SCENE_FIRST_LAND"), true);
    assert.equal(engine.firstRunState.hasSceneOccurred("SCENE_VERSE_2"), false, "Future scene must be cleared by restore");
    assert.equal(engine.firstRunState.active, true, "FirstRunState must remain active after restore");
}

console.log("✅ FirstRun Trial1=Verse15 focused diagnostics (A〜G + single ownership): ALL PASSED");
