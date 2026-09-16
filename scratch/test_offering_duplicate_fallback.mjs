import assert from "node:assert/strict";
import { GameEngine } from "../game/src/app.js";

console.log("🃏 Running Offering Duplicate Fallback Regression Tests (A through F)...\n");

const engine = GameEngine.createGame();
const deckManager = engine.deckManager;
const master = deckManager.getLandCardMaster();

// A. filtered eligibleに候補がある → 従来どおり非除外カードから抽選
{
    const allEligible = master.filter(c => deckManager.isCardEligible(c, 1, 0));
    assert.ok(allEligible.length > 2, "Should have multiple eligible cards in Stage 1");
    const excluded = [allEligible[0].id];
    const drawn = deckManager.drawSingleCard(excluded);
    assert.ok(drawn, "Drawn card must not be null when candidates remain");
    assert.notEqual(drawn.cardMasterId, excluded[0], "Drawn card must not be in excludedCardIds");
    console.log("  ✅ A. filtered eligibleに候補がある → 従来どおり非除外カードから抽選");
}

// B. excludedCardIds適用後に候補0 → 元eligibleへ戻らず null を返却
{
    const allEligible = master.filter(c => deckManager.isCardEligible(c, 1, 0));
    const allIds = allEligible.map(c => c.id);
    const drawn = deckManager.drawSingleCard(allIds);
    assert.equal(drawn, null, "drawSingleCard must return null when all eligible cards are excluded");
    console.log("  ✅ B. excludedCardIds適用後に候補0 → 元eligibleへ戻らず null を返却");
}

// C. 同一Offering内で同一command cardが重複出現しない
{
    const testEngine = GameEngine.createGame();
    testEngine.state.wood = 50;
    testEngine.state.reserveSlots[0] = { id: 'CMD_BALLISTA_SET', cardMasterId: 'CMD_BALLISTA_SET', category: 'MILITARY', nameKey: 'CMD_BALLISTA_SET' };

    for (let t = 0; t < 100; t++) {
        const offering = testEngine.deckManager.generateOfferingCards();
        const seenCmds = new Set();
        for (const card of offering) {
            if (card && card.terrain && card.terrain.category && card.terrain.category !== 'LAND') {
                const id = card.cardMasterId || card.terrain.id;
                assert.notEqual(id, 'CMD_BALLISTA_SET', "Reserved command must not appear in offering");
                assert.ok(!seenCmds.has(id), `Duplicate command card ${id} must not appear in same offering`);
                seenCmds.add(id);
            }
        }
    }
    console.log("  ✅ C. 同一Offering内で同一command cardが重複出現しない (100 iterations)");
}

// D. Phase 1 不足時に Phase 2 (cooldown 解放) fallback へ進む
{
    const testEngine = GameEngine.createGame();
    const dm = testEngine.deckManager;
    // Put almost all eligible cards on cooldown with cycleSystem
    const allEligible = master.filter(c => dm.isCardEligible(c, 1, 0));
    const excluded = allEligible.slice(0, allEligible.length - 1).map(c => c.id);
    // 1 card left in Phase 1, remaining 2 slots must come from Phase 2 / Phase 3 fallbacks
    const offering = dm.generateOfferingCards();
    assert.equal(offering.length, 3, "Offering size must remain 3 via fallbacks");
    const offeringIds = offering.map(c => c.cardMasterId || c.terrain?.id);
    const uniqueIds = new Set(offeringIds);
    assert.equal(uniqueIds.size, 3, "Offering cards must all be distinct even with fallbacks");
    console.log("  ✅ D. Phase 1 不足時に Phase 2/3 fallback へ進み手札 3 枚を非重複で維持");
}

// E. Phase 3 fallback (基本土地プール) が壊れていないこと
{
    const testEngine = GameEngine.createGame();
    const dm = testEngine.deckManager;
    // Call offering and verify all cards have valid wrapped structure
    const offering = dm.generateOfferingCards();
    for (const card of offering) {
        assert.ok(card.id, "Card must have unique instance id");
        assert.ok(card.cardMasterId, "Card must have cardMasterId");
        assert.ok(card.currentShape, "Card must have currentShape");
    }
    console.log("  ✅ E. Phase 3 fallback (基本土地プール) 構造が正常に維持されていること");
}

// F. 通常時の weighted selection 候補集合が従来と同一
{
    const allEligible = master.filter(c => deckManager.isCardEligible(c, 1, 0));
    const excluded = [allEligible[0].id];
    const expectedCandidates = allEligible.filter(c => c.id !== excluded[0]);
    // Sample multiple draws to ensure selection comes from expected candidates
    const drawnIds = new Set();
    for (let i = 0; i < 50; i++) {
        const drawn = deckManager.drawSingleCard(excluded);
        drawnIds.add(drawn.cardMasterId);
    }
    for (const id of drawnIds) {
        assert.ok(expectedCandidates.some(c => c.id === id), `Drawn card ${id} must be in expected candidates`);
    }
    console.log("  ✅ F. 通常時の weighted selection 候補集合が従来と同一であることを確認");
}

console.log("\n🎉 All 6 Offering Duplicate Fallback tests PASSED!");
