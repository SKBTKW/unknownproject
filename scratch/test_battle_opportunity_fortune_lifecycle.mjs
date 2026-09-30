import assert from "node:assert/strict";
import { createBattleResolutionSnapshot } from "../game/src/trial/domain/battle_resolution_snapshot.js";
import { createBattleOpportunityState } from "../game/src/trial/domain/battle_opportunity_domain.js";
import {
    BATTLE_RESOLUTION_PHASES,
    BATTLE_FORTUNE_RESULTS
} from "../game/src/trial/domain/battle_resolution_types.js";
import { BattleOpportunityFortuneLifecycleService } from "../game/src/trial/systems/battle_opportunity_fortune_lifecycle_service.js";

const base = createBattleResolutionSnapshot({
    battleId: "B1",
    routeId: "R1",
    actions: [{ actionId: "A1", type: "INTERCEPT" }],
    causes: [{ causeId: "C1", type: "TERRAIN_ADVANTAGE" }],
    causalEvents: [],
    consequences: [],
    battleState: { control: "HUMAN" },
    normalOutcome: { outcome: "REPEL", margin: 8 }
});

let ember = 5;
const emberSystem = {
    get current() { return ember; },
    consume(cost) {
        if (ember < cost) return false;
        ember -= cost;
        return true;
    }
};
const rolls = [4, 5];
const gameplayRandom = {
    calls: 0,
    nextInt(min, max) {
        assert.equal(min, 1);
        assert.equal(max, 6);
        this.calls += 1;
        return rolls.shift();
    }
};

const lifecycle = new BattleOpportunityFortuneLifecycleService({
    opportunityPolicy: {
        evaluate(snapshot) {
            return {
                available: true,
                opportunity: createBattleOpportunityState({
                    opportunityId: `opp:${snapshot.battleId}`,
                    battleId: snapshot.battleId,
                    state: "AVAILABLE",
                    eligibility: "ELIGIBLE",
                    normalOutcomeProvenance: { battleId: snapshot.battleId },
                    sourceCauses: snapshot.causes.map(row => row.causeId)
                })
            };
        }
    },
    emberCostPolicy: {
        resolve() { return 2; }
    },
    fortuneResultPolicy: {
        resolve({ dice, total }) {
            assert.deepEqual(dice, [4, 5]);
            assert.equal(total, 9);
            return {
                result: BATTLE_FORTUNE_RESULTS.DECISIVE_SUCCESS,
                payload: { policyMarker: "TEST_ONLY" }
            };
        }
    },
    decisiveEventPolicy: {
        select({ snapshot, fortuneResolution }) {
            assert.equal(snapshot.causes[0].causeId, "C1");
            assert.equal(fortuneResolution.result, BATTLE_FORTUNE_RESULTS.DECISIVE_SUCCESS);
            return {
                eventId: "D1",
                type: "TEST_DECISIVE_EVENT",
                sourceCauses: ["C1"]
            };
        }
    },
    finalResultPolicy: {
        projectDeclined({ snapshot }) {
            return { ...snapshot.normalOutcome, source: "DECLINED_TEST_POLICY" };
        },
        projectFortune({ snapshot, decisiveEvent }) {
            return {
                ...snapshot.normalOutcome,
                decisiveEventId: decisiveEvent?.eventId ?? null,
                source: "FORTUNE_TEST_POLICY"
            };
        }
    },
    emberSystem,
    gameplayRandom
});

const opened = lifecycle.openOpportunity(base);
assert.equal(opened.available, true);
assert.equal(opened.snapshot.resolutionPhase, BATTLE_RESOLUTION_PHASES.OPPORTUNITY_PENDING);
assert.equal(base.opportunity, null);
assert.equal(opened.snapshot.opportunity.sourceCauses[0], "C1");

