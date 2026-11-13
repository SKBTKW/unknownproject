import { pathToFileURL } from "node:url";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { blueprintArmyId } from "../game/src/trial/domain/enemy_army_blueprint.js";
import { EnemyArmyBlueprintLifecycleService } from "../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js";
import { EnemyInvasionFoundationLifecycleService } from "../game/src/trial/systems/enemy_invasion_foundation_lifecycle_service.js";
import { Stage1EnemyParticipationTrialAdapter } from "../game/src/trial/systems/stage1_enemy_participation_trial_adapter.js";
import { GridEngine } from "../game/src/systems/grid_engine.js";
import { SpecialBlockService } from "../game/src/systems/special_block_service.js";
import { captureCivilizationDevelopment } from "../game/src/trial/systems/civilization_development_snapshot_service.js";
import { prepareStage1 } from "./diagnose_stage1_board_strategy.mjs";

export const AUDIT_SEEDS = Object.freeze([
    20260920, 20260921, 20260922, 20260923,
    20260924, 20260925, 20260926, 20260927
]);

const PROFILES = Object.freeze([
    Object.freeze({ id: "LARGE_HEAVY", bodySize: "LARGE", equipment: ["HEAVY"] }),
    Object.freeze({ id: "MEDIUM_STANDARD", bodySize: "MEDIUM", equipment: ["STANDARD"] }),
    Object.freeze({ id: "SMALL_LIGHT", bodySize: "SMALL", equipment: ["LIGHT"] })
]);

const clone = value => value === undefined ? undefined : structuredClone(value);
const pointKey = point => `${point.r}:${point.c}`;

function cell(r, c, terrainId, e, gl, extra = {}) {
    return {
        r, c, placed: true, isHQ: false,
        placementGroupId: `AUDIT_${r}_${c}`,
        terrain: { id: terrainId, e, gl },
        ...clone(extra)
    };
}

function constructedBoard() {
    const grid = Array.from({ length: 5 }, (_, r) => Array.from(
        { length: 5 }, (_, c) => cell(r, c, "GL1_PLAINS", 1, 1)
    ));
    grid[2][2] = { ...cell(2, 2, "GL1_PLAINS", 1, 1), isHQ: true, placementGroupId: null };
    grid[0][2] = cell(0, 2, "GL1_PLAINS", 1, 1);
    grid[1][2] = cell(1, 2, "GL2_FOREST", 2, 2, {
        specialBlock: { definitionId: "PALISADE", state: "ACTIVE", orientation: "N" }
    });
    grid[2][4] = cell(2, 4, "GL0_DESERT", 0, 0);
    grid[2][3] = cell(2, 3, "E2_HILL", 2, 1, {
        specialBlock: { definitionId: "EARTHWORK", state: "ACTIVE" }
    });
    grid[4][2] = cell(4, 2, "E0_WETLAND", 0, 1);
    grid[3][2] = cell(3, 2, "GL3_DEEP_FOREST", 2, 3);
    return grid;
}

