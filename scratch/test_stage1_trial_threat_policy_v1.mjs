import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { TrialThreatResolver } from "../game/src/trial/systems/trial_threat_resolver.js";
import { EnemyArmyStructureResolver } from "../game/src/trial/systems/enemy_army_structure_resolver.js";
import {
    STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION,
    createStage1TrialThreatResolverV1
} from "../game/src/trial/config/stage1_trial_threat_policy_v1.js";

console.log("\nStage1 Trial1 threat policy v1");

{
    const neutral = new TrialThreatResolver();
    const result = neutral.resolve({
        trialIndex: 1,
        development: {
            stage: 1,
            placedBlockCount: 99,
            territoryTiles: 99,
            completedZones: 99,
            links: 99
        }
    });
    assert.equal(
        result.strategicSuppression,
        0,
        "pure TrialThreatResolver default must remain behavior-neutral"
    );
}

{
    const resolver = createStage1TrialThreatResolverV1();

    const trial1 = resolver.resolve({
        trialIndex: 1,
        development: {
            stage: 1,
            placedBlockCount: 99,
            territoryTiles: 99,
            completedZones: 99,
            links: 99
        }
    });
    assert.equal(
        trial1.strategicSuppression,
        STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION,
        "Stage1 v1 must provide the canonical Trial1 base threat"
    );
    assert.deepEqual(trial1.breakdown, {
        baseThreat: STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION,
        placedBlockThreat: 0,
        territoryThreat: 0,
        completedZoneThreat: 0,
        linkThreat: 0,
        stageThreat: 0
    });

    const trial2 = resolver.resolve({
        trialIndex: 2,
        development: {
            stage: 2,
            placedBlockCount: 99,
            territoryTiles: 99,
            completedZones: 99,
            links: 99
        }
    });
    assert.equal(
        trial2.strategicSuppression,
        0,
        "Stage1 v1 must not invent Trial2 balance"
    );
}

{
    const army = new EnemyArmyStructureResolver().resolve({
        strategicSuppression: STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION,
        trialIndex: 1
    });
    assert.equal(army.forceCount, 1, "Trial1 base threat must remain in the one-force teaching band");
    assert.equal(army.routeCount, 1, "Trial1 base threat must produce exactly one canonical route");
    assert.equal(army.commander?.level, 1, "Trial1 commander must stay at the introductory level");
    assert.equal(army.forces.length, 1);
    assert.equal(
        army.forces[0].strategicSuppression,
        STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION
    );
}

{
    const engine = GameEngine.createGame({
        runSeed: 20260924,
        firstRun: true
    });

    assert.equal(
        engine.trialThreatStateService?.getCurrentThreat?.()?.strategicSuppression,
        STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION,
        "production GameEngine composition must use Stage1 Trial1 threat policy v1"
    );

    // Materialize the already-configured Threat through the normal Verse-boundary
    // transition so Enemy Truth consumes the canonical value.
    engine.trialThreatStateService.markDirty({ source: "STAGE1_THREAT_POLICY_REGRESSION" });
    const before = engine.state.turn;
    engine.nextTurn();
    assert.equal(engine.state.turn, before + 1);

    const truth = engine.enemyTruthReadModel?.getSnapshot?.() || null;
    assert.equal(
        truth?.strategicSuppression,
        STAGE1_TRIAL1_BASE_STRATEGIC_SUPPRESSION,
        "Enemy Truth must receive the production Trial1 suppression"
    );
    assert.equal(
        truth?.armyStructure?.forceCount,
        1,
        "Enemy Truth must expose one Trial1 force"
    );
    assert.equal(
        truth?.armyStructure?.routeCount,
        1,
        "Enemy Truth must expose one Trial1 route"
    );
}

{
    const neutralOverride = new TrialThreatResolver();
    const engine = GameEngine.createGame({
        runSeed: 20260925,
        trialThreatResolver: neutralOverride
    });

    assert.equal(
        engine.trialThreatStateService?.getCurrentThreat?.()?.strategicSuppression,
        0,
        "explicit host/test resolver injection must override production Stage1 policy"
    );
}

console.log("✅ Stage1 Trial1 threat policy v1 PASS");
