import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { SpecialBlockService } from "../game/src/systems/special_block_service.js";
import {
    getSpecialBlockDefinition,
    readSpecialBlockAdjacencyProfile,
    excludesCellFromZones,
    BOARD_CAPABILITIES,
    SPECIAL_BLOCK_TYPES
} from "../game/src/core/special_block_domain.js";
import { sumSpecialBlockProduction } from "../game/src/core/special_block_production.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy, isCardRuntimeActive } from "../game/src/systems/card_runtime_policy.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { MILITARY_CARDS_MASTER, COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { serializeGameState } from "../game/src/core/state_serializer_base.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state_base.js";
import { GameplayRandomService } from "../game/src/core/gameplay_random_service.js";
import { DeploymentOriginResolver } from "../game/src/trial/domain/deployment_origin_resolver.js";
import { UIController } from "../game/src/ui/ui_controller.js";
import { I18n } from "../game/src/i18n.js";

console.log("\n🧪 Running Stage 2 Barracks (兵舎) Comprehensive Test Suite...");

const card = COMMAND_CARDS_MASTER.find(c => c.id === "CMD_BARRACKS");
const militaryCard = MILITARY_CARDS_MASTER.find(c => c.id === "CMD_BARRACKS");
const sourceCard = JSON.parse(
    readFileSync(new URL("../game/src/data/military_cards.json", import.meta.url), "utf8")
).find(c => c.id === "CMD_BARRACKS");
const definition = getSpecialBlockDefinition("BARRACKS");

function setup(size = 7, stageId = 2) {
    const center = Math.floor(size / 2); // (3, 3) for 7x7
    const state = {
        turn: 10,
        stage: { id: stageId },
        food: 200,
        wood: 200,
        material: 200,
        defense: 10,
        currentDefense: 10,
        mystic: 0,
        ember: 20,
        maxEmber: 20,
        warningState: "CALM",
        mergedBlocks: {},
        handOffering: [card],
        handOfferingSize: 3,
        reserveSlots: [null],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        cardStageUsage: {},
        cardCooldowns: {},
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        logs: [],
        addLog(text) { this.logs.push(text); },
        addBuff(b) { this.activeBuffs.push(b); },
        grid: Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ({
            r, c, placed: false, terrain: null, specialBlock: null, isHQ: false, socketResource: null,
            placementGroupId: null, mergeGroupId: null, merged: false, mergeType: null, searched: false, hasSocket: false
        })))
    };

    state.isHQVicinity = (r, c) => !(r === center && c === center) && Math.abs(r - center) <= 1 && Math.abs(c - center) <= 1;
    Object.assign(state.grid[center][center], {
        isHQ: true,
        placed: true,
        terrain: { id: "HQ", e: 1, gl: 1, defense: 5 }
    });

    const board = new BoardDomainAdapter({ state });
    const engine = { state, boardDomainAdapter: board, gameplayRandom: new GameplayRandomService(101) };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    deck.cycleSystem = null;
    attachCardRuntimePolicy(deck);

    return { state, board, engine, deck, service: new SpecialBlockService(state) };
}

let testCount = 0;
function test(name, fn) {
    fn();
    testCount++;
    console.log(`  ✅ [${testCount}] ${name}`);
}

// -------------------------------------------------------------
// 1. Data parity, Stage gating, and Cost Quote
// -------------------------------------------------------------
test("data parity, Stage 2 UC definitions, and domain cost quote", () => {
    assert.ok(card, "CMD_BARRACKS must exist in COMMAND_CARDS_MASTER");
    assert.deepEqual(card, sourceCard, "command cards master must match military_cards.json SSOT");
    assert.deepEqual(militaryCard, sourceCard, "military cards master must match military_cards.json SSOT");
    assert.equal(card.minStage, 2, "Barracks must be Stage 2+");
    assert.equal(card.rarity, "UC", "Barracks rarity must be UC");
    assert.equal(card.weight, 0.25, "Barracks provisional weight must be 0.25");
    assert.deepEqual(card.cost, {}, "Card cost must be empty; cost authority is Domain");
    assert.equal(card.maxUsesPerStage, 1, "Max 1 build per Stage");
    assert.equal(isCardRuntimeActive(card), true, "CMD_BARRACKS must be runtime active");

    assert.ok(definition, "SpecialBlock definition for BARRACKS must exist");
    assert.equal(definition.category, "MILITARY");
    assert.equal(definition.placement.shape, "1x2");
    assert.equal(definition.placement.maxCreationsPerStage, 1);
    assert.equal(definition.creationCost.status, "RESOLVED");
    assert.deepEqual(definition.creationCost.resources, { food: 80, wood: 80 });
    assert.equal(definition.production, null, "Barracks has 0 fixed production");

    const { board } = setup();
    const quote = board.quoteSpecialBlockCost("BARRACKS");
    assert.equal(quote.status, "RESOLVED");
    assert.deepEqual(quote.resources, { food: 80, wood: 80 });
});

