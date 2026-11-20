import { pathToFileURL } from "node:url";
import { prepareStage1 } from "./diagnose_stage1_board_strategy.mjs";
import { generateEnemyArmyBlueprint } from "../game/src/trial/systems/enemy_army_blueprint_generator.js";
import { EnemyArmyBlueprintLifecycleService } from "../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js";
import { EnemyInvasionFoundationLifecycleService } from "../game/src/trial/systems/enemy_invasion_foundation_lifecycle_service.js";
import { Stage1EnemyParticipationTrialAdapter } from "../game/src/trial/systems/stage1_enemy_participation_trial_adapter.js";
import { TrialThreatResolver } from "../game/src/trial/systems/trial_threat_resolver.js";
import { TrialIngressResolver } from "../game/src/trial/scenario/trial_ingress_resolver.js";
import { TrialRouteCostPolicy } from "../game/src/trial/scenario/trial_route_cost_policy.js";
import { TrialRouteGenerator } from "../game/src/trial/scenario/trial_route_generator.js";
import { TrialRouteSuppressionAllocator } from "../game/src/trial/scenario/trial_route_suppression_allocator.js";
import { TrialScenarioFactory } from "../game/src/trial/scenario/trial_scenario_factory.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";

export const COMPARISON_SEEDS = Object.freeze([
    20260920, 20260921, 20260922, 20260923,
    20260924, 20260925, 20260926, 20260927
]);
export const COMPARISON_STRATEGIES = Object.freeze(["expansion", "balanced", "concentration"]);

const blueprintPolicy = Object.freeze({
    id: "diagnostic-stage1-blueprint-v1",
    version: 1,
    slots: Object.freeze({
        A: Object.freeze([{ weight: 1, composition: Object.freeze({
            speciesComposition: Object.freeze([{ type: "LARGE", share: 1 }]),
            equipmentComposition: Object.freeze([{ type: "HEAVY", share: 1 }])
        }) }]),
        B: Object.freeze([{ weight: 1, composition: Object.freeze({
            speciesComposition: Object.freeze([{ type: "MEDIUM", share: 1 }]),
            equipmentComposition: Object.freeze([{ type: "STANDARD", share: 1 }])
        }) }]),
        C: Object.freeze([{ weight: 1, composition: Object.freeze({
            speciesComposition: Object.freeze([{ type: "SMALL", share: 1 }]),
            equipmentComposition: Object.freeze([{ type: "LIGHT", share: 1 }])
        }) }])
    })
});

const directions = ["NORTH", "EAST", "SOUTH", "WEST"];

const policyDefinitions = Object.freeze([
    Object.freeze({
        id: "diagnostic-production-baseline-v1",
        formula: "20",
        threat: Object.freeze({ baseThreatByTrial: Object.freeze({ 1: 20 }) }),
        boundaries: Object.freeze([35, 70])
    }),
    Object.freeze({
        id: "diagnostic-block-pressure-v1",
        formula: "20 + 2 * blocks",
        threat: Object.freeze({ baseThreatByTrial: Object.freeze({ 1: 20 }), placedBlockWeight: 2 }),
        boundaries: Object.freeze([35, 70])
    }),
    Object.freeze({
        id: "diagnostic-territory-pressure-v1",
        formula: "20 + cells + 4 * zones + 2 * links",
        threat: Object.freeze({
            baseThreatByTrial: Object.freeze({ 1: 20 }),
            territoryWeight: 1,
            completedZoneWeight: 4,
            linkWeight: 2
        }),
        boundaries: Object.freeze([30, 50])
    })
]);

function participationPolicy(definition) {
    const [second, third] = definition.boundaries;
    return {
        enabled: true,
        id: `${definition.id}-participation`,
        version: 1,
        stageId: 1,
        trialIndex: 1,
        sourceDisposition: "CONSOLIDATE_ALL_SOURCES",
        runtimeProfileSource: "PRIMARY_SOURCE",
        participantBands: [
            { participantCount: 1, minInclusive: 0, maxExclusive: second },
            { participantCount: 2, minInclusive: second, maxExclusive: third },
            { participantCount: 3, minInclusive: third, maxExclusive: null }
        ],
        sourceWeights: { A: 3, B: 2, C: 1 },
        ingressDirectionPriority: ["NORTH", "EAST", "SOUTH", "WEST"]
    };
}