function constructedLegalBoardEvidence() {
    const grid = Array.from({ length: 5 }, (_, r) => Array.from(
        { length: 5 }, (_, c) => cell(r, c, "GL1_PLAINS", 1, 1)
    ));
    grid[2][2] = { ...cell(2, 2, "HQ", 1, 1), isHQ: true, placementGroupId: null };
    const groupA = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const groupB = [[0, 2], [0, 3], [1, 2], [1, 3]];
    for (const [r, c] of groupA) Object.assign(grid[r][c], { merged: true, mergeGroupId: "zone-a", mergeType: "2x2" });
    for (const [r, c] of groupB) {
        grid[r][c] = {
            ...cell(r, c, "GL2_FOREST", 1, 2),
            merged: true,
            mergeGroupId: "zone-b",
            mergeType: "2x2"
        };
    }
    const state = {
        turn: 15,
        stage: { id: 1, size: 5 },
        grid,
        placedBlockCount: 17,
        mergeGroupCounter: 3,
        specialBlockCounter: 1,
        mergedBlocks: {
            "zone-a": { groupId: "zone-a", terrainId: "GL1_PLAINS", zoneCategory: "PLAINS", mergeType: "2x2", cells: groupA.map(([r, c]) => ({ r, c })) },
            "zone-b": { groupId: "zone-b", terrainId: "GL2_FOREST", zoneCategory: "GL2_FOREST", mergeType: "2x2", cells: groupB.map(([r, c]) => ({ r, c })) }
        },
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        roadEdges: new Set(),
        maxEmber: 20,
        ember: 20,
        food: 100,
        wood: 100,
        material: 100,
        mystic: 100
    };
    const gridEngine = new GridEngine(state);
    const linkResult = gridEngine.checkNewMergeLinks();
    const specialBlocks = new SpecialBlockService(state);
    const validation = specialBlocks.validateTarget("PALISADE", { r: 4, c: 4 });
    const creation = validation.valid
        ? specialBlocks.createSpecialBlock("PALISADE", { r: 4, c: 4 }, { orientation: "N", verse: 15 })
        : { success: false };
    const development = captureCivilizationDevelopment(state);
    return {
        classification: "CONSTRUCTED_LEGAL",
        standardPlayClaim: false,
        completedZones: development.completedZones,
        links: development.links,
        linkIds: [...state.mergeLinks],
        linkResolvedByGridEngine: linkResult.count === 1,
        specialBlock: "PALISADE",
        specialBlockValidatedByService: validation.valid === true && creation.success === true,
        combatProjection: {
            zonesPassedToBattleContext: false,
            linksPassedToBattleContext: false,
            numericPalisadeMultiplierConfiguredByDefault: false
        }
    };
}

function constructedScenario() {
    const forces = [
        { id: "AUDIT_PARTICIPANT_ABC", role: "MAIN", strategicSuppression: 12, profile: clone(PROFILES[0]), commander: { level: 4 }, sourceForceIds: ["AUDIT_ARMY_A", "AUDIT_ARMY_B", "AUDIT_ARMY_C"] },
        { id: "AUDIT_PARTICIPANT_B", role: "DETACHMENT", strategicSuppression: 9, profile: clone(PROFILES[1]), commander: { level: 2 }, sourceForceIds: ["AUDIT_ARMY_B"] },
        { id: "AUDIT_PARTICIPANT_C", role: "DETACHMENT", strategicSuppression: 6, profile: clone(PROFILES[2]), commander: { level: 3 }, sourceForceIds: ["AUDIT_ARMY_C"] }
    ];
    const route = (id, force, cells) => ({
        id, forceId: force.id, forceRole: force.role,
        commander: clone(force.commander), forceProfile: clone(force.profile),
        strategicSuppression: force.strategicSuppression, cells
    });
    return {
        id: "STAGE1_TACTICAL_CAUSAL_AUDIT", trialIndex: 1,
        enemySuppression: 27, availableDefense: 12, ember: 20, maxEmber: 20, mystic: 0,
        armyStructure: { strategicSuppression: 27, forceCount: 3, routeCount: 3, commander: { level: 4 }, forces: clone(forces) },
        forces: clone(forces),
        environment: { weather: null, timeBand: null, visibility: null },
        routes: [
            route("AUDIT_ROUTE_NORTH", forces[0], [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }]),
            route("AUDIT_ROUTE_EAST", forces[1], [{ r: 2, c: 4 }, { r: 2, c: 3 }, { r: 2, c: 2 }]),
            route("AUDIT_ROUTE_SOUTH", forces[2], [{ r: 4, c: 2 }, { r: 3, c: 2 }, { r: 2, c: 2 }])
        ]
    };
}

function makeController(scenario, grid) {
    const controller = new TrialController();
    controller.startScenario(clone(scenario), {
        cellResolver: (r, c) => grid?.[r]?.[c] || null,
        useCanonicalDefenseReservation: false
    });
    return controller;
}

