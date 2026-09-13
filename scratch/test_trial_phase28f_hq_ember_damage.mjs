import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../game/src/core/game_fact.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import {
    TRIAL_PLAN_REASONS,
    TRIAL_BATTLE_STATUSES,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../game/src/trial/domain/trial_types.js";
import { TrialHqDamageResolver } from "../game/src/trial/systems/trial_hq_damage_resolver.js";

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log("  ✅ " + name);
}

function damageFacts(controller) {
    return controller.gameFactHub.getFacts()
        .filter(fact => fact.type === GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED);
}

function createEmberSystem(initialEmber = 20) {
    const engine = {
        state: { ember: initialEmber },
        runTerminationService: {
            getResult: () => null
        }
    };

    return {
        current: initialEmber,
        engine,
        applyDamage(amount) {
            this.current = Math.max(0, this.current - Math.max(0, Number(amount) || 0));
            this.engine.state.ember = this.current;
            return this.current;
        }
    };
}

function createAggregateState({
    initialEmber = 20,
    interceptPower = 6,
    skipPower = 1,
    includeSkip = true,
    interceptReachedEnd = true,
    interceptStopped = false,
    currentBattleIndex = null,
    sequenceAdvanced = true
} = {}) {
    const routes = [
        {
            id: "ROUTE_INTERCEPT",
            suppression: interceptPower,
            cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }]
        }
    ];
    const planRoutes = [
        {
            routeId: "ROUTE_INTERCEPT",
            status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT
        }
    ];

    if (includeSkip) {
        routes.push({
            id: "ROUTE_SKIP",
            suppression: skipPower,
            cells: [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }]
        });
        planRoutes.push({
            routeId: "ROUTE_SKIP",
            status: TRIAL_ROUTE_PLAN_STATUSES.SKIP
        });
    }

    return {
        planActivated: true,
        interceptionPlan: { routes: planRoutes },
        routes,
        enemy: { totalSuppression: 0 },
        currentBattleIndex,
        battleQueue: [{
            routeId: "ROUTE_INTERCEPT",
            status: TRIAL_BATTLE_STATUSES.RESOLVED,
            traversalApplied: true,
            sequenceAdvanced
        }],
        battleResults: [{ remainingSuppression: interceptPower }],
        traversalResults: [{
            battleIndex: 0,
            routeId: "ROUTE_INTERCEPT",
            reachedRouteEnd: interceptReachedEnd,
            stopped: interceptStopped
        }],
        skippedRouteResults: {},
        routeProgress: {},
        hqDamageResolution: null,
        human: {
            ember: initialEmber,
            availableDefense: 19,
            mystic: 0
        },
        ember: initialEmber
    };
}

function createControllerHarness(options = {}) {
    const state = createAggregateState(options);
    const emberSystem = createEmberSystem(options.initialEmber ?? 20);
    const controller = new TrialController({
        gameFactHub: new GameFactHub(),
        emberSystem
    });
    controller.state = state;
    return { controller, emberSystem };
}

console.log("⚔️ Starting Phase 2.8F HQ / Ember Damage Resolution Tests...");

test("TrialHqDamageResolver: pure calculation and scaling formula", () => {
    const resolver = new TrialHqDamageResolver({ suppressionConversionRate: 5 });
    assert.equal(resolver.calculateDamage(0), 0);
    assert.equal(resolver.calculateDamage(1), 1);
    assert.equal(resolver.calculateDamage(5), 1);
    assert.equal(resolver.calculateDamage(6), 2);
    assert.equal(resolver.calculateDamage(15), 3);
    assert.equal(resolver.calculateDamage(20), 4);

    const customResolver = new TrialHqDamageResolver({ suppressionConversionRate: 10 });
    assert.equal(customResolver.calculateDamage(15), 2);
});

test("TrialHqDamageResolver: validation preconditions", () => {
    const resolver = new TrialHqDamageResolver();

    const res1 = resolver.resolve({});
    assert.equal(res1.success, false);
    assert.equal(res1.errors[0], TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE);

    const res2 = resolver.resolve({
        traversalResult: { reachedRouteEnd: false },
        battleResult: { remainingSuppression: 10 }
    });
    assert.equal(res2.success, false);
    assert.equal(res2.errors[0], TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE);

    const res3 = resolver.resolve({
        traversalResult: { reachedRouteEnd: true, damageApplied: true },
        battleResult: { remainingSuppression: 10 }
    });
    assert.equal(res3.success, false);
    assert.equal(res3.errors[0], TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED);

    const res4 = resolver.resolve({
        traversalResult: { reachedRouteEnd: true },
        battleResult: null
    });
    assert.equal(res4.success, false);
    assert.equal(res4.errors[0], TRIAL_PLAN_REASONS.INVALID_DAMAGE_SOURCE);
});

test("TrialHqDamageResolver: successful damage calculation snapshot", () => {
    const resolver = new TrialHqDamageResolver({ suppressionConversionRate: 5 });
    const res = resolver.resolve({
        battleIndex: 0,
        routeId: "ROUTE_NORTH",
        traversalResult: { battleIndex: 0, routeId: "ROUTE_NORTH", reachedRouteEnd: true },
        battleResult: { remainingSuppression: 20 },
        emberBefore: 20
    });

    assert.equal(res.success, true);
    assert.equal(res.damageResult.battleIndex, 0);
    assert.equal(res.damageResult.routeId, "ROUTE_NORTH");
    assert.equal(res.damageResult.reachedRouteEnd, true);
    assert.equal(res.damageResult.sourcePower, 20);
    assert.equal(res.damageResult.emberDamage, 4);
    assert.equal(res.damageResult.emberBefore, 20);
    assert.equal(res.damageResult.emberAfter, 16);
    assert.equal(res.damageResult.damageApplied, true);
});

