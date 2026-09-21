import assert from "node:assert/strict";
import { GameEngine } from "../game/src/app.js";
import { RETIRED_TRIAL_RESERVED_CARD_IDS } from "../game/src/systems/card_cycle_system.js";

console.log("Offering eligibility representative active contracts");

const engine = GameEngine.createGame({ runSeed: 0xA0713001 });
const deck = engine.deckManager;
const master = deck.getLandCardMaster();
const getCard = id => {
    const card = master.find(item => item.id === id);
    assert.ok(card, `card master missing: ${id}`);
    return card;
};
const eligible = (card, stage) => deck.isCardEligible(card, stage, 0, {
    ignoreCooldown: true,
    ignoreHold: true
});
const clearGrid = size => Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ({
        r, c, placed: false, isHQ: false, terrain: null, socketResource: null,
        merged: false, mergeGroupId: null
    }))
);

// Reclamation: resource cost + reclaimable non-lake wetland.
{
    const card = getCard("CMD_WETLAND_RECLAMATION");
    engine.state.grid = clearGrid(5);
    engine.state.wood = engine.state.material = 30;
    assert.equal(eligible(card, 1), false);

    Object.assign(engine.state.grid[0][0], {
        placed: true,
        terrain: { id: "E0_WETLAND", terrainId: "E0_WETLAND" },
        socketResource: { id: "SOCKET_LAKE", isLake: true }
    });
    assert.equal(eligible(card, 1), false, "legacy lake wetland is not reclaimable");

    Object.assign(engine.state.grid[0][1], {
        placed: true,
        terrain: { id: "E0_WETLAND", terrainId: "E0_WETLAND" }
    });
    engine.state.wood = engine.state.material = 14;
    assert.equal(eligible(card, 1), false, "material threshold remains enforced");
    engine.state.wood = engine.state.material = 15;
    assert.equal(eligible(card, 1), true);
}

// Granary: simple active plains + material threshold.
{
    const card = getCard("CMD_GRANARY");
    engine.state.grid = clearGrid(5);
    engine.state.wood = engine.state.material = 20;
    for (let i = 0; i < 3; i++) {
        engine.state.grid[0][i] = { placed: true, isHQ: false, terrain: { terrainId: "GL1_PLAINS" } };
    }
    assert.equal(eligible(card, 1), false);
    engine.state.grid[1][0] = { placed: true, isHQ: false, terrain: { terrainId: "GL1_PLAINS" } };
    assert.equal(eligible(card, 1), true);
}

// Revelation: stage and mystic threshold.
{
    const card = getCard("CMD_REVELATION_CHOICE");
    engine.state.mystic = 14;
    assert.equal(eligible(card, 2), false);
    engine.state.mystic = 15;
    assert.equal(eligible(card, 1), false);
    assert.equal(eligible(card, 2), true);
}

// Voice Beneath Earth: distinct discovered resources.
{
    const card = getCard("CMD_VOICE_BENEATH_EARTH");
    engine.state.grid = clearGrid(5);
    engine.state.grid[0][0] = { placed: true, socketResource: { id: "RES_COW" } };
    assert.equal(eligible(card, 1), false);
    engine.state.grid[0][1] = { placed: true, socketResource: { id: "RES_OAK_WOOD" } };
    assert.equal(eligible(card, 1), true);
}

// Transmute: active mystic + unmerged desert/mountain condition.
{
    const card = getCard("CMD_TRANSMUTE_GOLDEN");
    engine.state.grid = clearGrid(5);
    engine.state.mystic = 20;
    assert.equal(eligible(card, 2), false);
    engine.state.grid[0][0] = {
        placed: true,
        isHQ: false,
        merged: false,
        terrain: { terrainId: "GL0_DESERT" }
    };
    assert.equal(eligible(card, 2), true);
}

// Abandoned Settlement: empty-cell threshold without random draw dependence.
{
    const card = getCard("CMD_ABANDONED_SETTLEMENT");
    engine.state.grid = clearGrid(5).map(row => row.map(cell => ({ ...cell, placed: true })));
    assert.equal(eligible(card, 1), false);
    for (let i = 0; i < 8; i++) {
        const r = Math.floor(i / 5);
        const c = i % 5;
        engine.state.grid[r][c].placed = false;
    }
    assert.equal(eligible(card, 1), true);
}

// Retired Trial-prep cards must never silently return to Offering.
for (const cardId of RETIRED_TRIAL_RESERVED_CARD_IDS) {
    const card = master.find(item => item.id === cardId);
    if (!card) continue;
    assert.equal(deck.cycleSystem.isInCooldown(cardId, 999), true, `${cardId} must remain retired`);
}

console.log("Offering eligibility representative active contracts: PASS");