function candidateRecord(controller, grid, route, point, defenseAllocation) {
    const checked = controller.validateRouteInterception(route.id, point, defenseAllocation);
    if (!checked.success) return null;
    const input = checked.input;
    const preview = checked.preview;
    const boardCell = grid[point.r][point.c];
    return {
        routeId: route.id,
        location: { r: point.r, c: point.c },
        terrainId: boardCell?.terrain?.id || null,
        elevation: boardCell?.terrain?.e ?? null,
        growthLevel: boardCell?.terrain?.gl ?? null,
        specialBlock: boardCell?.specialBlock?.definitionId || null,
        defenseAllocation,
        deployment: clone(input.enemyDeployment?.deployment || null),
        terrainInteraction: clone(input.enemyDeployment?.interaction || null),
        selectedTactic: clone(input.enemySelectedTactic || null),
        appliedModifiers: clone(preview.appliedModifiers || []),
        outcome: preview.prediction?.outcome || null,
        humanFinalPower: preview.human?.finalPower ?? null,
        enemyFinalPower: preview.enemy?.finalPower ?? null,
        remainingForceSuppression: preview.remainingForceSuppression,
        reduction: (Number(route.strategicSuppression) * 5) - Number(preview.remainingForceSuppression)
    };
}

function listCandidates(controller, grid, route, defenseAllocation) {
    return route.cells.flatMap(point => {
        const candidate = candidateRecord(controller, grid, route, point, defenseAllocation);
        return candidate ? [candidate] : [];
    });
}

function causalProjection(snapshot) {
    return {
        facts: (snapshot?.initialFacts || []).map(row => row.type),
        causes: (snapshot?.causes || []).map(row => ({ type: row.type, state: row.state })),
        consequences: (snapshot?.consequences || []).map(row => row.type),
        battleState: clone(snapshot?.battleState || null),
        normalOutcome: clone(snapshot?.normalOutcome || null)
    };
}

function commitPlan({ scenario, grid, choices, label, controller: suppliedController = null }) {
    const controller = suppliedController || makeController(scenario, grid);
    const drafts = new Map();
    for (const route of controller.getPlanningRoutes()) {
        const choice = choices[route.id];
        const result = !choice || choice.type === "SKIP"
            ? controller.setRouteSkipped(drafts, route.id)
            : controller.setRouteInterceptPlan(drafts, route.id, choice.location, choice.defenseAllocation);
        if (!result.success) throw new Error(`${label}:PLAN:${route.id}:${result.reason}`);
    }
    const confirmed = controller.confirmInterceptionPlan(drafts, { allowWarnings: true });
    if (!confirmed.success) throw new Error(`${label}:CONFIRM:${confirmed.errors?.join(",")}`);
    const activated = controller.activateInterceptionPlan();
    if (!activated.success) throw new Error(`${label}:ACTIVATE:${activated.errors?.join(",")}`);

    const battles = [];
    const interceptCount = Object.values(choices).filter(choice => choice?.type === "INTERCEPT").length;
    for (let index = 0; index < interceptCount; index += 1) {
        if (!controller.startNextBattle().success) throw new Error(`${label}:START:${index}`);
        const resolved = controller.resolveCurrentBattle();
        if (!resolved.success) throw new Error(`${label}:RESOLVE:${index}`);
        if (resolved.pendingOpportunity && !controller.declineCurrentBattleOpportunity().success) {
            throw new Error(`${label}:DECLINE:${index}`);
        }
        const snapshot = controller.getBattleResolutionSnapshot(index);
        const advanced = controller.advanceAfterCurrentBattle();
        if (!advanced.success) throw new Error(`${label}:ADVANCE:${index}`);
        const transitioned = controller.transitionAfterCurrentBattle();
        if (!transitioned.success) throw new Error(`${label}:TRANSITION:${index}`);
        battles.push({
            battleIndex: index,
            routeId: snapshot?.routeId || null,
            combat: clone(snapshot?.normalOutcome || null),
            causal: causalProjection(snapshot)
        });
    }
    const completed = controller.completeTrial();
    if (!completed.success) throw new Error(`${label}:COMPLETE:${completed.errors?.join(",")}`);
    return {
        label, choices: clone(choices),
        defenseUsed: Object.values(choices).reduce((sum, choice) => sum + (choice?.defenseAllocation || 0), 0),
        operationCount: Object.keys(choices).length,
        battles,
        remainingSuppression: completed.hqDamage.sourcePower,
        emberDamage: completed.hqDamage.emberDamage,
        emberAfter: completed.hqDamage.emberAfter
    };
}