const committed = lifecycle.commitOpportunity(opened.snapshot);
assert.equal(committed.emberCommit.cost, 2);
assert.equal(committed.emberCommit.emberBefore, 5);
assert.equal(committed.emberCommit.emberAfter, 3);
assert.equal(ember, 3);
assert.equal(opened.snapshot.emberCommit, null);

const fortune = lifecycle.resolveFortune(committed);
assert.equal(gameplayRandom.calls, 2);
assert.deepEqual(fortune.fortuneRoll.dice, [4, 5]);
assert.equal(fortune.fortuneRoll.total, 9);
assert.equal(fortune.fortuneRoll.result, BATTLE_FORTUNE_RESULTS.DECISIVE_SUCCESS);
assert.equal(fortune.decisiveEvent.eventId, "D1");
assert.equal(fortune.finalCombatResult.source, "FORTUNE_TEST_POLICY");
assert.equal(fortune.resolutionPhase, BATTLE_RESOLUTION_PHASES.FORTUNE_RESOLVED);
assert.equal(fortune.finalized, false);

const finalized = lifecycle.finalizeFortune(fortune);
assert.equal(finalized.resolutionPhase, BATTLE_RESOLUTION_PHASES.FINALIZED);
assert.equal(finalized.finalized, true);
assert.deepEqual(finalized.normalOutcome, base.normalOutcome);
assert.deepEqual(finalized.causes, base.causes);
assert.throws(() => lifecycle.resolveFortune(finalized), /BATTLE_OPPORTUNITY_NOT_PENDING/);

const declineLifecycle = new BattleOpportunityFortuneLifecycleService({
    opportunityPolicy: lifecycle.opportunityPolicy,
    finalResultPolicy: lifecycle.finalResultPolicy
});
const declineOpened = declineLifecycle.openOpportunity(base).snapshot;
const declined = declineLifecycle.declineOpportunity(declineOpened);
assert.equal(declined.opportunity.declined, true);
assert.equal(declined.finalized, true);
assert.equal(declined.resolutionPhase, BATTLE_RESOLUTION_PHASES.FINALIZED);
assert.equal(declined.finalCombatResult.source, "DECLINED_TEST_POLICY");

let noOpportunityPolicyCalls = 0;
const none = new BattleOpportunityFortuneLifecycleService({
    opportunityPolicy: {
        evaluate(snapshot) {
            noOpportunityPolicyCalls += 1;
            assert.equal(snapshot.battleId, "B1");
            return { available: false, opportunity: null };
        }
    }
}).openOpportunity(base);
assert.equal(noOpportunityPolicyCalls, 1);
assert.equal(none.available, false);
assert.equal(none.snapshot, base);

let failedEmber = 1;
const insufficient = new BattleOpportunityFortuneLifecycleService({
    opportunityPolicy: lifecycle.opportunityPolicy,
    emberCostPolicy: { resolve: () => 2 },
    emberSystem: {
        get current() { return failedEmber; },
        consume() { throw new Error("MUST_NOT_CONSUME"); }
    }
});
const insufficientOpened = insufficient.openOpportunity(base).snapshot;
assert.throws(() => insufficient.commitOpportunity(insufficientOpened), /BATTLE_EMBER_INSUFFICIENT/);
assert.equal(failedEmber, 1);

const noRng = new BattleOpportunityFortuneLifecycleService({
    opportunityPolicy: lifecycle.opportunityPolicy,
    emberCostPolicy: { resolve: () => 0 },
    emberSystem: { current: 5, consume: () => true },
    fortuneResultPolicy: lifecycle.fortuneResultPolicy,
    decisiveEventPolicy: lifecycle.decisiveEventPolicy,
    finalResultPolicy: lifecycle.finalResultPolicy
});
const noRngOpened = noRng.openOpportunity(base).snapshot;
const noRngCommitted = noRng.commitOpportunity(noRngOpened);
assert.throws(() => noRng.resolveFortune(noRngCommitted), /BATTLE_GAMEPLAY_RNG_REQUIRED/);

console.log("✅ Battle Opportunity / Fortune lifecycle focused test PASS");