// -------------------------------------------------------------
// 2. Stage Eligibility Gate
// -------------------------------------------------------------
test("Offering stage gating: Stage 1 ineligible, Stage 2 eligible when valid target exists", () => {
    const { state, deck } = setup(7, 1); // Stage 1
    // Place legal origin terrain on board
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    assert.equal(deck.isCardEligible(card, 1), false, "Stage 1 must forbid Barracks");

    // Advance state to Stage 2
    state.stage.id = 2;
    assert.equal(deck.isCardEligible(card, 2), true, "Stage 2 with legal placement and resources must be eligible");

    // If food or wood is below 80, must fail closed
    state.food = 79;
    assert.equal(deck.isCardEligible(card, 2), false, "Food < 80 must fail closed");
    state.food = 200;
    state.wood = state.material = 79;
    assert.equal(deck.isCardEligible(card, 2), false, "Wood < 80 must fail closed");
});

// -------------------------------------------------------------
// 3. Placement Legality & HQ Vicinity Exclusion
// -------------------------------------------------------------
test("1x2 orthogonal placement legality and strict HQ vicinity exclusion", () => {
    const { state, service } = setup(7, 2); // 7x7 grid, HQ at (3, 3), HQ vicinity: [2..4, 2..4] except (3, 3)

    // Setup source Base Terrain at (4, 0)
    // From (4, 0), direction UP: cell 1 = (3, 0), cell 2 = (2, 0).
    // Both (3, 0) and (2, 0) have c=0, so both are strictly outside HQ vicinity (c >= 2)!
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const legalTarget = {
        source: { r: 4, c: 0 },
        direction: "UP"
    };
    const vLegal = service.validateTarget("BARRACKS", legalTarget);
    assert.equal(vLegal.valid, true, "Orthogonal 1x2 into empty outside-vicinity cells must pass");
    assert.deepEqual(vLegal.footprint, [{ r: 3, c: 0 }, { r: 2, c: 0 }]);
    assert.equal(vLegal.direction, "UP");

    // Diagonal direction: FAIL
    const vDiag = service.validateTarget("BARRACKS", {
        source: { r: 4, c: 0 },
        destination: { r: 3, c: 1 } // diagonal
    });
    assert.equal(vDiag.valid, false);
    assert.equal(vDiag.reason, "ORTHOGONAL_DIRECTION_REQUIRED");

    // 2nd cell out of bounds: FAIL
    // From (4, 0), direction LEFT: cell 1 = (4, -1) -> OUT_OF_BOUNDS
    const vOob = service.validateTarget("BARRACKS", {
        source: { r: 4, c: 0 },
        direction: "LEFT"
    });
    assert.equal(vOob.valid, false);
    assert.equal(vOob.reason, "OUT_OF_BOUNDS");

    // Only 1 cell empty (2nd cell out of bounds):
    // From (1, 0), direction UP: cell 1 = (0, 0), cell 2 = (-1, 0) -> OUT_OF_BOUNDS
    Object.assign(state.grid[1][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });
    const vOneEmpty = service.validateTarget("BARRACKS", {
        source: { r: 1, c: 0 },
        direction: "UP"
    });
    assert.equal(vOneEmpty.valid, false);
    assert.equal(vOneEmpty.reason, "OUT_OF_BOUNDS");

    // Destination occupied (cell 1 or cell 2 placed): FAIL
    state.grid[2][0].placed = true;
    const vOccupied = service.validateTarget("BARRACKS", legalTarget);
    assert.equal(vOccupied.valid, false);
    assert.equal(vOccupied.reason, "DESTINATION_OCCUPIED");
    state.grid[2][0].placed = false;

    // Destination occupied by existing Special Block: FAIL
    state.grid[2][0].specialBlock = { type: "FARM" };
    const vSpecialOccupied = service.validateTarget("BARRACKS", legalTarget);
    assert.equal(vSpecialOccupied.valid, false);
    assert.equal(vSpecialOccupied.reason, "DESTINATION_OCCUPIED");
    state.grid[2][0].specialBlock = null;

    // HQ vicinity intrusion:
    // From (3, 0), direction RIGHT: cell 1 = (3, 1), cell 2 = (3, 2).
    // (3, 2) is in HQ vicinity (HQ is at (3, 3))!
    Object.assign(state.grid[3][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });
    const vVicinity = service.validateTarget("BARRACKS", {
        source: { r: 3, c: 0 },
        direction: "RIGHT"
    });
    assert.equal(vVicinity.valid, false);
    assert.equal(vVicinity.reason, "DESTINATION_REGION_NOT_ALLOWED");

    // Origin near HQ, but footprint entirely outside vicinity: PASS
    // Source at (2, 1) (which is in HQ vicinity of (3, 3) because |2-3|<=1 && |1-3|=2 > 1 wait, (2, 1) has c=1 so not in vicinity; let's take (2, 2) which is in vicinity):
    // From (2, 2), direction UP: cell 1 = (1, 2), cell 2 = (0, 2).
    // (1, 2) and (0, 2) both have r <= 1, so both are strictly outside HQ vicinity!
    Object.assign(state.grid[2][2], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });
    const vNearHQOrigin = service.validateTarget("BARRACKS", {
        source: { r: 2, c: 2 },
        direction: "UP"
    });
    assert.equal(vNearHQOrigin.valid, true, "Origin near HQ is allowed if 2 footprint cells are both outside vicinity");
    assert.deepEqual(vNearHQOrigin.footprint, [{ r: 1, c: 2 }, { r: 0, c: 2 }]);
});