function firstChoices(routes, candidatesByRoute, allocations) {
    return Object.fromEntries(routes.map((route, index) => [route.id, {
        type: "INTERCEPT",
        location: clone(candidatesByRoute[route.id][0].location),
        defenseAllocation: allocations[index]
    }]));
}

function bestCandidate(candidates) {
    return [...candidates].sort((a, b) => (
        a.remainingForceSuppression - b.remainingForceSuppression
        || a.terrainId.localeCompare(b.terrainId)
        || pointKey(a.location).localeCompare(pointKey(b.location))
    ))[0];
}

function allocationVectors(count, budget) {
    const rows = [];
    const visit = (index, remaining, values) => {
        if (index === count) return rows.push([...values]);
        for (let value = 0; value <= remaining; value += 1) {
            values.push(value); visit(index + 1, remaining - value, values); values.pop();
        }
    };
    visit(0, budget, []);
    return rows;
}

const cartesian = rows => rows.reduce(
    (products, values) => products.flatMap(product => values.map(value => [...product, value])),
    [[]]
);

function exhaustiveUpperBound(scenario, grid) {
    const controller = makeController(scenario, grid);
    const routes = controller.getPlanningRoutes();
    const locations = routes.map(route => listCandidates(controller, grid, route, 0).map(row => row.location));
    const options = locations.map(points => [null, ...points]);
    const allocations = allocationVectors(routes.length, scenario.availableDefense);
    const cache = new Map();
    let best = null;
    let evaluated = 0;
    for (const allocation of allocations) {
        for (const selected of cartesian(options)) {
            if (selected.some((point, index) => point === null && allocation[index] !== 0)) continue;
            const choices = {};
            let remaining = 0;
            for (let index = 0; index < routes.length; index += 1) {
                const route = routes[index];
                const point = selected[index];
                if (!point) {
                    choices[route.id] = { type: "SKIP" };
                    remaining += Number(route.strategicSuppression) * 5;
                    continue;
                }
                const key = `${route.id}|${pointKey(point)}|${allocation[index]}`;
                const candidate = cache.get(key) || candidateRecord(controller, grid, route, point, allocation[index]);
                cache.set(key, candidate);
                choices[route.id] = { type: "INTERCEPT", location: clone(point), defenseAllocation: allocation[index] };
                remaining += Number(candidate.remainingForceSuppression);
            }
            evaluated += 1;
            const score = [Math.ceil(remaining / 5), remaining, selected.filter(Boolean).length, allocation.reduce((a, b) => a + b, 0)];
            if (!best || score.some((value, index) => value < best.score[index]
                && score.slice(0, index).every((prior, priorIndex) => prior === best.score[priorIndex]))) {
                best = { score, choices, remaining };
            }
        }
    }
    const committed = commitPlan({ scenario, grid, choices: best.choices, label: "C6_EXHAUSTIVE_DIAGNOSTIC_CEILING" });
    return {
        ...committed,
        search: {
            allocationVectors: allocations.length,
            locationCombinations: options.reduce((total, row) => total * row.length, 1),
            evaluated,
            cutoff: null,
            informationScope: "TRUE_RUNTIME_PREVIEW_DIAGNOSTIC_ONLY",
            predictedRemainingSuppression: best.remaining,
            committedResultMatchesPreview: best.remaining === committed.remainingSuppression
        }
    };
}

