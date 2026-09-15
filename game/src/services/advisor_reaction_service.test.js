import assert from "node:assert/strict";
import test from "node:test";

import { GAME_FACT_TYPES, GameFactHub } from "../core/game_fact.js";
import { STAFF_OFFICER_REACTIONS } from "../data/advisor_staff_officer_reactions.js";
import { ADVISOR_SCENES } from "../data/advisor_scene_catalog.js";
import { AdvisorReactionService } from "./advisor_reaction_service.js";

test("confirmed Trial plan resolves to the staff officer reaction without DOM", () => {
    const gameFactHub = new GameFactHub();
    const service = new AdvisorReactionService({
        gameFactHub,
        character: STAFF_OFFICER_REACTIONS
    });
    const received = [];
    service.subscribe(reaction => received.push(reaction));

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

test("facts without an advisor scene stay silent", () => {
    const gameFactHub = new GameFactHub();
    const service = new AdvisorReactionService({
        gameFactHub,
        character: STAFF_OFFICER_REACTIONS
    });
    const received = [];
    service.subscribe(reaction => received.push(reaction));

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
    const gameFactHub = new GameFactHub();
    const service = new AdvisorReactionService({
        gameFactHub,
        character: STAFF_OFFICER_REACTIONS
    });
    const received = [];
    service.subscribe(reaction => received.push(reaction));
    service.dispose();

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
        routes: [],
        totalDefenseAllocated: 0
    });

    assert.equal(received.length, 0);
});