// -------------------------------------------------------------
// 4. E / GL Inheritance
// -------------------------------------------------------------
test("E is inherited from construction origin; GL is strictly 1", () => {
    const { state, service } = setup(7, 2);

    // Origin with E=2
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "E2_FOREST_HILL", e: 2, gl: 2 }
    });

    const targetE2 = { source: { r: 4, c: 0 }, direction: "UP" };
    const paid = { paymentConfirmed: true, paidCost: { food: 80, wood: 80 } };
    const createResult = service.createSpecialBlock("BARRACKS", targetE2, paid);
    assert.equal(createResult.success, true);

    const cell1 = state.grid[3][0];
    const cell2 = state.grid[2][0];
    assert.equal(readSpecialBlockAdjacencyProfile(cell1).e, 2, "Cell 1 inherits origin E2");
    assert.equal(readSpecialBlockAdjacencyProfile(cell2).e, 2, "Cell 2 inherits origin E2");
    assert.equal(readSpecialBlockAdjacencyProfile(cell1).gl, 1, "Cell 1 has GL1 fixed");
    assert.equal(readSpecialBlockAdjacencyProfile(cell2).gl, 1, "Cell 2 has GL1 fixed");
});

// -------------------------------------------------------------
// 5. Cost Transaction & Atomic Payment
// -------------------------------------------------------------
test("atomic payment of 80 food and 80 wood; fail-closed on shortfall", () => {
    const { state, deck } = setup(7, 2);
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const targets = deck.enumerateCardExecutionTargets(card);
    assert.ok(targets.length > 0, "Legal targets must be enumerated");
    const chosen = targets.find(t => t.source?.r === 4 && t.source?.c === 0 && t.direction === "UP");
    assert.ok(chosen, "UP target must be present");

    assert.equal(state.food, 200);
    assert.equal(state.wood, 200);

    const playResult = deck.playCommandCard(card, chosen, 0, -1);
    assert.equal(playResult.success, true);
    assert.equal(state.food, 120, "200 - 80 = 120 food");
    assert.equal(state.wood, 120, "200 - 80 = 120 wood");
    assert.equal(state.material, 120, "material synchronized to wood");

    const b1 = state.grid[3][0];
    const b2 = state.grid[2][0];
    assert.ok(b1.specialBlock);
    assert.ok(b2.specialBlock);
    assert.equal(b1.placed, false, "Special-only cells do not become placed Base Terrain");
    assert.equal(b2.placed, false);
});

