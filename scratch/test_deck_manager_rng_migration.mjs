import assert from "node:assert/strict";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { CheckSystem } from "../game/src/core/check_system/check_system.js";
import { GameplayRandomService } from "../game/src/core/gameplay_random_service.js";

let passed = 0;
function check(name, test) {
    test();
    passed++;
    console.log(`  PASS: ${name}`);
}
function fixture(roll = null) {
    const cell = { placed: true, isHQ: false, searched: false, socketResource: { id: "KNOWN" } };
    const state = {
        turn: 3, grid: [[cell]], food: 0, wood: 0, mystic: 0, ember: 20,
        handOffering: [], reserveSlots: [], addLog() {}, addBuff() {}, toastQueue: []
    };
    const checks = [];
    const checkSystem = roll === null ? new CheckSystem({ seed: 6789 }) : {
        resolveDefinition(params) { checks.push(params); return { finalTotal: roll }; },
        resolve(params) { checks.push(params); return { finalTotal: roll }; }
    };
    const engine = { gameplayRandom: new GameplayRandomService(6789), checkSystem };
    return { cell, state, engine, checks, deck: new DeckManager(state, engine) };
}

check("canonical Offering and card IDs consume only GameplayRandom", () => {
    const a = fixture(), b = fixture();
    const card = { id: "LAND_TEST", shape: [[1]], weight: 1, category: "LAND" };
    for (const f of [a, b]) {
        f.deck.getLandCardMaster = () => [card];
        f.deck.isCardEligible = () => true;
    }
    assert.deepEqual(a.deck.drawSingleCard(), b.deck.drawSingleCard());
    assert.deepEqual(a.engine.gameplayRandom.getState(), b.engine.gameplayRandom.getState());
    assert.deepEqual(a.engine.checkSystem.getState(), b.engine.checkSystem.getState());
});

check("CheckSystem unavailable leaves the cell unsearched", () => {
    const f = fixture();
    f.engine.checkSystem = null;
    assert.deepEqual(f.deck.executeExploration(0, 0), { success: false, reason: "CHECK_SYSTEM_UNAVAILABLE" });
    assert.equal(f.cell.searched, false);
});

for (const [roll, food, wood, outcome] of [
    [2, 1, 0, "low"], [4, 1, 0, "low"], [5, 2, 0, "medium"],
    [7, 2, 0, "medium"], [8, 3, 3, "discovery"], [12, 3, 3, "discovery"]
]) {
    check(`exploration ${roll} retains the ${outcome} reward band`, () => {
        const f = fixture(roll);
        assert.equal(f.deck.executeExploration(0, 0).success, true);
        assert.equal(f.cell.searched, true);
        assert.equal(f.state.food, food);
        assert.equal(f.state.wood, wood);
        assert.deepEqual(f.checks[0].definition.outcomes, [
            { max: 4, id: "low" }, { min: 5, max: 7, id: "medium" }, { min: 8, id: "discovery" }
        ]);
        assert.equal(f.checks[0].definition.dice.count, 2);
        assert.equal(f.checks[0].actionId, "land_exploration_3_0_0");
    });
}

check("exploration restores the exact next roll and unchanged known socket", () => {
    const f = fixture();
    const checkSnapshot = f.engine.checkSystem.getState();
    const gameplaySnapshot = f.engine.gameplayRandom.getState();
    const first = f.deck.executeExploration(0, 0);
    const firstRewards = [f.state.food, f.state.wood];
    const knownSocket = f.cell.socketResource;
    f.cell.searched = false;
    f.state.food = 0; f.state.wood = 0;
    f.engine.checkSystem.setState(checkSnapshot);
    f.engine.gameplayRandom.setState(gameplaySnapshot);
    assert.deepEqual(f.deck.executeExploration(0, 0), first);
    assert.deepEqual([f.state.food, f.state.wood], firstRewards);
    assert.equal(f.cell.socketResource, knownSocket);
});

