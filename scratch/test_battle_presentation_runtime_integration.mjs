import assert from "node:assert/strict";
import { TrialController } from "../game/src/trial/flow/trial_controller_base.js";
import { TRIAL_BATTLE_STATUSES } from "../game/src/trial/domain/trial_types.js";

function combatResult() {
    return {
        success: true,
        human: { finalPower: 70 },
        enemy: { finalPower: 50 },
        prediction: { outcome: "REPEL", margin: 20 },
        modifiers: []
    };
}

class HarnessController extends TrialController {
    createRouteInterceptionInput(routeId, interceptCell, allocatedDefense) {
        return {
            success: true,
            input: {
                routeId,
                interceptCell: { ...interceptCell },
                approachCell: { ...interceptCell },
                allocatedDefense
            }
        };
    }

    createBattleContext(input) {
        return {
            ...input,
            human: { allocatedDefense: input.allocatedDefense },
            enemy: {}
        };
    }
}

function stateWithBattles(count = 1) {
    return {
        scenarioId: "SCENARIO",
        trialIndex: 1,
        planActivated: true,
        currentBattleIndex: 0,
        battleQueue: Array.from({ length: count }, (_, index) => ({
            routeId: `R${index + 1}`,
            interceptCell: { r: index + 1, c: index + 2 },
            defenseAllocation: 10 + index,
            status: index === 0 ? TRIAL_BATTLE_STATUSES.ACTIVE : TRIAL_BATTLE_STATUSES.PENDING
        }))
    };
}

const order = [];
const snapshotCalls = [];
const snapshotFactory = {
    create(args) {
        order.push("SNAPSHOT");
        snapshotCalls.push(args);
        return Object.freeze({
            battleId: args.battleId,
            routeId: args.routeId,
            actions: Object.freeze(args.actions.map(row => Object.freeze({ ...row }))),
            causes: Object.freeze([]),
            causalEvents: Object.freeze([]),
            consequences: Object.freeze([]),
            battleState: Object.freeze({}),
            normalOutcome: Object.freeze({ outcome: args.combatResult.prediction.outcome })
        });
    }
};
const sequenceService = {
    completeCurrentBattle(state, result) {
        order.push("COMMIT");
        const battle = state.battleQueue[state.currentBattleIndex];
        battle.status = TRIAL_BATTLE_STATUSES.RESOLVED;
        return { success: true, battleIndex: state.currentBattleIndex, battleResult: { ...result } };
    },
    getCurrentBattle(state) {
        return state?.battleQueue?.[state.currentBattleIndex] || null;
    }
};
const facts = [];
const controller = new HarnessController({
    combatResolver: { resolve: () => combatResult() },
    sequenceService,
    battleResolutionSnapshotFactory: snapshotFactory,
    gameFactHub: { emit: (type, payload) => facts.push({ type, payload }) }
});
controller.state = stateWithBattles(2);

const first = controller.resolveCurrentBattle();
assert.equal(first.success, true);
assert.deepEqual(order, ["SNAPSHOT", "COMMIT"]);
assert.equal(first.battleResolutionSnapshot.battleId, "SCENARIO:trial:1:battle:0");
assert.equal(first.battleResolutionSnapshot.routeId, "R1");
assert.equal(first.battleResolutionSnapshot.actions[0].type, "INTERCEPT");
assert.equal(first.battleResolutionSnapshot.actions[0].provenance.source, "TRIAL_BATTLE_SEQUENCE");
assert.equal(first.battleResolutionSnapshot.actions[0].provenance.routeId, "R1");
assert.equal(controller.getCurrentBattleResolutionSnapshot(), first.battleResolutionSnapshot);
assert.equal(controller.getBattleResolutionSnapshot(0), first.battleResolutionSnapshot);

controller.state.currentBattleIndex = 1;
controller.state.battleQueue[1].status = TRIAL_BATTLE_STATUSES.ACTIVE;
const second = controller.resolveCurrentBattle();
assert.equal(second.success, true);
assert.notEqual(second.battleResolutionSnapshot.battleId, first.battleResolutionSnapshot.battleId);
assert.equal(controller.getBattleResolutionSnapshot(0), first.battleResolutionSnapshot);
assert.equal(controller.getBattleResolutionSnapshot(1), second.battleResolutionSnapshot);
assert.equal(snapshotCalls.length, 2);

let commitCalled = false;
const failing = new HarnessController({
    combatResolver: { resolve: () => combatResult() },
    sequenceService: {
        completeCurrentBattle() {
            commitCalled = true;
            return { success: true };
        }
    },
    battleResolutionSnapshotFactory: {
        create() {
            throw new Error("SNAPSHOT_FAILURE");
        }
    },
    gameFactHub: { emit() {} }
});
failing.state = stateWithBattles(1);
assert.throws(() => failing.resolveCurrentBattle(), /SNAPSHOT_FAILURE/);
assert.equal(commitCalled, false);
assert.equal(failing.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.ACTIVE);

console.log("✅ Battle Presentation runtime integration focused test PASS");
