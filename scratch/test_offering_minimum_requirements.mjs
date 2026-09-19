import assert from "assert/strict";
import { DeckManager, OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";

function makeCard(id, category) {
    return {
        id,
        category,
        minStage: 1,
        weight: 1,
        shape: [[1]],
        terrainId: id
    };
}

function makeHarness({ eligible = () => true } = {}) {
    const cards = [
        makeCard("INV_A", "INVESTIGATION"),
        makeCard("INV_B", "INVESTIGATION"),
        makeCard("INV_C", "INVESTIGATION"),
        makeCard("LAND_BLOCKED", "LAND"),
        makeCard("LAND_OK", "LAND")
    ];

    const state = {
        turn: 1,
        stage: { id: 1 },
        handOfferingSize: 3,
        handOffering: [],
        offeringCards: [],
        reserveSlots: [null],
        grid: [[{}]],
        canPlaceShape(startR, startC, shape, terrain) {
            return { can: terrain?.id === "LAND_OK" };
        }
    };

    const seenReasons = [];
    const engine = {
        gameplayRandom: { nextFloat: () => 0 },
        offeringMinimumRequirementProvider({ reason }) {
            seenReasons.push(reason);
            if (reason !== OFFERING_GENERATION_REASONS.INITIAL) return [];
            return [{
                id: "FIRST_RUN_PLAYABLE_LAND",
                category: "LAND",
                minCount: 1,
                requirePlaceable: true
            }];
        }
    };

    const manager = new DeckManager(state, engine);
    manager.getLandCardMaster = () => cards;
    manager.isCardEligible = card => eligible(card);
    manager._wrapCardInstance = card => ({
        cardMasterId: card.id,
        terrain: card
    });
    manager.cycleSystem = {
        isInCooldown: () => false,
        findMinAvailableTurnCard: () => null,
        registerOffering: () => {}
    };

    return { manager, state, seenReasons };
}

{
    const { manager, state, seenReasons } = makeHarness();
    const offering = manager.generateOfferingCards({ reason: OFFERING_GENERATION_REASONS.INITIAL });
    const ids = offering.map(card => card.cardMasterId);

    assert.equal(offering.length, 3);
    assert.equal(ids.includes("LAND_OK"), true, "INITIAL offering must contain a currently placeable LAND");
    assert.equal(ids.includes("LAND_BLOCKED"), false, "non-placeable LAND must not satisfy the guarantee");
    assert.deepEqual(seenReasons, [OFFERING_GENERATION_REASONS.INITIAL]);
    assert.equal(manager.lastOfferingGeneration.reason, OFFERING_GENERATION_REASONS.INITIAL);
    assert.equal(manager.lastOfferingGeneration.appliedMinimums.length, 1);
    assert.equal(state.handOffering, state.offeringCards);
}

{
    const { manager } = makeHarness({
        eligible: card => card.id !== "LAND_OK"
    });
    const offering = manager.generateOfferingCards({ reason: OFFERING_GENERATION_REASONS.INITIAL });
    const ids = offering.map(card => card.cardMasterId);

    assert.equal(ids.includes("LAND_OK"), false, "minimum guarantee must not bypass normal eligibility");
    assert.equal(manager.lastOfferingGeneration.appliedMinimums.length, 0);
}

{
    const { manager, seenReasons } = makeHarness();
    const offering = manager.generateOfferingCards({ reason: OFFERING_GENERATION_REASONS.MULLIGAN });
    assert.equal(offering.some(card => card.cardMasterId === "LAND_OK"), false, "MULLIGAN must not inherit INITIAL-only guarantee");
    assert.deepEqual(seenReasons, [OFFERING_GENERATION_REASONS.MULLIGAN]);
}

console.log("✅ Offering minimum-requirement contract: reason routing + playable LAND + eligibility gate PASS");
