import { pathToFileURL } from "node:url";
import { TRIAL_BATTLE_STATUSES, TRIAL_ROUTE_PLAN_STATUSES } from "../game/src/trial/domain/trial_types.js";
import { prepareStage1, requireSuccess } from "./diagnose_stage1_board_strategy.mjs";

function measureSettlement(engine, controller) {
    const completed = requireSuccess(controller.completeTrial(), "Complete Trial");
    const settled = requireSuccess(controller.settleTrialResult(), "Settle Trial");
    const { state } = engine;
    const balances = () => ({
        stage: state.stage.id, verse: state.turn, ember: state.ember, food: state.food,
        material: state.wood, defense: state.currentDefense,
        gameOver: state.isGameOver === true
    });
    const afterTrial = balances();
    let progression = null;
    let afterFirstStage2Verse = null;
    if (state.postTrialTransition) {
        const advanced = engine.postTrialProgressionService.completeAfterPresentationCleanup();
        progression = { success: advanced.success, reason: advanced.reason ?? null };
    }
    const afterSettlement = balances();
    const defenseRebuildAtStage2 = state.stage.id === 2 ? state.getDefenseRebuildPlan() : null;
    controller.endScenario();
    if (state.stage.id === 2) {
        engine.nextTurn();
        afterFirstStage2Verse = { ...balances(), offeringSize: state.handOffering?.length ?? 0 };
    }
    return {
        outcome: completed.result.outcome,
        hqDamage: completed.hqDamage,
        actualEmberLost: completed.hqDamage.emberBefore - completed.hqDamage.emberAfter,
        runTerminated: settled.settlement.runTerminated,
        afterTrial, progression, afterSettlement, defenseRebuildAtStage2, afterFirstStage2Verse
    };
}

function measureProduction(strategy, decision, { seed, emberOverride } = {}) {
    const { engine, controller, snapshot } = prepareStage1(strategy, { seed });
    const base = { mode: "production-trial1", strategy, decision, seed: snapshot.seed, emberOverride };
    if (!snapshot.launch.started) return { ...base, blocked: snapshot.launch };
    const drafts = new Map();
    const routes = controller.getPlanningRoutes();
    for (const route of routes) {
        if (decision === "skip") {
            requireSuccess(controller.setRouteSkipped(drafts, route.id), "Skip route");
            continue;
        }
        const candidates = snapshot.interceptionCandidates.filter(candidate => candidate.routeId === route.id);
        const defense = controller.getRemainingDefense(drafts);
        if (candidates.length === 0 || defense < 1) {
            return { ...base, blocked: { reason: "NO_LEGAL_INTERCEPTION", routeId: route.id } };
        }
        requireSuccess(controller.setRouteInterceptPlan(drafts, route.id, candidates[0], defense), "Intercept route");
    }
    const confirmed = controller.confirmInterceptionPlan(drafts, { allowWarnings: true });
    if (!confirmed.success) return { ...base, blocked: { reason: confirmed.reason, errors: confirmed.errors } };
    const activated = controller.activateInterceptionPlan();
    if (!activated.success) return { ...base, blocked: { reason: activated.reason, errors: activated.errors } };

    // Controlled diagnostic input. Both shared Ember and the battle read model
    // see the same balance, while the production threat and route stay intact.
    if (emberOverride !== undefined) {
        engine.emberSystem.current = emberOverride;
        controller.state.human.ember = emberOverride;
        controller.state.ember = emberOverride;
    }
    const battles = [];
    while (battles.length < controller.state.battleQueue.length) {
        requireSuccess(controller.startNextBattle(), "Start battle");
        requireSuccess(controller.resolveCurrentBattle(), "Resolve battle");
        const traversal = requireSuccess(controller.advanceAfterCurrentBattle(), "Resolve traversal");
        battles.push(traversal.traversalResult);
        requireSuccess(controller.transitionAfterCurrentBattle(), "Advance battle queue");
    }
    return { ...base, strategicSuppression: snapshot.productionThreat, routeCount: routes.length,
        deploymentPayment: activated.deploymentCommit?.payment?.paid ?? null,
        battles, ...measureSettlement(engine, controller) };
}

function measureArrivalScenario(name, specifications, ember, seed) {
    const { engine, controller, snapshot } = prepareStage1("expansion", { seed });
    if (!snapshot.launch.started) return { mode: "diagnostic-arrival-fixture", name, blocked: snapshot.launch };
    const { state } = controller;
    const paths = [
        [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
        [{ r: 2, c: 4 }, { r: 2, c: 3 }, { r: 2, c: 2 }],
        [{ r: 4, c: 2 }, { r: 3, c: 2 }, { r: 2, c: 2 }]
    ];
    const routes = specifications.map(({ sourcePower }, index) => ({
        id: `DIAGNOSTIC_${index}`, suppression: sourcePower, cells: paths[index]
    }));
    state.routes = routes;
    state.interceptionPlan = { routes: [] };
    state.battleQueue = [];
    state.battleResults = [];
    state.traversalResults = [];
    state.currentBattleIndex = null;
    state.planActivated = true;
    state.phase = "BATTLE";
    state.human.ember = ember;
    state.ember = ember;
    engine.emberSystem.current = ember;

    for (const [index, specification] of specifications.entries()) {
        const routeId = routes[index].id;
        const { sourcePower, status } = specification;
        state.interceptionPlan.routes.push({ routeId, status: status === "skip"
            ? TRIAL_ROUTE_PLAN_STATUSES.SKIP : TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT });
        if (status === "skip") continue;
        const reachedRouteEnd = status === "breakthrough";
        state.battleQueue.push({
            routeId, status: TRIAL_BATTLE_STATUSES.RESOLVED, traversalApplied: true, sequenceAdvanced: true
        });
        state.battleResults.push({ routeId, remainingForceSuppression: sourcePower });
        state.traversalResults.push({
            routeId, reachedRouteEnd, stopped: !reachedRouteEnd, remainingForceSuppression: sourcePower
        });
    }
    return { mode: "diagnostic-arrival-fixture", name, specifications, ...measureSettlement(engine, controller) };
}

export function diagnoseStage1Survival({ seed = 20260923 } = {}) {
    const stopped = { status: "stopped", sourcePower: 0 };
    const skip = sourcePower => ({ status: "skip", sourcePower });
    const breakthrough = sourcePower => ({ status: "breakthrough", sourcePower });
    return [
        measureProduction("expansion", "intercept", { seed }),
        measureProduction("concentration", "intercept", { seed }),
        measureProduction("expansion", "skip", { seed }),
        measureProduction("concentration", "skip", { seed }),
        measureProduction("expansion", "skip", { seed, emberOverride: 1 }),
        measureArrivalScenario("all-stopped", [stopped, stopped, stopped], 6, seed),
        measureArrivalScenario("partial-skip", [stopped, skip(7), stopped], 6, seed),
        measureArrivalScenario("multi-breakthrough", [breakthrough(8), breakthrough(7), skip(5)], 5, seed),
        measureArrivalScenario("extreme-hq-arrival", [breakthrough(40), breakthrough(35), skip(25)], 20, seed)
    ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const seed = process.argv[2] === undefined ? 20260923 : Number(process.argv[2]);
    console.log(JSON.stringify(diagnoseStage1Survival({ seed }), null, 2));
}
