import { pathToFileURL } from "node:url";
import { GameEngine } from "../game/src/core/game_engine.js";
import { resolvePlacementGeometry } from "../game/src/core/placement_geometry.js";
import { enumerateSpecialBlockInstances } from "../game/src/core/special_block_instance_read_model.js";
import { captureCivilizationDevelopment } from "../game/src/trial/systems/civilization_development_snapshot_service.js";
import { TrialThreatResolver } from "../game/src/trial/systems/trial_threat_resolver.js";
import { attachTrialRuntimeSubsystems } from "../game/src/trial/integration/trial_runtime_bootstrap.js";
import { attachTrialLaunchSubsystem } from "../game/src/trial/integration/trial_launch_bootstrap.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";

export const strategies = ["expansion", "concentration", "balanced"];

const defaultHypotheses = {
    "30+4T": new TrialThreatResolver({ baseThreatByTrial: { 1: 30 }, placedBlockWeight: 4 }),
    "20+2T": new TrialThreatResolver({ baseThreatByTrial: { 1: 20 }, placedBlockWeight: 2 })
};

export function requireSuccess(result, operation) {
    if (!result?.success) {
        throw new Error(`${operation}: ${result?.reason || result?.errors?.join(", ") || "unknown error"}`);
    }
    return result;
}

function landAction(engine, card, index, trace) {
    const { state } = engine;
    const definition = card.terrain || card;
    const cost = state.gridEngine.getPlacementEmberCost();
    trace.cost = { ember: cost };
    if (cost >= state.ember) {
        trace.reason = "STRATEGY_RESERVES_LAST_EMBER";
        return null;
    }
    for (const row of state.grid) {
        for (const { r, c } of row) {
            const geometry = resolvePlacementGeometry(card, r, c);
            const check = state.canPlaceShape(
                geometry.startR, geometry.startC, geometry.shape, definition, geometry.attributeCells
            );
            if (!check?.can) continue;
            const result = engine.placeLand(r, c, card, 0, { type: "OFFERING", index });
            trace.reason = result?.reason;
            if (result?.success) return { r, c };
        }
    }
    trace.reason ??= "NO_LEGAL_UNROTATED_ANCHOR";
    return null;
}

function facilityAction(engine, card, index, trace) {
    const quote = engine.getCommandCardExecutionCost(card);
    const cost = quote?.resources || {};
    trace.cost = cost;
    const { state } = engine;
    if (quote?.success === false) {
        trace.reason = quote.reason;
        return null;
    }
    if ((cost.food || 0) > state.food || (cost.material ?? cost.wood ?? 0) > state.wood
        || (cost.mystic || 0) > state.mystic || (cost.ember || 0) >= state.ember) {
        trace.reason = "RESOURCE_BUDGET";
        return null;
    }
    const targets = engine.getCommandCardExecutionTargets(card) || [];
    trace.legalTargets = targets.length;
    if (targets.length === 0) {
        trace.reason = "NO_LEGAL_FACILITY_TARGET";
        return null;
    }
    const result = engine.playCommandCard(card, { type: "OFFERING", index }, targets[0]);
    trace.reason = result?.reason;
    return result?.success ? targets[0] : null;
}

function playVerse(engine, strategy) {
    const { state } = engine;
    const offering = (state.handOffering || []).map((card, index) => {
        const definition = card.terrain || card;
        return {
            card, index, id: card.cardMasterId || definition.id, category: definition.category,
            facility: definition.effects?.some(effect => effect.action === "CREATE_SPECIAL_BLOCK") === true
        };
    });
    const trace = {
        verse: state.turn,
        territoryForEmber: state.getTerritoryTileCount(),
        offering: offering.map(({ id, category, facility }) => ({ id, category, facility })),
        attempts: [], chosen: null, actionEmberSpent: 0, verseEmberDecrease: 0
    };
    const priorities = strategy === "expansion" ? ["LAND"]
        : strategy === "balanced" && state.turn % 2 === 1 ? ["LAND", "FACILITY"] : ["FACILITY", "LAND"];
    const landBudgetReached = strategy === "concentration"
        && captureCivilizationDevelopment(state).placedBlockCount >= 3;
    const kinds = state.turn === 8 ? ["INVESTIGATION", ...priorities] : priorities;
    for (const kind of kinds) {
        if (state.hasPickedThisTurn) break;
        if (kind === "LAND" && landBudgetReached) continue;
        for (const entry of offering) {
            if (kind === "FACILITY" ? !entry.facility : entry.category !== kind) continue;
            const attempt = { id: entry.id, kind };
            trace.attempts.push(attempt);
            const before = state.ember;
            let target;
            if (kind === "LAND") target = landAction(engine, entry.card, entry.index, attempt);
            else if (kind === "FACILITY") target = facilityAction(engine, entry.card, entry.index, attempt);
            else {
                const result = engine.executeInvestigationCard(entry.card, { type: "OFFERING", index: entry.index });
                attempt.reason = result?.reason;
                target = result?.success ? "INVESTIGATION" : null;
            }
            if (!target) continue;
            trace.chosen = { id: entry.id, kind, target };
            trace.actionEmberSpent = kind === "LAND" || kind === "FACILITY"
                ? (attempt.cost?.ember || 0) : Math.max(0, before - state.ember);
            break;
        }
        if (trace.chosen) break;
    }
    if (!trace.chosen) trace.reason = landBudgetReached ? "LAND_BUDGET_OR_NO_FACILITY" : "NO_POLICY_ACTION";
    return trace;
}