function constructedPolicyComparison() {
    const grid = constructedBoard();
    const scenario = constructedScenario();
    const controller = makeController(scenario, grid);
    const routes = controller.getPlanningRoutes();
    const equal = [4, 4, 4];
    const candidates = Object.fromEntries(routes.map((route, index) => [
        route.id, listCandidates(controller, grid, route, equal[index])
    ]));
    const skip = Object.fromEntries(routes.map(route => [route.id, { type: "SKIP" }]));
    const equalChoices = firstChoices(routes, candidates, equal);
    const terrainChoices = Object.fromEntries(routes.map((route, index) => {
        const candidate = bestCandidate(candidates[route.id]);
        return [route.id, { type: "INTERCEPT", location: clone(candidate.location), defenseAllocation: equal[index] }];
    }));
    const strategies = [
        commitPlan({ scenario, grid, choices: skip, label: "C1_NO_INTERCEPTION" }),
        commitPlan({ scenario, grid, choices: equalChoices, label: "C2_EQUAL" }),
        commitPlan({ scenario, grid, choices: firstChoices(routes, candidates, [10, 1, 1]), label: "C3_MAIN_FORCE_CONCENTRATION" }),
        commitPlan({ scenario, grid, choices: terrainChoices, label: "C4_TERRAIN_PRIORITY" }),
        commitPlan({ scenario, grid, choices: firstChoices(routes, candidates, [6, 4, 2]), label: "C5_SUPPRESSION_PRIORITY" }),
        exhaustiveUpperBound(scenario, grid)
    ];
    const main = routes.find(route => route.id === "AUDIT_ROUTE_NORTH");
    const locationComparison = candidates[main.id].map(candidate => {
        const choices = clone(equalChoices);
        choices[main.id].location = clone(candidate.location);
        const run = commitPlan({ scenario, grid, choices, label: `LOCATION_${pointKey(candidate.location)}` });
        const battle = run.battles.find(row => row.routeId === main.id);
        return { ...candidate, trialRemainingSuppression: run.remainingSuppression, emberDamage: run.emberDamage, causal: battle?.causal || null };
    });
    return {
        boardClassification: "SYNTHETIC",
        legalFixturePurpose: "COMBAT_DOMAIN_COMPARISON_ONLY",
        board: {
            zones: 1, links: 1, specialBlocks: ["PALISADE", "EARTHWORK"],
            notes: "Zone/link counts are audit metadata; production combat receives neither value."
        },
        scenario: clone(scenario), legalCandidatesByRoute: candidates, strategies, locationComparison,
        spread: {
            bestEmberDamage: Math.min(...strategies.map(row => row.emberDamage)),
            worstEmberDamage: Math.max(...strategies.map(row => row.emberDamage)),
            bestRemainingSuppression: Math.min(...strategies.map(row => row.remainingSuppression)),
            worstRemainingSuppression: Math.max(...strategies.map(row => row.remainingSuppression))
        }
    };
}

function profileMatrix() {
    const terrains = [
        { id: "OPEN", terrainId: "GL1_PLAINS", e: 0, gl: 1 },
        { id: "FOREST", terrainId: "GL2_FOREST", e: 0, gl: 2 },
        { id: "HILL", terrainId: "E2_HILL", e: 2, gl: 1 },
        { id: "DEEP_FOREST", terrainId: "GL3_DEEP_FOREST", e: 0, gl: 3 }
    ];
    const rows = [];
    for (const profile of PROFILES) for (const terrain of terrains) {
        const grid = [[cell(0, 0, "GL1_PLAINS", 0, 1), cell(0, 1, terrain.terrainId, terrain.e, terrain.gl), { ...cell(0, 2, "GL1_PLAINS", 0, 1), isHQ: true }]];
        const force = { id: `PROFILE_${profile.id}`, role: "MAIN", strategicSuppression: 12, profile: clone(profile), commander: { level: 4 } };
        const scenario = {
            id: `${profile.id}_${terrain.id}`, trialIndex: 1, enemySuppression: 12,
            availableDefense: 4, ember: 20, maxEmber: 20, mystic: 0,
            armyStructure: { strategicSuppression: 12, forceCount: 1, routeCount: 1, forces: [force] },
            forces: [force], environment: {},
            routes: [{ id: "PROFILE_ROUTE", forceId: force.id, commander: clone(force.commander), forceProfile: clone(force.profile), strategicSuppression: 12, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] }]
        };
        const controller = makeController(scenario, grid);
        const candidate = candidateRecord(controller, grid, controller.getPlanningRoutes()[0], { r: 0, c: 1 }, 4);
        const run = commitPlan({ scenario, grid, choices: { PROFILE_ROUTE: { type: "INTERCEPT", location: { r: 0, c: 1 }, defenseAllocation: 4 } }, label: `${profile.id}_${terrain.id}` });
        rows.push({
            profile: profile.id, terrain: terrain.id,
            deploymentRatio: candidate.deployment?.deploymentRatio ?? null,
            deployedSuppression: candidate.deployment?.deployedSuppression ?? null,
            reserveSuppression: candidate.deployment?.reserveSuppression ?? null,
            selectedTactic: candidate.selectedTactic?.id || null,
            tacticAppliedNumerically: candidate.appliedModifiers.some(row => row.source === candidate.selectedTactic?.id),
            appliedModifiers: candidate.appliedModifiers.map(row => row.source),
            remainingSuppression: run.remainingSuppression, emberDamage: run.emberDamage,
            causal: run.battles[0]?.causal || null
        });
    }
    return rows;
}