function registerDiagnosticFoundation(state, seed) {
    const blueprint = generateEnemyArmyBlueprint({ runSeed: seed, stageId: 1, policy: blueprintPolicy });
    new EnemyArmyBlueprintLifecycleService({ gameState: state }).registerBlueprint(1, blueprint);
    const base = seed % directions.length;
    const activity = [directions[base], directions[(base + 1) % 4], directions[base]];
    const snapshot = blueprint.getSnapshot();
    new EnemyInvasionFoundationLifecycleService({ gameState: state }).registerDirectionSnapshot({
        schemaVersion: 1,
        stageId: 1,
        armyId: snapshot.armyId,
        forces: snapshot.forces.map((force, index) => ({
            sourceForceId: force.id,
            slot: force.slot,
            activityDirection: activity[index]
        }))
    });
}

function buildScenario(state, definition) {
    registerDiagnosticFoundation(state, state.runSeed);
    const policy = participationPolicy(definition);
    const ingressResolver = new TrialIngressResolver({ selector: () => [] });
    const routeCostPolicy = new TrialRouteCostPolicy();
    const factory = new TrialScenarioFactory({
        threatResolver: new TrialThreatResolver(definition.threat),
        enemyParticipationAdapter: new Stage1EnemyParticipationTrialAdapter({ policy }),
        ingressResolver,
        routeGenerator: new TrialRouteGenerator({ costResolver: context => routeCostPolicy.resolve(context) }),
        suppressionAllocator: new TrialRouteSuppressionAllocator()
    });
    const result = factory.build({ trialIndex: 1, gameState: state });
    if (!result.success) throw new Error(`SCENARIO_BUILD_FAILED:${result.errors?.join(",")}`);
    return result;
}

function cellKey(cell) {
    return cell?.placementGroupId == null
        ? `cell:${cell?.r}:${cell?.c}`
        : `placement:${cell.placementGroupId}`;
}

function legalCandidates(controller, route, defense, usedBlocks = new Set()) {
    return route.cells.flatMap((point, routeIndex) => {
        const cell = controller.cellResolver(point.r, point.c);
        if (!cell || cell.isHQ || usedBlocks.has(cellKey(cell))) return [];
        const validation = controller.validateRouteInterception(route.id, point, defense);
        return validation.success ? [{ point, routeIndex, cell, preview: validation.preview }] : [];
    });
}

function resolveInformedSelections(controller, routes, allocations) {
    const candidatesByRoute = routes.map((route, index) =>
        legalCandidates(controller, route, allocations[index]).map(candidate => ({
            ...candidate,
            blockKey: cellKey(candidate.cell),
            reduction: Number(route.strategicSuppression) * 5 - (
                candidate.preview.prediction?.outcome === "REPEL"
                    ? 0
                    : candidate.preview.remainingForceSuppression
            )
        }))
    );
    let best = { score: Number.NEGATIVE_INFINITY, count: -1, depth: -1, selections: [] };
    const visit = (index, used, selections, score, depth) => {
        if (index === routes.length) {
            const count = selections.filter(Boolean).length;
            if (score > best.score || (score === best.score && count > best.count)
                || (score === best.score && count === best.count && depth > best.depth)) {
                best = { score, count, depth, selections: [...selections] };
            }
            return;
        }
        visit(index + 1, used, [...selections, null], score, depth);
        for (const candidate of candidatesByRoute[index]) {
            if (used.has(candidate.blockKey)) continue;
            const nextUsed = new Set(used);
            nextUsed.add(candidate.blockKey);
            visit(index + 1, nextUsed, [...selections, candidate],
                score + candidate.reduction, depth + candidate.routeIndex);
        }
    };
    visit(0, new Set(), [], 0, 0);
    return best.selections;
}