export function prepareStage1(strategy, { seed = 20260923, hypotheses = defaultHypotheses } = {}) {
    if (!strategies.includes(strategy)) throw new RangeError(`Unknown strategy: ${strategy}`);
    const engine = GameEngine.createGame({ runSeed: seed, firstRun: true });
    requireSuccess(attachTrialRuntimeSubsystems(engine), "Attach Trial runtime");
    const { state } = engine;
    const trace = [];
    while (state.turn < 15 && !state.isGameOver) {
        const entry = playVerse(engine, strategy);
        const before = state.ember;
        engine.nextTurn();
        entry.verseEmberDecrease = Math.max(0, before - state.ember);
        trace.push(entry);
        if (state.turn !== entry.verse + 1) break;
    }

    const development = captureCivilizationDevelopment(state);
    const production = engine.productionCalculator.calculateTotalProduction(state);
    const defenseYield = engine.productionCalculator.getResourceBreakdown(state).defense;
    const specialBlocks = {};
    for (const { definitionId } of enumerateSpecialBlockInstances(state)) {
        specialBlocks[definitionId] = (specialBlocks[definitionId] || 0) + 1;
    }
    const truth = engine.enemyTruthReadModel.getSnapshot();
    const controller = new TrialController({
        gameFactHub: engine.gameFactHub,
        emberSystem: engine.emberSystem,
        deploymentService: engine.trialDeploymentService,
        defenseReservation: engine.trialDefenseReservation
    });
    const snapshot = {
        strategy, seed, stage: development.stage, verse: state.turn,
        normalLandBlocks: development.placedBlockCount, normalLandCells: development.territoryTiles,
        specialBlocks,
        territoryForEmber: state.getTerritoryTileCount(),
        ember: {
            current: state.ember, max: state.maxEmber,
            actionSpent: trace.reduce((sum, entry) => sum + entry.actionEmberSpent, 0),
            verseNetDecrease: trace.reduce((sum, entry) => sum + entry.verseEmberDecrease, 0)
        },
        food: { current: state.food, gross: production.grossFood, net: production.netFood },
        material: { current: state.wood, production: production.totalMaterial },
        defense: {
            current: state.currentDefense, max: state.maxDefense,
            capacityYield: defenseYield.total,
            yieldSources: {
                hq: defenseYield.hqBase, landCells: defenseYield.tiles, landBlocks: defenseYield.blocks,
                facilities: defenseYield.specialBlocks, sockets: defenseYield.sockets
            }
        },
        zones: development.completedZones, links: development.links,
        productionThreat: truth?.strategicSuppression ?? null,
        hypothesisThreat: Object.fromEntries(Object.entries(hypotheses).map(([name, resolver]) =>
            [name, resolver.resolve({ trialIndex: 1, development }).strategicSuppression]
        )),
        trace
    };
    requireSuccess(attachTrialLaunchSubsystem(engine, {
        trialController: controller,
        startTrialSession: scenario => controller.startScenario(scenario, {
            cellResolver: (r, c) => state.grid[r]?.[c]
        })
    }), "Attach Trial launch");
    const launch = engine.retryPendingTrialLaunch();
    snapshot.launch = { started: launch?.started === true, reason: launch?.reason ?? null };
    snapshot.interceptionCandidates = controller.getPlanningRoutes().flatMap(route =>
        (route.cells || []).flatMap(point => {
            const r = point.r ?? point.row;
            const c = point.c ?? point.column;
            const candidate = controller.validateRouteInterception(route.id, { r, c }, 1);
            if (!candidate.success) return [];
            const cell = state.grid[r][c];
            return [{
                routeId: route.id, r, c, terrain: cell.terrain?.id ?? null,
                elevation: cell.terrain?.e ?? null, growth: cell.terrain?.gl ?? null,
                facility: cell.specialBlock?.definitionId ?? null
            }];
        })
    );
    return { engine, controller, snapshot };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const seed = process.argv[2] === undefined ? 20260923 : Number(process.argv[2]);
    console.log(JSON.stringify(strategies.map(strategy => prepareStage1(strategy, { seed }).snapshot), null, 2));
}