// -------------------------------------------------------------
// 6. Stage Creation Limit (1 per Stage)
// -------------------------------------------------------------
test("each Stage allows 1 new Barracks; subsequent builds in same Stage fail", () => {
    const { state, service } = setup(7, 2);
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });
    Object.assign(state.grid[4][6], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const target1 = { source: { r: 4, c: 0 }, direction: "UP" };
    const target2 = { source: { r: 4, c: 6 }, direction: "UP" };
    const paid = { paymentConfirmed: true, paidCost: { food: 80, wood: 80 } };

    // Build 1st Barracks
    assert.equal(service.createSpecialBlock("BARRACKS", target1, paid).success, true);

    // 2nd Barracks in Stage 2 must fail
    const vSecond = service.validateTarget("BARRACKS", target2);
    assert.equal(vSecond.valid, false);
    assert.equal(vSecond.reason, "STAGE_CREATION_LIMIT");

    // Advance to Stage 3
    state.stage.id = 3;
    const vStage3 = service.validateTarget("BARRACKS", target2);
    assert.equal(vStage3.valid, true, "Stage 3 must permit a new Barracks construction");
    assert.equal(service.createSpecialBlock("BARRACKS", target2, paid).success, true);
});

// -------------------------------------------------------------
// 7. Production, Zone & LINK Exclusion
// -------------------------------------------------------------
test("Barracks has 0 fixed production and does not participate in Zones or LINKs", () => {
    const { state, service } = setup(7, 2);
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const paid = { paymentConfirmed: true, paidCost: { food: 80, wood: 80 } };
    assert.equal(service.createSpecialBlock("BARRACKS", { source: { r: 4, c: 0 }, direction: "UP" }, paid).success, true);

    const cell1 = state.grid[3][0];
    const cell2 = state.grid[2][0];
    assert.equal(excludesCellFromZones(cell1), true, "Cell 1 excluded from Zones");
    assert.equal(excludesCellFromZones(cell2), true, "Cell 2 excluded from Zones");

    const prod = sumSpecialBlockProduction(state);
    assert.equal(prod.yields.food, 0);
    assert.equal(prod.yields.wood, 0);
    assert.equal(prod.yields.defense, 0);
    assert.equal(prod.yields.mystic, 0);
});

// -------------------------------------------------------------
// 8. 1x2 Entity Contract, Save / Restore
// -------------------------------------------------------------
test("1x2 entity contract: instanceId, placementGroupId, footprint preserved across save/restore without object reference dependency", () => {
    const { state, service } = setup(7, 2);
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const paid = { paymentConfirmed: true, paidCost: { food: 80, wood: 80 } };
    const created = service.createSpecialBlock("BARRACKS", { source: { r: 4, c: 0 }, direction: "UP" }, paid);
    assert.equal(created.success, true);

    const cell1 = state.grid[3][0];
    const cell2 = state.grid[2][0];
    const expectedInstanceId = "BARRACKS@3:0";

    assert.equal(cell1.specialBlock.instanceId, expectedInstanceId);
    assert.equal(cell2.specialBlock.instanceId, expectedInstanceId);
    assert.equal(cell1.placementGroupId, expectedInstanceId);
    assert.equal(cell2.placementGroupId, expectedInstanceId);
    assert.deepEqual(cell1.specialBlock.footprint, [{ r: 3, c: 0 }, { r: 2, c: 0 }]);
    assert.deepEqual(cell2.specialBlock.footprint, [{ r: 3, c: 0 }, { r: 2, c: 0 }]);

    // Serialize
    const serialized = serializeGameState(state);
    assert.ok(serialized);

    // Hydrate into new state
    const restoredState = {};
    hydrateGameState(restoredState, serialized, {
        resolveCardMaster: id => ({ id, nameKey: id })
    });

    const rCell1 = restoredState.grid[3][0];
    const rCell2 = restoredState.grid[2][0];

    assert.equal(rCell1.specialBlock.instanceId, expectedInstanceId);
    assert.equal(rCell2.specialBlock.instanceId, expectedInstanceId);
    assert.equal(rCell1.placementGroupId, expectedInstanceId);
    assert.equal(rCell2.placementGroupId, expectedInstanceId);
    assert.deepEqual(rCell1.specialBlock.footprint, [{ r: 3, c: 0 }, { r: 2, c: 0 }]);
    assert.deepEqual(rCell2.specialBlock.footprint, [{ r: 3, c: 0 }, { r: 2, c: 0 }]);
    assert.equal(rCell1.specialBlock.createdStage, 2);
    assert.equal(rCell2.specialBlock.createdStage, 2);

    // Verify stage limit check on restored state does not double count
    const restoredService = new SpecialBlockService(restoredState);
    Object.assign(restoredState.grid[4][6], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });
    const vStage2Restored = restoredService.validateTarget("BARRACKS", {
        source: { r: 4, c: 6 },
        direction: "UP"
    });
    assert.equal(vStage2Restored.valid, false, "Stage creation limit must be enforced after restore");
    assert.equal(vStage2Restored.reason, "STAGE_CREATION_LIMIT");
});

