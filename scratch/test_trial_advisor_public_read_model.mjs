import assert from "assert/strict";
import { TrialAdvisorPublicReadModel } from "../game/src/trial/presentation/trial_advisor_public_read_model.js";
import { resolveAdvisorStatus } from "../game/src/ui/advisor/advisor_status_resolver.js";

const model = new TrialAdvisorPublicReadModel();

{
    const inactive = model.project();
    assert.deepEqual(inactive, { active: false });
}

{
    const trialState = {
        trialIndex: 1,
        phase: "PLANNING",
        routes: [{ id: "route-a" }, { id: "route-b" }],
        human: { availableDefense: 9 },
        enemy: {
            strategicSuppression: 999,
            hiddenIntent: "HQ"
        },
        environment: { secret: true },
        scenario: { futureResult: "BREAKTHROUGH" }
    };
    const presentationState = {
        activeEnemyRoute: "route-a",
        selectedInterceptCell: { r: 2, c: 3 },
        interceptionPreview: {
            terrainNameKey: "TERRAIN_FOREST",
            deployedDefense: 4,
            prediction: { outcome: "REPEL", margin: 7 },
            finalEnemyPower: 123
        },
        getInterceptionPlanSummary() {
            return {
                plannedDefenseTotal: 4,
                remainingDefense: 5,
                undecidedCount: 1,
                plans: [{ routeId: "route-a" }]
            };
        }
    };

    const snapshot = model.project({ trialState, presentationState });

    assert.deepEqual(
        Object.keys(snapshot),
        [
            "active",
            "trialIndex",
            "phase",
            "routeCount",
            "activeRouteId",
            "decidedRouteCount",
            "undecidedRouteCount",
            "availableDefense",
            "plannedDefense",
            "remainingDefense",
            "selectedInterceptCell",
            "preview"
        ],
        "Advisor Trial snapshot must stay on an explicit public whitelist"
    );
    assert.equal(snapshot.active, true);
    assert.equal(snapshot.routeCount, 2);
    assert.equal(snapshot.decidedRouteCount, 1);
    assert.equal(snapshot.remainingDefense, 5);
    assert.deepEqual(snapshot.selectedInterceptCell, { r: 2, c: 3 });
    assert.deepEqual(snapshot.preview, {
        terrainNameKey: "TERRAIN_FOREST",
        deployedDefense: 4,
        outcome: "REPEL"
    });

    assert.equal("enemy" in snapshot, false);
    assert.equal("environment" in snapshot, false);
    assert.equal("scenario" in snapshot, false);
    assert.equal("strategicSuppression" in snapshot, false);
    assert.equal("hiddenIntent" in snapshot, false);
    assert.equal("finalEnemyPower" in snapshot.preview, false);
    assert.equal("margin" in snapshot.preview, false);

    presentationState.selectedInterceptCell.r = 8;
    assert.deepEqual(
        snapshot.selectedInterceptCell,
        { r: 2, c: 3 },
        "Advisor snapshot must not retain mutable presentation references"
    );

    const resolved = resolveAdvisorStatus({}, snapshot);
    assert.equal(resolved.urgency[0].key, "UI_ADVISOR_STATUS_TRIAL_ACTIVE");
    assert.deepEqual(resolved.status[0], {
        key: "UI_ADVISOR_STATUS_TRIAL_ROUTES",
        params: { decided: 1, total: 2 }
    });
    assert.deepEqual(resolved.status[1], {
        key: "UI_ADVISOR_STATUS_TRIAL_DEFENSE_REMAINING",
        params: { count: 5 }
    });
}

{
    const source = TrialAdvisorPublicReadModel.toString();
    for (const forbidden of [
        "trialState.enemy",
        "trialState.environment",
        "trialState.scenario",
        "trueEnemy",
        "hiddenIntent"
    ]) {
        assert.equal(
            source.includes(forbidden),
            false,
            `Advisor public read model must not inspect hidden Trial data: ${forbidden}`
        );
    }
}

console.log("✅ Trial Advisor public read model contract PASS");
