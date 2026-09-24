import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    TRIAL_DEPLOYMENT_COST_PROFILE_STATUS,
    TRIAL_DEPLOYMENT_COST_PROFILE_REASONS,
    normalizeTrialDeploymentCostProfile,
    createTrialDeploymentCostResolver
} from "../game/src/trial/domain/trial_deployment_cost_resolver.js";
import { TrialDeploymentCostPolicy } from "../game/src/trial/domain/trial_deployment_cost_policy.js";
import { attachTrialDeploymentEconomy } from "../game/src/trial/integration/trial_deployment_economy_bootstrap.js";

const profile = {
    status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.RESOLVED,
    food: {
        base: 1,
        perDefense: 0.5,
        perDistance: 1.25
    },
    material: {
        base: 2,
        perDefense: 0.25,
        perDistance: 0.5
    }
};

{
    const unresolved = normalizeTrialDeploymentCostProfile(null);
    assert.equal(unresolved.resolved, false);
    assert.equal(unresolved.reason, TRIAL_DEPLOYMENT_COST_PROFILE_REASONS.PROFILE_UNRESOLVED);

    const invalid = normalizeTrialDeploymentCostProfile({
        status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.RESOLVED,
        food: { base: -1 },
        material: {}
    });
    assert.equal(invalid.resolved, false);
    assert.equal(invalid.reason, TRIAL_DEPLOYMENT_COST_PROFILE_REASONS.INVALID_PROFILE);
}

{
    const resolver = createTrialDeploymentCostResolver(profile);
    assert.equal(typeof resolver, "function");

    const result = resolver({
        requestedDefense: 4,
        distance: 3,
        boardFacts: {
            trialTraits: {
                deploymentCost: {
                    foodDelta: -1,
                    materialDelta: -2
                }
            }
        },
        origin: {
            kind: "REINFORCEMENT_ORIGIN",
            trialTraits: {
                deploymentCost: {
                    foodDelta: 2,
                    materialDelta: 1
                }
            }
        }
    });

    // raw food = 1 + 2 + 3.75 - 1 + 2 = 7.75 -> 8
    // raw material = 2 + 1 + 1.5 - 2 + 1 = 3.5 -> 4
    assert.equal(result.food, 8);
    assert.equal(result.material, 4);
    assert.deepEqual(result.breakdown.food, {
        base: 1,
        defense: 2,
        distance: 3.75,
        targetModifier: -1,
        originModifier: 2
    });
    assert.deepEqual(result.breakdown.material, {
        base: 2,
        defense: 1,
        distance: 1.5,
        targetModifier: -2,
        originModifier: 1
    });
}

{
    const resolver = createTrialDeploymentCostResolver(profile);
    const policy = new TrialDeploymentCostPolicy({ costResolver: resolver });

    const low = policy.calculate({
        requestedDefense: 2,
        distance: 1,
        boardFacts: { trialTraits: null },
        origin: { kind: "HQ", trialTraits: null }
    });
    const high = policy.calculate({
        requestedDefense: 5,
        distance: 4,
        boardFacts: { trialTraits: null },
        origin: { kind: "HQ", trialTraits: null }
    });

    assert.equal(low.resolved, true);
    assert.equal(high.resolved, true);
    assert.ok(high.food > low.food);
    assert.ok(high.material > low.material);
}

{
    assert.equal(createTrialDeploymentCostResolver({
        status: TRIAL_DEPLOYMENT_COST_PROFILE_STATUS.UNRESOLVED
    }), null);
}

{
    const engine = {
        state: { food: 10, wood: 10, material: 10, mystic: 0, currentDefense: 10 },
        getTrialAvailableDefense() {
            return this.state.currentDefense;
        },
        applyTrialDefenseLoss(amount) {
            const before = this.state.currentDefense;
            this.state.currentDefense = Math.max(0, before - amount);
            return { before, after: this.state.currentDefense, reduced: before - this.state.currentDefense };
        },
        recoverCurrentDefense(amount) {
            const before = this.state.currentDefense;
            this.state.currentDefense += amount;
            return { before, after: this.state.currentDefense, recovered: this.state.currentDefense - before };
        },
        boardDomainAdapter: {
            readTrialDeploymentFacts() {
                return {
                    cell: { r: 0, c: 1 },
                    placed: true,
                    isHQ: false,
                    terrain: { terrainId: "E1_PLAINS", elevation: 1, growthLevel: 0 },
                    capabilities: [],
                    trialTraits: null,
                    damaged: false
                };
            },
            listTrialDeploymentOrigins() {
                return [{
                    id: "HQ:0:0",
                    kind: "HQ",
                    cell: { r: 0, c: 0 },
                    capabilities: [],
                    trialTraits: null
                }];
            }
        }
    };

    const noDefenseBoundary = attachTrialDeploymentEconomy({
        state: { food: 10, wood: 10, material: 10, mystic: 0, currentDefense: 10 },
        boardDomainAdapter: engine.boardDomainAdapter
    }, { costProfile: profile });
    assert.equal(noDefenseBoundary.success, false);
    assert.equal(noDefenseBoundary.reason, "TRIAL_DEPLOYMENT_DEFENSE_BOUNDARY_REQUIRED");

    const missing = attachTrialDeploymentEconomy(engine);
    assert.equal(missing.success, false);
    assert.equal(missing.reason, "TRIAL_DEPLOYMENT_COST_POLICY_UNRESOLVED");

    const attached = attachTrialDeploymentEconomy(engine, { costProfile: profile });
    assert.equal(attached.success, true);
    assert.equal(typeof engine.trialDeploymentService?.previewAllocation, "function");
}

{
    const source = readFileSync(
        new URL("../game/src/trial/domain/trial_deployment_cost_resolver.js", import.meta.url),
        "utf8"
    );
    assert.equal(/GARRISON/.test(source), false);
    assert.equal(/frontCount/.test(source), false);
    assert.equal(/redeployment/.test(source), false);
    assert.equal(/roadMultiplier/.test(source), false, "route prototype values must not leak into deployment balance");
}

console.log("test_trial_deployment_cost_resolver: PASS");