check("discovery water chance and weighted socket draws use GameplayRandom", () => {
    const previous = globalThis.LAND_SYSTEM_DATA;
    globalThis.LAND_SYSTEM_DATA = { sockets: { GL1_PLAINS: [
        { id: "SOCKET_LAKE", isSpecialWater: true, weight: 1, bonusYields: {} },
        { id: "SOCKET_GRAIN", weight: 1, bonusYields: { food: 2 } },
        { id: "SOCKET_STONE", weight: 2, bonusYields: { material: 3 } }
    ] } };
    try {
        const f = fixture(8);
        f.cell.socketResource = null;
        f.cell.terrain = { terrainId: "GL1_PLAINS" };
        const draws = [0.9, 0.8];
        f.engine.gameplayRandom.nextFloat = () => draws.shift();
        assert.equal(f.deck.executeExploration(0, 0).success, true);
        assert.equal(f.cell.socketResource.id, "SOCKET_STONE");
        assert.equal(draws.length, 0);
    } finally {
        globalThis.LAND_SYSTEM_DATA = previous;
    }
});

check("land exploration target selection uses GameplayRandom.nextInt", () => {
    const f = fixture(8);
    f.state.grid = Array.from({ length: 5 }, () => Array(5).fill(null));
    f.state.grid[0][0] = f.cell;
    f.state.grid[0][1] = { placed: true, isHQ: false, searched: false, merged: false };
    let chosen;
    f.engine.gameplayRandom.nextInt = (min, max) => {
        assert.deepEqual([min, max], [0, 1]);
        return 1;
    };
    f.deck.executeExploration = (r, c) => { chosen = [r, c]; return { success: true }; };
    assert.equal(f.deck.playCommandCard({ id: "CMD_LAND_EXPLORATION" }).success, true);
    assert.deepEqual(chosen, [0, 1]);
});

check("CheckSystem rolls never shift GameplayRandom", () => {
    const a = fixture(), b = fixture();
    for (let i = 0; i < 4; i++) a.engine.checkSystem.resolve({ checkId: "standard_2d6" });
    assert.equal(a.engine.gameplayRandom.nextFloat(), b.engine.gameplayRandom.nextFloat());
});

check("GameplayRandom draws and IDs never shift CheckSystem", () => {
    const a = fixture(), b = fixture();
    for (let i = 0; i < 4; i++) { a.engine.gameplayRandom.nextFloat(); a.engine.gameplayRandom.nextId("card", 3); }
    assert.deepEqual(a.engine.checkSystem.resolve({ checkId: "standard_2d6" }),
        b.engine.checkSystem.resolve({ checkId: "standard_2d6" }));
});

check("mixed sequence resumes both streams exactly", () => {
    const f = fixture();
    const dice = f.engine.checkSystem.getState(), world = f.engine.gameplayRandom.getState();
    const sequence = () => [
        f.engine.gameplayRandom.nextFloat(),
        f.engine.gameplayRandom.nextId("card", 3),
        f.engine.checkSystem.resolveDefinition({ definition: {
            id: "land_exploration", dice: { count: 2, sides: 6, keep: "all" },
            resolution: { type: "sum" }, outcomes: [{ id: "any" }]
        } }),
        f.engine.gameplayRandom.nextFloat(),
        f.engine.checkSystem.resolve({ checkId: "standard_2d6" })
    ];
    const expected = sequence();
    f.engine.checkSystem.setState(dice); f.engine.gameplayRandom.setState(world);
    assert.deepEqual(sequence(), expected);
});

check("abandoned settlement source slot IDs are deterministic metadata", () => {
    const a = fixture(8), b = fixture(8);
    const card = { id: "CMD_ABANDONED_SETTLEMENT", nameKey: "CMD_ABANDONED_SETTLEMENT_NAME" };
    for (const f of [a, b]) f.state.handOffering = [card];
    const resultA = a.deck.playCommandCard(card, null, 0);
    const resultB = b.deck.playCommandCard(card, null, 0);
    assert.equal(resultA.success, true);
    assert.equal(resultB.success, true);
    assert.equal(a.checks[0].actionId, "abandoned_settlement_3_hand_0");
    assert.deepEqual(a.checks, b.checks);
    assert.deepEqual(a.engine.gameplayRandom.getState(), b.engine.gameplayRandom.getState());
});

check("blank IDs use the deterministic gameplay sequence", () => {
    const f = fixture(8);
    const card = { id: "CMD_ABANDONED_SETTLEMENT", nameKey: "CMD_ABANDONED_SETTLEMENT_NAME" };
    f.state.handOffering = [card];
    assert.equal(f.deck.playCommandCard(card, null, 0).success, true);
    assert.equal(f.state.handOffering[0].id, "blank_3_0_1");
});

console.log(`DeckManager RNG migration: ${passed}/${passed} PASS`);