test("TrialController: No route end produces NO_ROUTE_END_DAMAGE and 0 Fact", () => {
    const { controller } = createControllerHarness({
        interceptReachedEnd: false,
        interceptStopped: true,
        includeSkip: false
    });

    const result = controller.resolveRouteEndDamage(0);
    assert.equal(result.success, false);
    assert.equal(result.errors[0], TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE);
    assert.equal(damageFacts(controller).length, 0);
});

test("TrialController: Route end breakthrough records HQ arrival without applying Ember damage", () => {
    const { controller, emberSystem } = createControllerHarness({ includeSkip: false });
    const emberBefore = controller.state.ember;
    const factCountBefore = damageFacts(controller).length;

    const arrival = controller.resolveRouteEndDamage(0);

    assert.equal(arrival.success, true);
    assert.equal(arrival.arrivalRecorded, true);
    assert.equal(arrival.pendingAggregation, true);
    assert.equal(controller.state.hqDamageResolution, null);
    assert.equal(controller.state.ember, emberBefore);
    assert.equal(emberSystem.engine.state.ember, emberBefore);
    assert.equal(damageFacts(controller).length, factCountBefore);
});

test("TrialController: Aggregate HQ resolution is rejected before all battles settle", () => {
    const { controller, emberSystem } = createControllerHarness({
        currentBattleIndex: 0,
        sequenceAdvanced: false
    });
    const emberBefore = controller.state.ember;
    const factCountBefore = damageFacts(controller).length;

    const result = controller.resolveAggregatedHqDamage();

    assert.equal(result.success, false);
    assert.equal(result.errors[0], TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES);
    assert.equal(controller.state.ember, emberBefore);
    assert.equal(emberSystem.engine.state.ember, emberBefore);
    assert.equal(damageFacts(controller).length, factCountBefore);
});

test("TrialController: All settled routes resolve through one aggregate HQ damage result", () => {
    const { controller, emberSystem } = createControllerHarness({
        interceptPower: 6,
        skipPower: 1,
        includeSkip: true
    });

    const result = controller.resolveAggregatedHqDamage();
    assert.equal(result.success, true);

    const damageResult = result.damageResult;
    assert.equal(damageResult.aggregate, true);
    assert.equal(damageResult.routeEndCount, damageResult.arrivals.length);

    const expectedPower = damageResult.arrivals
        .reduce((sum, arrival) => sum + Number(arrival.sourcePower || 0), 0);
    const expectedDamage = Math.ceil(expectedPower / damageResult.conversionRate);

    assert.equal(damageResult.sourcePower, expectedPower);
    assert.equal(damageResult.emberDamage, expectedDamage);
    assert.equal(expectedPower, 7);
    assert.equal(expectedDamage, 2);
    assert.notEqual(
        expectedDamage,
        Math.ceil(6 / damageResult.conversionRate) + Math.ceil(1 / damageResult.conversionRate)
    );

    assert.ok(
        damageResult.arrivals.some(arrival => arrival.sourceType === "SKIP"),
        "SKIP arrival should participate in aggregate HQ resolution"
    );

    assert.equal(controller.state.ember, damageResult.emberAfter);
    assert.equal(emberSystem.engine.state.ember, damageResult.emberAfter);
    assert.deepEqual(controller.state.hqDamageResolution, damageResult);

    const facts = damageFacts(controller);
    assert.equal(facts.length, 1);
    assert.equal(facts[0].payload.aggregate, true);
    assert.equal(facts[0].payload.emberDamage, damageResult.emberDamage);
});

test("TrialController: Repeated aggregate HQ resolution is rejected without side effects", () => {
    const { controller } = createControllerHarness();
    const first = controller.resolveAggregatedHqDamage();
    assert.equal(first.success, true);

    const emberAfterFirst = controller.state.ember;
    const factsAfterFirst = damageFacts(controller).length;

    const second = controller.resolveAggregatedHqDamage();
    assert.equal(second.success, false);
    assert.equal(second.errors[0], TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED);
    assert.equal(controller.state.ember, emberAfterFirst);
    assert.equal(damageFacts(controller).length, factsAfterFirst);
});

test("TrialController: Aggregate HQ damage clamps Ember at 0", () => {
    const { controller, emberSystem } = createControllerHarness({
        initialEmber: 1,
        interceptPower: 20,
        skipPower: 0
    });

    const result = controller.resolveAggregatedHqDamage();
    assert.equal(result.success, true);
    assert.equal(result.damageResult.emberAfter, 0);
    assert.equal(controller.state.ember, 0);
    assert.equal(emberSystem.engine.state.ember, 0);
});

test("TrialController: Aggregate snapshot mutation does not corrupt internal state", () => {
    const { controller } = createControllerHarness();
    const result = controller.resolveAggregatedHqDamage();
    assert.equal(result.success, true);

    result.damageResult.emberDamage = 99999;
    result.damageResult.aggregate = false;

    assert.notEqual(controller.state.hqDamageResolution.emberDamage, 99999);
    assert.equal(controller.state.hqDamageResolution.aggregate, true);
});

test("TrialController: Non-damage resource integrity", () => {
    const { controller } = createControllerHarness();
    const defenseBefore = controller.state.human.availableDefense;
    const mysticBefore = controller.state.human.mystic;

    const result = controller.resolveAggregatedHqDamage();
    assert.equal(result.success, true);
    assert.equal(controller.state.human.availableDefense, defenseBefore);
    assert.equal(controller.state.human.mystic, mysticBefore);
});

console.log("\n🎉 All " + passed + " Phase 2.8F HQ / Ember Damage tests PASSED!");
