import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TrialStageProgressionService } from "../systems/trial_stage_progression_service.js";

function createHarness({ stageId = 1 } = {}) {
    const gameFactHub = new GameFactHub();
    const expandCalls = [];
    const logs = [];
    const state = {
        stage: stageId === 1
            ? { id: 1, name: "Stage 1", size: 5, maxTiles: 24 }
            : { id: 2, name: "Stage 2", size: 7, maxTiles: 48 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: stageId === 1 ? 15 : 30,
        addLog(message) {
            logs.push(message);
        }
    };
    const engine = {
        state,
        gameFactHub,
        gridEngine: {
            expandGrid(size) {
                expandCalls.push(size);
                return Array.from({ length: size }, () => Array(size).fill(null));
            }
        }
    };
    const service = new TrialStageProgressionService(engine, { gameFactHub });
    return { engine, gameFactHub, service, expandCalls, logs };
}

{
    const h = createHarness();

    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        settlement: { runTerminated: false }
    });

    assert.deepEqual(h.service.getPending(), {
        trialIndex: 1,
        fromStageId: 1,
        toStageId: 2,
        size: 7,
        maxTiles: 48,
        nextTrialIndex: 2
    });
    assert.equal(h.engine.state.stage.id, 1, "settlement must not resize or advance Stage immediately");
    assert.deepEqual(h.expandCalls, [], "physical expansion must wait for explicit post-cleanup apply");

    const applied = h.service.applyPending();
    assert.equal(applied.success, true);
    assert.equal(h.engine.state.stage.id, 2);
    assert.equal(h.engine.state.stage.size, 7);
    assert.equal(h.engine.state.nextTrialTurn, 30, "legacy timing mirror must advance after Trial 1 settlement");
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(h.service.getPending(), null);

    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        settlement: { runTerminated: false }
    });
    assert.equal(h.service.getPending(), null, "duplicate settlement must not schedule Stage progression twice");

    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 2,
        settlement: { runTerminated: false }
    });
    assert.equal(h.service.getPending()?.toStageId, 3);
    const stage3 = h.service.applyPending();
    assert.equal(stage3.success, true);
    assert.equal(h.engine.state.stage.id, 3);
    assert.equal(h.engine.state.stage.size, 9);
    assert.equal(h.engine.state.nextTrialTurn, 50);
    assert.deepEqual(h.expandCalls, [7, 9]);

    h.service.dispose();
}

{
    const h = createHarness();
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        settlement: { runTerminated: true }
    });
    assert.equal(h.service.getPending(), null, "terminated runs must not progress to the next Stage");
    assert.deepEqual(h.expandCalls, []);
    h.service.dispose();
}

console.log("diagnose_trial_stage_progression_service: OK");