function planTrial(controller, mode) {
    const drafts = new Map();
    const routes = controller.getPlanningRoutes();
    const totalDefense = controller.state.human.availableDefense;
    const usedBlocks = new Set();
    let allocated = 0;
    let legalInterceptCells = 0;
    const allocations = [];
    let allocationBudget = totalDefense;
    for (let index = 0; index < routes.length; index += 1) {
        const defense = Math.max(1, Math.floor(allocationBudget / (routes.length - index)));
        allocations.push(defense);
        allocationBudget -= defense;
    }
    const informedSelections = mode === "INFORMED"
        ? resolveInformedSelections(controller, routes, allocations)
        : [];

    for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index];
        const defense = allocations[index];
        const allLegal = legalCandidates(controller, route, defense);
        legalInterceptCells += allLegal.length;
        if (mode === "UNPLANNED") {
            controller.setRouteSkipped(drafts, route.id);
            continue;
        }
        const candidates = legalCandidates(controller, route, defense, usedBlocks);
        const selected = mode === "BASIC" ? candidates[0] : informedSelections[index];
        if (!selected) {
            controller.setRouteSkipped(drafts, route.id);
            continue;
        }
        const set = controller.setRouteInterceptPlan(drafts, route.id, selected.point, defense);
        if (!set.success) throw new Error(`PLAN_FAILED:${set.reason || set.errors?.join(",")}`);
        allocated += defense;
        usedBlocks.add(cellKey(selected.cell));
    }
    return { drafts, legalInterceptCells, allocatedDefense: allocated };
}

function executeTrial(scenario, state, mode) {
    const controller = new TrialController();
    controller.startScenario(structuredClone(scenario), {
        cellResolver: (r, c) => state.grid[r]?.[c]
    });
    const plan = planTrial(controller, mode);
    const confirmed = controller.confirmInterceptionPlan(plan.drafts, { allowWarnings: true });
    if (!confirmed.success) throw new Error(`CONFIRM_FAILED:${confirmed.errors?.join(",")}`);
    const activated = controller.activateInterceptionPlan();
    if (!activated.success) throw new Error(`ACTIVATE_FAILED:${activated.errors?.join(",")}`);
    let battleCount = 0;
    while (controller.state.battleQueue?.some(entry => entry.status === "PENDING")) {
        if (!controller.startNextBattle().success) throw new Error("BATTLE_START_FAILED");
        if (!controller.resolveCurrentBattle().success) throw new Error("BATTLE_RESOLVE_FAILED");
        if (!controller.advanceAfterCurrentBattle().success) throw new Error("TRAVERSAL_FAILED");
        if (!controller.transitionAfterCurrentBattle().success) throw new Error("TRANSITION_FAILED");
        battleCount += 1;
    }
    const completion = controller.completeTrial();
    if (!completion.success) throw new Error(`COMPLETE_FAILED:${completion.errors?.join(",")}`);
    return {
        mode,
        legalInterceptCells: plan.legalInterceptCells,
        interceptionOperations: battleCount,
        allocatedDefense: plan.allocatedDefense,
        initialCombatPower: scenario.enemySuppression * 5,
        attenuationCombatPower: scenario.enemySuppression * 5 - completion.hqDamage.sourcePower,
        remainingCombatPower: completion.hqDamage.sourcePower,
        remainingStrategicEquivalent: completion.hqDamage.sourcePower / 5,
        emberDamage: completion.hqDamage.emberDamage,
        emberAfter: completion.hqDamage.emberAfter
    };
}

function evaluateDefinition(strategy, seed, definition) {
    const prepared = prepareStage1(strategy, { seed });
    const { state } = prepared.engine;
    const built = buildScenario(state, definition);
    const participation = built.scenario.enemyParticipation;
    return {
        policyId: definition.id,
        formula: definition.formula,
        status: "PROTOTYPE",
        appliesToProduction: false,
        strategy,
        seed,
        development: built.diagnostics.development,
        resources: {
            food: state.food,
            material: state.wood,
            defense: state.currentDefense,
            ember: state.ember
        },
        strategicSuppression: built.scenario.enemySuppression,
        participantCount: participation.participantCount,
        participants: participation.forces.map(force => ({
            id: force.id,
            sourceForceIds: force.sourceForceIds,
            strategicSuppression: force.strategicSuppression,
            ingressDirection: force.ingressDirection,
            ingressId: force.ingressId
        })),
        outcomes: ["UNPLANNED", "BASIC", "INFORMED"].map(mode =>
            executeTrial(built.scenario, state, mode)
        )
    };
}