function primarySourceProjection() {
    const seed = 20260923;
    const armyId = blueprintArmyId(seed, 1);
    const state = { runSeed: seed, stage: { id: 1 } };
    const slots = ["A", "B", "C"];
    new EnemyArmyBlueprintLifecycleService({ gameState: state }).registerBlueprint(1, {
        schemaVersion: 1, runSeed: seed, stageId: 1, armyId,
        generationPolicy: { id: "tactical-causal-audit", version: 1 },
        forces: slots.map((slot, index) => ({
            id: `${armyId}_${slot}`, slot,
            composition: {
                speciesComposition: [{ type: ["LARGE", "MEDIUM", "SMALL"][index], share: 1 }],
                equipmentComposition: [{ type: ["HEAVY", "STANDARD", "LIGHT"][index], share: 1 }]
            }
        }))
    });
    new EnemyInvasionFoundationLifecycleService({ gameState: state }).registerDirectionSnapshot({
        schemaVersion: 1, stageId: 1, armyId,
        forces: slots.map(slot => ({ sourceForceId: `${armyId}_${slot}`, slot, activityDirection: "NORTH" }))
    });
    state.knownEnemyState = { reports: [{ id: "KNOWN_PRIMARY_ONLY", observations: [{ subject: { scope: "SOURCE_FORCE", sourceForceId: `${armyId}_A` }, fields: { bodySize: "LARGE", equipmentClass: "HEAVY" } }] }] };
    const knownBefore = clone(state.knownEnemyState);
    const adapter = new Stage1EnemyParticipationTrialAdapter({ policy: {
        enabled: true, id: "audit-primary-source", version: 1, stageId: 1, trialIndex: 1,
        sourceDisposition: "CONSOLIDATE_ALL_SOURCES", runtimeProfileSource: "PRIMARY_SOURCE",
        participantBands: [
            { participantCount: 1, minInclusive: 0, maxExclusive: 30 },
            { participantCount: 2, minInclusive: 30, maxExclusive: 60 },
            { participantCount: 3, minInclusive: 60, maxExclusive: null }
        ],
        sourceWeights: { A: 3, B: 2, C: 1 },
        ingressDirectionPriority: ["NORTH", "EAST", "SOUTH", "WEST"]
    } });
    const snapshot = adapter.resolve({
        gameState: state, trialIndex: 1, strategicSuppression: 27,
        ingressCandidates: [{ id: "NORTH_ENTRY", r: 0, c: 2, edges: ["NORTH"] }]
    });
    const participant = snapshot.forces[0];
    const serializedKnown = JSON.stringify(state.knownEnemyState);
    return {
        runtimeProfileSource: snapshot.policy.runtimeProfileSource,
        sourceProfiles: participant.sourceForces.map(force => ({
            sourceForceId: force.id,
            species: force.composition.speciesComposition.map(row => row.type),
            equipment: force.composition.equipmentComposition.map(row => row.type)
        })),
        runtimeProfile: clone(participant.profile),
        ignoredSourceForceIds: participant.sourceForceIds.filter(id => id !== participant.primarySourceForceId),
        knownStateUnchanged: serializedKnown === JSON.stringify(knownBefore),
        knownScope: "SOURCE_FORCE_A_ONLY",
        truthLeakDetected: serializedKnown.includes(`${armyId}_B`) || serializedKnown.includes(`${armyId}_C`)
    };
}

