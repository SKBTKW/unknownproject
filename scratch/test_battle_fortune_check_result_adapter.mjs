import assert from "node:assert/strict";
import { createBattleResolutionSnapshot } from "../game/src/trial/domain/battle_resolution_snapshot.js";
import { createBattleOpportunityState } from "../game/src/trial/domain/battle_opportunity_domain.js";
import {
    BATTLE_FORTUNE_RESULTS,
    BATTLE_RESOLUTION_PHASES
} from "../game/src/trial/domain/battle_resolution_types.js";
import { BattleFortuneCheckResultAdapter } from "../game/src/trial/systems/battle_fortune_check_result_adapter.js";
import { BattleOpportunityFortuneLifecycleService } from "../game/src/trial/systems/battle_opportunity_fortune_lifecycle_service.js";

const adapter = new BattleFortuneCheckResultAdapter();

const adapted = adapter.adapt({
    checkId: "future_shared_fortune",
    actionId: "A:fortune",
    checkSequence: 2,
    dice: {
        rolled: [4, 5],
        kept: [4, 5],
        dropped: []
    },
    finalTotal: 9,
    outcome: { id: "shared_success" },
    rng: { seed: 999, callCount: 42 }
});

assert.deepEqual(adapted.dice, [4, 5]);
assert.equal(adapted.total, 9);
assert.deepEqual(adapted.provenance, {
    checkId: "future_shared_fortune",
    actionId: "A:fortune",
    checkSequence: 2,
    outcomeId: "shared_success"
});
assert.equal(adapted.rng, undefined, "B adapter must not import Shared RNG state");
assert.throws(() => adapter.adapt(null), /BATTLE_FORTUNE_CHECK_RESULT_REQUIRED/);
assert.throws(
    () => adapter.adapt({ dice: { kept: [] }, finalTotal: 9 }),
    /BATTLE_FORTUNE_CHECK_DICE_REQUIRED/
);
assert.throws(
    () => adapter.adapt({ dice: { kept: [4, 5] }, finalTotal: "NaN" }),
    /BATTLE_FORTUNE_CHECK_TOTAL_REQUIRED/
);

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
    emberCostPolicy: { resolve: () => 2 },
    emberSystem: {
        get current() { return ember; },
        consume(cost) {
            if (ember < cost) return false;
            ember -= cost;
            return true;
        }
    },
    fortuneResultPolicy: {
        resolve({ dice, total, checkProvenance }) {
            assert.deepEqual(dice, [4, 5]);
            assert.equal(total, 9);
            assert.equal(checkProvenance.checkId, "future_shared_fortune");
            return {
                result: BATTLE_FORTUNE_RESULTS.DECISIVE_SUCCESS,
                payload: { domainMeaning: "TEST_DECISIVE" }
            };
        }
    },
    decisiveEventPolicy: {
        select({ fortuneResolution }) {
            assert.equal(fortuneResolution.result, BATTLE_FORTUNE_RESULTS.DECISIVE_SUCCESS);
            return { eventId: "D1", type: "TEST_DECISIVE_EVENT", sourceCauses: ["C1"] };
        }
    },
    finalResultPolicy: {
        projectFortune({ snapshot, decisiveEvent }) {
            return {
                ...snapshot.normalOutcome,
                decisiveEventId: decisiveEvent?.eventId ?? null,
                source: "SHARED_CHECK_ADAPTER_TEST"
            };
        }
    }
});

const opened = lifecycle.openOpportunity(base).snapshot;
const committed = lifecycle.commitOpportunity(opened);
const resolved = lifecycle.resolveFortuneInput(committed, adapted);

assert.equal(resolved.resolutionPhase, BATTLE_RESOLUTION_PHASES.FORTUNE_RESOLVED);
assert.deepEqual(resolved.fortuneRoll.dice, [4, 5]);
assert.equal(resolved.fortuneRoll.total, 9);
assert.equal(resolved.fortuneRoll.checkProvenance.checkId, "future_shared_fortune");
assert.equal(resolved.fortuneRoll.checkProvenance.outcomeId, "shared_success");
assert.equal(resolved.fortuneRoll.result, BATTLE_FORTUNE_RESULTS.DECISIVE_SUCCESS);
assert.equal(resolved.finalCombatResult.source, "SHARED_CHECK_ADAPTER_TEST");
assert.equal(resolved.decisiveEvent.eventId, "D1");

console.log("✅ Battle Fortune CheckResult adapter boundary PASS");