export function runStage1ThreatParticipationPolicyComparison({
    seeds = COMPARISON_SEEDS,
    strategies = COMPARISON_STRATEGIES
} = {}) {
    const records = [];
    for (const definition of policyDefinitions) {
        for (const strategy of strategies) {
            for (const seed of seeds) {
                records.push(evaluateDefinition(strategy, seed, definition));
            }
        }
    }
    const boundaryDefinitions = [29, 30].map(value => ({
        id: `diagnostic-boundary-${value}-v1`,
        formula: String(value),
        threat: { baseThreatByTrial: { 1: value } },
        boundaries: [30, 50]
    }));
    const boundaryComparisons = seeds.map(seed => ({
        seed,
        strategy: "balanced",
        below: evaluateDefinition("balanced", seed, boundaryDefinitions[0]),
        at: evaluateDefinition("balanced", seed, boundaryDefinitions[1])
    }));
    return {
        policies: policyDefinitions,
        seeds: [...seeds],
        strategies: [...strategies],
        records,
        boundaryComparisons
    };
}

function range(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return { min: sorted[0], max: sorted.at(-1) };
}

export function summarizeStage1ThreatParticipationPolicyComparison(result) {
    const policies = result.policies.map(policy => {
        const rows = result.records.filter(record => record.policyId === policy.id);
        const standard = rows.filter(record => record.strategy !== "concentration");
        return {
            policyId: policy.id,
            formula: policy.formula,
            sampleCount: rows.length,
            standardSampleCount: standard.length,
            standard: {
                blocks: range(standard.map(row => row.development.placedBlockCount)),
                cells: range(standard.map(row => row.development.territoryTiles)),
                suppression: range(standard.map(row => row.strategicSuppression)),
                participants: range(standard.map(row => row.participantCount))
            },
            outcomes: Object.fromEntries(["UNPLANNED", "BASIC", "INFORMED"].map(mode => {
                const outcomes = standard.map(row => row.outcomes.find(item => item.mode === mode));
                return [mode, {
                    legalInterceptCells: range(outcomes.map(item => item.legalInterceptCells)),
                    operations: range(outcomes.map(item => item.interceptionOperations)),
                    remainingStrategicEquivalent: range(outcomes.map(item => item.remainingStrategicEquivalent)),
                    emberDamage: range(outcomes.map(item => item.emberDamage))
                }];
            }))
        };
    });
    const boundary = Object.fromEntries(["BASIC", "INFORMED"].map(mode => {
        const below = result.boundaryComparisons.map(pair =>
            pair.below.outcomes.find(item => item.mode === mode)
        );
        const at = result.boundaryComparisons.map(pair =>
            pair.at.outcomes.find(item => item.mode === mode)
        );
        return [mode, {
            below30: {
                participants: 1,
                legalInterceptCells: range(below.map(item => item.legalInterceptCells)),
                operations: range(below.map(item => item.interceptionOperations)),
                allocatedDefense: range(below.map(item => item.allocatedDefense)),
                remainingStrategicEquivalent: range(below.map(item => item.remainingStrategicEquivalent)),
                emberDamage: range(below.map(item => item.emberDamage))
            },
            at30: {
                participants: 2,
                legalInterceptCells: range(at.map(item => item.legalInterceptCells)),
                operations: range(at.map(item => item.interceptionOperations)),
                allocatedDefense: range(at.map(item => item.allocatedDefense)),
                remainingStrategicEquivalent: range(at.map(item => item.remainingStrategicEquivalent)),
                emberDamage: range(at.map(item => item.emberDamage))
            }
        }];
    }));
    return { policies, boundary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const result = runStage1ThreatParticipationPolicyComparison();
    console.log(JSON.stringify({
        summary: summarizeStage1ThreatParticipationPolicyComparison(result),
        records: result.records,
        boundaryComparisons: result.boundaryComparisons
    }, null, 2));
}
