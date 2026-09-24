import assert from "assert/strict";
import { DeckManager, OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";

function makeCard(id, category, offeringCategory = null) {
    return {
        id,
        category,
        ...(offeringCategory ? { offeringCategory } : {}),
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
    assert.equal(manager._isCardPlaceableNow(makeCard("LAND_OK", "LAND")), true, "test harness must expose a placeable LAND");
    assert.equal(manager._isCardPlaceableNow(makeCard("LAND_BLOCKED", "LAND")), false, "test harness must expose a blocked LAND");
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


function makeMultiplicityHarness(cards, {
    minimumRequirements = [],
    maxPerCategory = null
} = {}) {
    const state = {
        turn: 1,
        stage: { id: 1 },
        handOfferingSize: 3,
        handOffering: [],
        offeringCards: [],
        reserveSlots: [],
        grid: [[{}]],
        canPlaceShape: () => ({ can: true })
    };
    const engine = {
        gameplayRandom: { nextFloat: () => 0 },
        offeringMinimumRequirementProvider: () => minimumRequirements
    };
    if (maxPerCategory != null) {
        engine.offeringCategoryMultiplicityPolicyProvider = () => ({ maxPerCategory });
    }

    const manager = new DeckManager(state, engine);
    manager.getLandCardMaster = () => cards;
    manager.isCardEligible = () => true;
    manager._wrapCardInstance = card => ({
        cardMasterId: card.id,
        terrain: card
    });
    manager.cycleSystem = {
        isInCooldown: () => false,
        findMinAvailableTurnCard: candidates => candidates[0] || null,
        registerOffering: () => {}
    };
    return manager;
}

// Normal Offering: same category may appear twice, but a third slot must use another category.
{
    const manager = makeMultiplicityHarness([
        makeCard("LAND_A", "LAND"),
        makeCard("LAND_B", "LAND"),
        makeCard("LAND_C", "LAND"),
        makeCard("CMD_A", "COMMAND")
    ]);
    const offering = manager.generateOfferingCards();
    const categories = offering.map(card => card.terrain.category);
    assert.deepEqual(categories, ["LAND", "LAND", "COMMAND"]);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.maxPerCategory, 2);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.relaxedForFallback, false);
    assert.deepEqual(manager.lastOfferingGeneration.categoryMultiplicity.overflow, []);
}

// Forced minimums are authoritative and may intentionally create three cards of one category.
{
    const manager = makeMultiplicityHarness([
        makeCard("LAND_A", "LAND"),
        makeCard("LAND_B", "LAND"),
        makeCard("CMD_A", "COMMAND"),
        makeCard("INV_A", "INVESTIGATION"),
        makeCard("INV_B", "INVESTIGATION"),
        makeCard("INV_C", "INVESTIGATION")
    ], {
        minimumRequirements: [{
            id: "FORCED_INVESTIGATION",
            category: "INVESTIGATION",
            minCount: 3
        }]
    });
    const offering = manager.generateOfferingCards();
    assert.deepEqual(
        offering.map(card => card.terrain.category),
        ["INVESTIGATION", "INVESTIGATION", "INVESTIGATION"]
    );
    assert.equal(manager.lastOfferingGeneration.appliedMinimums.length, 3);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.minimumRequirementOverride, true);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.overflow[0].category, "INVESTIGATION");
}


{
    const manager = makeMultiplicityHarness([
        makeCard("CMD_A", "COMMAND", "TEST_BUCKET_A"),
        makeCard("CMD_B", "COMMAND", "TEST_BUCKET_A"),
        makeCard("CMD_C", "COMMAND", "TEST_BUCKET_A"),
        makeCard("CMD_D", "COMMAND", "TEST_BUCKET_B")
    ]);
    const offering = manager.generateOfferingCards();
    assert.deepEqual(
        offering.map(card => card.terrain.offeringCategory),
        ["TEST_BUCKET_A", "TEST_BUCKET_A", "TEST_BUCKET_B"],
        "multiplicity uses Offering category without changing gameplay category"
    );
    assert.ok(offering.every(card => card.terrain.category === "COMMAND"));
}

// Future Directive / GE policy may explicitly allow three cards of the same category.
{
    const manager = makeMultiplicityHarness([
        makeCard("LAND_A", "LAND"),
        makeCard("LAND_B", "LAND"),
        makeCard("LAND_C", "LAND"),
        makeCard("CMD_A", "COMMAND")
    ], { maxPerCategory: 3 });
    const offering = manager.generateOfferingCards();
    assert.deepEqual(offering.map(card => card.terrain.category), ["LAND", "LAND", "LAND"]);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.maxPerCategory, 3);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.source, "PROVIDER");
    assert.deepEqual(manager.lastOfferingGeneration.categoryMultiplicity.overflow, []);
}

// If no second category exists at all, the final fallback may relax the cap to preserve three-card Offering availability.
{
    const manager = makeMultiplicityHarness([
        makeCard("LAND_A", "LAND"),
        makeCard("LAND_B", "LAND"),
        makeCard("LAND_C", "LAND")
    ]);
    const offering = manager.generateOfferingCards();
    assert.equal(offering.length, 3);
    assert.deepEqual(offering.map(card => card.terrain.category), ["LAND", "LAND", "LAND"]);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.relaxedForFallback, true);
    assert.equal(manager.lastOfferingGeneration.categoryMultiplicity.overflow[0].category, "LAND");
}

console.log("✅ Offering minimum-requirement + category multiplicity contracts PASS");
