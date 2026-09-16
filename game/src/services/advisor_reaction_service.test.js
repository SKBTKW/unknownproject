import assert from "node:assert/strict";
import test from "node:test";

import { GAME_FACT_TYPES, GameFactHub } from "../core/game_fact.js";
import { STAFF_OFFICER_REACTIONS } from "../data/advisor_staff_officer_reactions.js";
import { ADVISOR_SCENES } from "../data/advisor_scene_catalog.js";
import { AdvisorReactionService } from "./advisor_reaction_service.js";

function createService() {
    const gameFactHub = new GameFactHub();
    const service = new AdvisorReactionService({
        gameFactHub,
        character: STAFF_OFFICER_REACTIONS
    });
    const received = [];
    service.subscribe(reaction => received.push(reaction));
    return { gameFactHub, service, received };
}

test("confirmed Trial plan resolves to the staff officer reaction without DOM", () => {
    const { gameFactHub, service, received } = createService();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
        routes: [{ routeId: "route-a", status: "INTERCEPT", defenseAllocation: 3 }],
        totalDefenseAllocated: 3
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].characterId, "STAFF_OFFICER");
    assert.equal(received[0].scene, ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED);
    assert.equal(received[0].expression, "NORMAL");
    assert.equal(received[0].line, "承知しました。配置を確定します。");
    assert.equal(received[0].payload.totalDefenseAllocated, 3);

    service.dispose();
});

test("survived Trial with zero Ember damage resolves to undamaged scene", () => {
    const { gameFactHub, service, received } = createService();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        scenarioId: "trial-1",
        outcome: "SURVIVED",
        result: { emberRemaining: 10, totalEmberDamage: 0, routeEndCount: 0 },
        settlement: { runTerminated: false }
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].scene, ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED);
    assert.equal(received[0].expression, "SATISFIED");
    assert.equal(received[0].line, "残火への損害はありません。……よい備えでした。");
    service.dispose();
});

test("survived Trial with Ember damage resolves to damaged scene", () => {
    const { gameFactHub, service, received } = createService();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        scenarioId: "trial-1",
        outcome: "SURVIVED",
        result: { emberRemaining: 7, totalEmberDamage: 3, routeEndCount: 1 },
        settlement: { runTerminated: false }
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].scene, ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED);
    assert.equal(received[0].expression, "CONCERNED");
    assert.equal(received[0].line, "敵は退きました。……損害の確認を始めます。");
    service.dispose();
});

test("failed Trial resolves to game over regardless of damage details", () => {
    const { gameFactHub, service, received } = createService();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        scenarioId: "trial-1",
        outcome: "FAILED",
        result: { emberRemaining: 0, totalEmberDamage: 10, routeEndCount: 2 },
        settlement: { runTerminated: true }
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].scene, ADVISOR_SCENES.GAME_OVER);
    assert.equal(received[0].line, "……最後まで、確認します。");
    service.dispose();
});

test("legacy survived result without damage data falls back to generic completion", () => {
    const { gameFactHub, service, received } = createService();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        outcome: "SURVIVED",
        settlement: { runTerminated: false }
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].scene, ADVISOR_SCENES.TRIAL_COMPLETED);
    service.dispose();
});

test("facts without an advisor scene stay silent", () => {
    const { gameFactHub, service, received } = createService();
    gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { verse: 2 });
    assert.equal(received.length, 0);
    service.dispose();
});

test("missing character reaction means intentional silence", () => {
    const gameFactHub = new GameFactHub();
    const silentCharacter = Object.freeze({ id: "SILENT", reactions: Object.freeze({}) });
    const service = new AdvisorReactionService({ gameFactHub, character: silentCharacter });
    const received = [];
    service.subscribe(reaction => received.push(reaction));

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
        routes: [],
        totalDefenseAllocated: 0
    });

    assert.equal(received.length, 0);
    service.dispose();
});

test("dispose disconnects the service from the shared fact hub", () => {
    const { gameFactHub, service, received } = createService();
    service.dispose();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
        routes: [],
        totalDefenseAllocated: 0
    });

    assert.equal(received.length, 0);
});