function informationValue(constructed) {
    const candidates = constructed.legalCandidatesByRoute.AUDIT_ROUTE_NORTH;
    const uninvestigated = candidates[0];
    const known = [...candidates].sort((a, b) => a.deployment.deploymentRatio - b.deployment.deploymentRatio)[0];
    const truth = bestCandidate(candidates);
    const result = candidate => constructed.locationComparison.find(row => pointKey(row.location) === pointKey(candidate.location));
    return [
        { id: "F1_UNINVESTIGATED", informationScope: "PUBLIC_BOARD_AND_ROUTE_ONLY", selectedLocation: clone(uninvestigated.location), emberDamage: result(uninvestigated).emberDamage, decisionBasis: "FIRST_LEGAL_LOCATION" },
        { id: "F2_KNOWN_ENEMY_STATE", informationScope: "SOURCE_FORCE_A_BODY_AND_EQUIPMENT_ONLY", selectedLocation: clone(known.location), emberDamage: result(known).emberDamage, decisionBasis: "KNOWN_LARGE_HEAVY_PREFERS_CONSTRAINED_DEPLOYMENT" },
        { id: "F3_TRUE_STATE_DIAGNOSTIC_CEILING", informationScope: "TRUE_RUNTIME_PREVIEW_DIAGNOSTIC_ONLY", selectedLocation: clone(truth.location), emberDamage: result(truth).emberDamage, decisionBasis: "MINIMUM_ACTUAL_REMAINING_FORCE_SUPPRESSION" }
    ];
}

function naturalSample(seed, strategy) {
    const prepared = prepareStage1(strategy, { seed, hypotheses: {} });
    const snapshot = prepared.snapshot;
    const availableDefense = prepared.controller.state?.human?.availableDefense || 0;
    const fixedDefense = Math.min(3, availableDefense);
    const routes = prepared.controller.getPlanningRoutes();
    const skipChoices = Object.fromEntries(routes.map(route => [route.id, { type: "SKIP" }]));
    const skipRun = commitPlan({ controller: prepared.controller, choices: skipChoices, label: `${seed}_${strategy}_SKIP` });
    const candidates = snapshot.interceptionCandidates.map(candidate => {
        const fresh = prepareStage1(strategy, { seed, hypotheses: {} });
        const choices = Object.fromEntries(fresh.controller.getPlanningRoutes().map(route => [route.id, { type: "SKIP" }]));
        choices[candidate.routeId] = { type: "INTERCEPT", location: { r: candidate.r, c: candidate.c }, defenseAllocation: fixedDefense };
        const run = commitPlan({ controller: fresh.controller, choices, label: `${seed}_${strategy}_${candidate.routeId}_${candidate.r}_${candidate.c}` });
        const battle = run.battles.find(row => row.routeId === candidate.routeId);
        return {
            routeId: candidate.routeId, location: { r: candidate.r, c: candidate.c },
            terrain: candidate.terrain, elevation: candidate.elevation, growth: candidate.growth, facility: candidate.facility,
            defenseAllocation: fixedDefense, remainingSuppression: run.remainingSuppression, emberDamage: run.emberDamage,
            modifiers: battle?.combat?.appliedModifiers?.map(row => row.source) || [],
            facts: battle?.causal?.facts || [], causes: battle?.causal?.causes?.map(row => row.type) || [],
            consequences: battle?.causal?.consequences || [], normalOutcome: battle?.causal?.normalOutcome || null
        };
    });
    const ordered = [...candidates].sort((a, b) => a.remainingSuppression - b.remainingSuppression || pointKey(a.location).localeCompare(pointKey(b.location)));
    return {
        seed, strategy, boardClassification: "NATURAL",
        board: {
            blocks: snapshot.normalLandBlocks, cells: snapshot.normalLandCells,
            zones: snapshot.zones, links: snapshot.links, specialBlocks: clone(snapshot.specialBlocks),
            defense: snapshot.defense.current
        },
        routeCount: routes.length, fixedDefense,
        skip: { remainingSuppression: skipRun.remainingSuppression, emberDamage: skipRun.emberDamage },
        candidates, best: ordered[0] || null, worst: ordered.at(-1) || null,
        decisionImpact: ordered.length ? {
            emberDamageRange: ordered.at(-1).emberDamage - ordered[0].emberDamage,
            remainingSuppressionRange: ordered.at(-1).remainingSuppression - ordered[0].remainingSuppression,
            bestVsSkipEmberImprovement: skipRun.emberDamage - ordered[0].emberDamage
        } : null
    };
}

