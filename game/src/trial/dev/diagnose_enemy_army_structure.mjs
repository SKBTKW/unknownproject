import assert from "node:assert/strict";
import { EnemyArmyStructureResolver } from "../systems/enemy_army_structure_resolver.js";
import { createEnemyStateTransitionResolver } from "../systems/enemy_state_transition_resolver.js";
import { TrialIngressSelectionPolicy } from "../scenario/trial_ingress_selection_policy.js";
import { TrialRouteSuppressionAllocator } from "../scenario/trial_route_suppression_allocator.js";

const resolver = new EnemyArmyStructureResolver({
    policy: {
        suppressionPerForce: 30,
        maxForces: 4,
        mainForceWeight: 2
    }
});

const none = resolver.resolve({ strategicSuppression: 0, trialIndex: 1 });
assert.equal(none.forceCount, 0);
assert.equal(none.routeCount, 0);
assert.equal(none.commander, null);
assert.deepEqual(none.forces, []);

const low = resolver.resolve({ strategicSuppression: 20, trialIndex: 1 });
assert.equal(low.forceCount, 1);
assert.equal(low.routeCount, 1);
assert.equal(low.commander.level, 1);
assert.equal(low.commander.capabilities.ingressJudgement, false);
assert.equal(low.forces[0].strategicSuppression, 20);
assert.equal(low.forces[0].quality.equipmentQualityLevel, 1);

const mid = resolver.resolve({ strategicSuppression: 80, trialIndex: 2 });
assert.equal(mid.forceCount, 3);
assert.equal(mid.commander.level, 3);
assert.equal(mid.commander.capabilities.subordinateCommanders, true);
assert.equal(mid.commander.capabilities.ingressJudgement, true);
assert.equal(mid.forces.length, 3);
assert.ok(mid.forces[0].strategicSuppression > mid.forces[1].strategicSuppression);
assert.ok(mid.forces.slice(1).every(force => force.commander));
assert.equal(mid.forces.reduce((sum, force) => sum + force.strategicSuppression, 0), 80);

const high = resolver.resolve({ strategicSuppression: 170, trialIndex: 3 });
assert.equal(high.forceCount, 4);
assert.equal(high.commander.level, 5);
assert.equal(high.commander.capabilities.adaptiveComposition, true);
assert.equal(high.routeCount, 4);

const transition = createEnemyStateTransitionResolver({ armyStructureResolver: resolver });
const truth = transition({
    currentThreat: { strategicSuppression: 80 },
    trialIndex: 2,
    verse: 25
});
assert.equal(truth.strategicSuppression, 80);
assert.equal(truth.armyStructure.forceCount, 3);
assert.equal(truth.forces.length, 3);
assert.equal(truth.commander.level, 3);
assert.equal(truth.lastTransition.type, "THREAT_TO_ARMY_STRUCTURE");

const candidates = [
    { id: "A" },
    { id: "B" },
    { id: "C" },
    { id: "D" }
];
const selector = new TrialIngressSelectionPolicy({
    ingressScoreResolver: ({ candidate }) => ({ A: 1, B: 10, C: 5, D: 3 })[candidate.id]
});
const ingresses = selector.select({
    candidates,
    enemyTruth: truth,
    armyStructure: truth.armyStructure
});
assert.deepEqual(ingresses.map(item => item.id), ["B", "C", "D"]);

const routes = ingresses.map((ingress, index) => ({
    id: `R${index + 1}`,
    ingressId: ingress.id
}));
const allocator = new TrialRouteSuppressionAllocator();
const allocated = allocator.allocate({
    routes,
    armyStructure: truth.armyStructure,
    enemySuppression: 80
});
assert.equal(allocated.length, 3);
assert.equal(allocated[0].forceRole, "MAIN");
assert.equal(allocated[0].forceId, "FORCE_1");
assert.ok(allocated[0].strategicSuppression > allocated[1].strategicSuppression);
assert.equal(allocated.reduce((sum, route) => sum + route.strategicSuppression, 0), 80);
assert.equal(
    allocator.allocate({ routes: routes.slice(0, 2), armyStructure: truth.armyStructure }).length,
    0
);

console.log("diagnose_enemy_army_structure: PASS");
