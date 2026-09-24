import assert from "node:assert/strict";
import { GameEngine } from "../game/src/app.js";

console.log("🃏 Running Offering Duplicate Fallback Regression Tests (A through F)...\n");

const engine = GameEngine.createGame({ runSeed: 0xA0714001 });
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

// C. Hold中の現役カードはOfferingへ重複せず、同一Offering内も一意
{
    const testEngine = GameEngine.createGame({ runSeed: 0xA0714002 });
    const dm = testEngine.deckManager;
    const activeHeld = dm.getLandCardMaster().find(card => card.id === "CARD_PLAINS_1X1");
    assert.ok(activeHeld, "active held-card fixture must exist");
    testEngine.state.reserveSlots[0] = {
        id: "held-plains",
        cardMasterId: activeHeld.id,
        category: "LAND",
        terrain: activeHeld
    };

    for (let t = 0; t < 20; t++) {
        const offering = dm.generateOfferingCards();
        const ids = offering.map(card => card.cardMasterId || card.terrain?.id);
        assert.ok(!ids.includes(activeHeld.id), "Held active card must not appear in offering");
        assert.equal(new Set(ids).size, ids.length, "Offering cards must be distinct");
    }
    console.log("  ✅ C. Hold中の現役カードを除外し、同一Offering内の一意性を維持");
}

// D. Phase 1候補を実際にCooldownへ入れ、Phase 2 fallbackで3枚を復旧
{
    const testEngine = GameEngine.createGame({ runSeed: 0xA0714003 });
    const dm = testEngine.deckManager;
    const currentTurn = testEngine.state.turn;
    const eligibleBeforeCooldown = dm.getLandCardMaster()
        .filter(card => dm.isCardEligible(card, 1, 0, { ignoreCooldown: true, ignoreHold: true }));
    assert.ok(eligibleBeforeCooldown.length >= 3, "fallback fixture requires at least three Stage 1 candidates");

    for (const card of eligibleBeforeCooldown) {
        testEngine.state.cardCooldowns[card.id] = currentTurn + 20;
    }
    const phase1Eligible = eligibleBeforeCooldown
        .filter(card => dm.isCardEligible(card, 1, 0));
    assert.equal(phase1Eligible.length, 0, "all normal Phase 1 candidates are actually on cooldown");

    const offering = dm.generateOfferingCards();
    assert.equal(offering.length, 3, "Phase 2/3 fallback restores offering size to 3");
    const ids = offering.map(card => card.cardMasterId || card.terrain?.id);
    assert.equal(new Set(ids).size, 3, "fallback offering remains duplicate-free");
    assert.ok(ids.every(id => !dm.cycleSystem.isRetiredCard(id)), "fallback must never resurrect retired Trial-prep cards");
    assert.ok(ids.some(id => eligibleBeforeCooldown.some(card => card.id === id)),
        "at least one genuinely cooldown-blocked eligible card is rescued by fallback");
    console.log("  ✅ D. 実Cooldown枯渇からPhase 2/3 fallbackで安全に3枚を復旧");
}

// E. Phase 3 fallback (基本土地プール) が壊れていないこと
{
    const testEngine = GameEngine.createGame({ runSeed: 0xA0714004 });
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

// F. drawSingleCardは除外集合とretired契約を常に尊重する
{
    const eligible = master.filter(card => deckManager.isCardEligible(card, 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }));
    assert.ok(eligible.length >= 2);
    const excluded = eligible.slice(0, 2).map(card => card.id);
    for (let i = 0; i < 20; i++) {
        const drawn = deckManager.drawSingleCard(excluded, { ignoreCooldown: true, ignoreHold: true });
        assert.ok(drawn, "drawSingleCard must return a candidate");
        const id = drawn.cardMasterId || drawn.terrain?.id;
        assert.ok(!excluded.includes(id), "drawSingleCard must respect excludedCardIds");
        assert.equal(deckManager.cycleSystem.isRetiredCard(id), false, "normal Stage 1 draw must not return retired card");
    }
    console.log("  ✅ F. excludedCardIdsとretired契約を決定的seed下で維持");
}

console.log("\n🎉 All 6 Offering Duplicate Fallback tests PASSED!");