export const connectionMatrix = Object.freeze([
    { input: "terrain type", classification: "EFFECTIVE", evidence: "TrialTerrainEffectResolver + EnemyForceTerrainInteractionResolver" },
    { input: "elevation E", classification: "EFFECTIVE", evidence: "HIGH_GROUND modifier" },
    { input: "growth GL", classification: "CONTEXT_ONLY", evidence: "Projected; no combat modifier reads GL" },
    { input: "zone", classification: "NOT_CONNECTED", evidence: "Threat input only; absent from production combat" },
    { input: "link", classification: "NOT_CONNECTED", evidence: "Threat input only; battle links remain empty" },
    { input: "special block", classification: "EFFECTIVE_AND_CONTEXT_ONLY", evidence: "interception/suppressTerrainTactic effective; default tactic multiplier null" },
    { input: "enemy species/body size", classification: "EFFECTIVE", evidence: "Deployment ratio and reserve split" },
    { input: "active equipment class", classification: "EFFECTIVE", evidence: "Deployment/mobility adjustments" },
    { input: "reserved equipment", classification: "CONTEXT_ONLY", evidence: "Excluded from active equipment contract" },
    { input: "selected enemy tactic", classification: "CONTEXT_ONLY", evidence: "Selected/snapshotted; no combat modifier" },
    { input: "human basic tactic", classification: "NOT_CONNECTED", evidence: "No production combat input" },
    { input: "time/weather/visibility", classification: "CONTEXT_ONLY", evidence: "No TrialCombatResolver effect" },
    { input: "enemy force relationships", classification: "PROTOTYPE", evidence: "Development causal model only" },
    { input: "Human Engagement Origin", classification: "CONTEXT_ONLY", evidence: "Spatial snapshot only" },
    { input: "allocated defense", classification: "EFFECTIVE", evidence: "Defense x5 becomes interception power" }
]);

export function runStage1TacticalDecisionCausalImpactAudit({ seeds = AUDIT_SEEDS } = {}) {
    const constructed = constructedPolicyComparison();
    const natural = seeds.flatMap(seed => ["expansion", "balanced"].map(strategy => naturalSample(seed, strategy)));
    const profiles = profileMatrix();
    const primarySource = primarySourceProjection();
    const information = informationValue(constructed);
    const constructedLegalBoard = constructedLegalBoardEvidence();
    return {
        schemaVersion: 1,
        generatedBy: "diagnose_stage1_tactical_decision_causal_impact_v1.mjs",
        scope: "STAGE1_TACTICAL_DECISION_CAUSAL_IMPACT_AUDIT_ONLY",
        productionMutation: false,
        productionDefaultsChanged: false,
        seeds: [...seeds],
        connectionMatrix: clone(connectionMatrix),
        natural, constructedLegalBoard, constructed, profiles, primarySource, information,
        summary: {
            naturalSamples: natural.length,
            naturalSamplesWithDecisionDelta: natural.filter(row => row.decisionImpact?.remainingSuppressionRange > 0).length,
            naturalSamplesWithNoDecisionDelta: natural.filter(row => row.decisionImpact?.remainingSuppressionRange === 0).length,
            naturalZoneSamples: natural.filter(row => row.board.zones > 0).length,
            naturalLinkSamples: natural.filter(row => row.board.links > 0).length,
            constructedBestWorstEmberGap: constructed.spread.worstEmberDamage - constructed.spread.bestEmberDamage,
            constructedBestWorstSuppressionGap: constructed.spread.worstRemainingSuppression - constructed.spread.bestRemainingSuppression
        }
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.log(JSON.stringify(runStage1TacticalDecisionCausalImpactAudit(), null, 2));
}