// -------------------------------------------------------------
// 9. Semantic Capabilities & Trial Foundation Isolation
// -------------------------------------------------------------
test("semantic capabilities supply MILITARY_SITE and ATTACHMENT_HOST without altering live Trial Deployment Origins", () => {
    const { state, service, board } = setup(7, 2);
    Object.assign(state.grid[4][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const paid = { paymentConfirmed: true, paidCost: { food: 80, wood: 80 } };
    assert.equal(service.createSpecialBlock("BARRACKS", { source: { r: 4, c: 0 }, direction: "UP" }, paid).success, true);

    const cell1 = state.grid[3][0];
    const cell2 = state.grid[2][0];

    // Capabilities
    const caps1 = service.readCapabilities(cell1);
    const caps2 = service.readCapabilities(cell2);
    assert.equal(caps1.has(BOARD_CAPABILITIES.MILITARY_SITE), true);
    assert.equal(caps1.has(BOARD_CAPABILITIES.MILITARY_ATTACHMENT_HOST), true);
    assert.equal(caps1.has(BOARD_CAPABILITIES.DEPLOYMENT_ORIGIN_CANDIDATE), true);
    assert.equal(caps1.has(BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN), false, "Must NOT have REINFORCEMENT_ORIGIN in production");
    assert.equal(caps2.has(BOARD_CAPABILITIES.MILITARY_SITE), true);
    assert.equal(caps2.has(BOARD_CAPABILITIES.MILITARY_ATTACHMENT_HOST), true);
    assert.equal(caps2.has(BOARD_CAPABILITIES.DEPLOYMENT_ORIGIN_CANDIDATE), true);
    assert.equal(caps2.has(BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN), false);

    // Trial Deployment Origins: only HQ must be returned!
    const origins = board.listTrialDeploymentOrigins();
    assert.equal(origins.length, 1, "Only HQ is a live Trial origin; Barracks is not auto-registered");
    assert.equal(origins[0].kind, "HQ");

    // DeploymentOriginResolver
    const resolver = new DeploymentOriginResolver({ boardQuery: board });
    const resolved = resolver.resolveCandidates();
    assert.equal(resolved.success, true);
    assert.equal(resolved.candidates.length, 1);
    assert.equal(resolved.candidates[0].kind, "HQ");
});

// -------------------------------------------------------------
// 10. UI Target Disambiguation & Prompt Selection
// -------------------------------------------------------------
test("UI target selection resolves ambiguous overlapping targets via generic prompt", () => {
    const { state, deck } = setup(7, 2);
    // Setup overlapping candidates at (1,1):
    // Source A: (1, 0) -> RIGHT => footprint [(1, 1), (1, 2)]
    // Source B: (2, 1) -> UP    => footprint [(1, 1), (0, 1)]
    Object.assign(state.grid[1][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });
    Object.assign(state.grid[2][1], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 2, gl: 1 }
    });

    const targets = deck.enumerateCardExecutionTargets(card);
    const cell11Targets = targets.filter(t => t.r === 1 && t.c === 1);
    assert.equal(cell11Targets.length, 2, "There must be 2 distinct legal candidates starting at (1, 1)");

    const rightTarget = cell11Targets.find(t => t.direction === "RIGHT");
    const upTarget = cell11Targets.find(t => t.direction === "UP");
    assert.ok(rightTarget, "Must have RIGHT candidate from (1,0)");
    assert.ok(upTarget, "Must have UP candidate from (2,1)");

    // 10A: Verify fail-closed behavior when ModalSystem is unavailable and no prompt hook exists
    const failClosedUi = {
        state,
        selectedCard: card,
        selectedCardIdx: 0,
        isTrialInteractionActive: () => false,
        commandCardRequiresTarget: () => true,
        hideCellTooltip() {},
        getCommandCardExecutionTargets: () => targets,
        isCommandExecutionTarget: UIController.prototype.isCommandExecutionTarget,
        promptCommandTargetSelection: UIController.prototype.promptCommandTargetSelection,
        playCommandCard() {
            throw new Error("playCommandCard must NOT be called when modalSys is unavailable");
        }
    };
    const initialFood = state.food;
    const initialWood = state.wood;
    const failClosedResult = UIController.prototype.onCellClick.call(failClosedUi, 1, 1);
    assert.equal(failClosedResult, false, "Must fail-closed and return false when selection cannot be safely prompted");
    assert.equal(state.food, initialFood, "Food must NOT be consumed");
    assert.equal(state.wood, initialWood, "Wood must NOT be consumed");
    assert.equal(state.grid[1][1].specialBlock, null, "No block placed on fail-closed");

    // 10B: Test UIController handling via choice prompt hook
    let promptedCandidates = null;
    let playedTarget = null;
    const ui = {
        state,
        selectedCard: card,
        selectedCardIdx: 0,
        isTrialInteractionActive: () => false,
        commandCardRequiresTarget: () => true,
        hideCellTooltip() {},
        getCommandCardExecutionTargets: () => targets,
        isCommandExecutionTarget: UIController.prototype.isCommandExecutionTarget,
        promptCommandTargetSelection: UIController.prototype.promptCommandTargetSelection,
        onCommandTargetPrompt: (candidates) => {
            promptedCandidates = candidates;
            // Explicitly choose UP target
            return upTarget;
        },
        playCommandCard(_c, _idx, t) {
            playedTarget = t;
            return deck.playCommandCard(card, t, 0, -1);
        }
    };

    // Clicking (1, 1) must trigger promptCommandTargetSelection and allow choosing UP
    const clickResult = UIController.prototype.onCellClick.call(ui, 1, 1);
    assert.equal(clickResult, true, "onCellClick must succeed via choice prompt");
    assert.equal(promptedCandidates.length, 2, "Both candidates must be presented to player");
    assert.equal(playedTarget.direction, "UP");
    assert.equal(state.grid[1][1].specialBlock.type, "BARRACKS");
    assert.equal(state.grid[0][1].specialBlock.type, "BARRACKS");
    assert.equal(readSpecialBlockAdjacencyProfile(state.grid[1][1]).e, 2, "Must inherit E=2 from UP source (2,1)");

    // Verify i18n keys for prompt
    assert.ok(I18n.t("UI_COMMAND_TARGET_SELECT_TITLE", { name: "Barracks" }));
    assert.ok(I18n.t("UI_COMMAND_TARGET_SELECT_DESC"));
    assert.ok(I18n.t("DIRECTION_UP"));
    assert.ok(I18n.t("DIRECTION_RIGHT"));
    assert.ok(I18n.t("UI_COMMAND_TARGET_SOURCE", { r: 1, c: 0 }));
    assert.ok(I18n.t("UI_COMMAND_TARGET_FOOTPRINT", { footprint: "(1,1) -> (1,2)" }));
});

// -------------------------------------------------------------
// 11. UI Target Single Candidate Direct Execution
// -------------------------------------------------------------
test("UI target selection directly executes when only single candidate exists", () => {
    const { state, deck } = setup(7, 2);
    // Source only at (0, 0) -> DOWN => footprint [(1, 0), (2, 0)]
    Object.assign(state.grid[0][0], {
        placed: true,
        terrain: { id: "GL1_PLAINS", e: 1, gl: 1 }
    });

    const targets = deck.enumerateCardExecutionTargets(card);
    const cell10Targets = targets.filter(t => t.r === 1 && t.c === 0);
    assert.equal(cell10Targets.length, 1);

    let promptCalled = false;
    let playedTarget = null;
    const ui = {
        state,
        selectedCard: card,
        selectedCardIdx: 0,
        isTrialInteractionActive: () => false,
        commandCardRequiresTarget: () => true,
        hideCellTooltip() {},
        getCommandCardExecutionTargets: () => targets,
        isCommandExecutionTarget: UIController.prototype.isCommandExecutionTarget,
        promptCommandTargetSelection: () => {
            promptCalled = true;
            return false;
        },
        playCommandCard(_c, _idx, t) {
            playedTarget = t;
            return deck.playCommandCard(card, t, 0, -1);
        }
    };

    const clickResult = UIController.prototype.onCellClick.call(ui, 1, 0);
    assert.equal(clickResult, true);
    assert.equal(promptCalled, false, "Prompt must NOT be called when only 1 candidate exists");
    assert.equal(playedTarget.direction, "DOWN");
    assert.equal(state.grid[1][0].specialBlock.type, "BARRACKS");
    assert.equal(state.grid[2][0].specialBlock.type, "BARRACKS");
});

console.log(`\n🎉 All ${testCount} Barracks Tests PASSED successfully!`);

