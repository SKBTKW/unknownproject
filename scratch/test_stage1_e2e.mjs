import assert from "node:assert/strict";
import fs from "node:fs";

import { GameEngine } from "../game/src/core/game_engine.js";
import { resolvePlacementGeometry } from "../game/src/core/placement_geometry.js";
import { WARNING_STATES } from "../game/src/warning/domain/warning_state.js";
import { attachTrialRuntimeSubsystems } from "../game/src/trial/integration/trial_runtime_bootstrap.js";
import { attachTrialLaunchSubsystem } from "../game/src/trial/integration/trial_launch_bootstrap.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { PostTrialInterludeProgressService } from "../game/src/trial/systems/post_trial_interlude_progress_service.js";
import { PostTrialInterludePresentationBridge } from "../game/src/trial/presentation/post_trial_interlude_presentation_bridge.js";

const failures = [];
let passed = 0;

function check(condition, message, details = null) {
    if (condition) {
        passed += 1;
        console.log(`  PASS: ${message}`);
        return;
    }
    failures.push({ message, details });
    console.error(`  FAIL: ${message}${details ? ` -- ${details}` : ""}`);
}

// Final integration audit: owner-focused suites run before this file in Full Inspection.
console.log("\nStage1 E2E boundary audit");

const engine = GameEngine.createGame({
    runSeed: 20260923,
    firstRun: true
});

check(engine.state.turn === 1, "Game starts at Verse 1");
check(engine.state.stage?.id === 1 && engine.state.grid?.length === 5, "Stage1 starts on 5x5 board");

const initialOffering = engine.state.handOffering || [];
check(initialOffering.length > 0, "Verse1 Offering exists");
check(
    initialOffering.some(card => {
        const definition = card?.terrain || card;
        return definition?.category === "LAND" && engine.deckManager?._isCardPlaceableNow?.(card) === true;
    }),
    "Verse1 Offering contains an actually placeable LAND"
);

const runtime = attachTrialRuntimeSubsystems(engine);
check(runtime?.success === true, "Trial runtime subsystems attach to the live GameEngine");
check(Boolean(engine.trialDueStateService), "TrialDueState authority is attached");
check(Boolean(engine.postTrialProgressionService), "PostTrial progression authority is attached");

function findLegalLandPlacement() {
    const size = engine.state.stage?.size || engine.state.grid?.length || 5;
    for (let index = 0; index < (engine.state.handOffering || []).length; index += 1) {
        const card = engine.state.handOffering[index];
        const definition = card?.terrain || card;
        if (definition?.category !== "LAND") continue;
        for (let r = 0; r < size; r += 1) {
            for (let c = 0; c < size; c += 1) {
                const placement = resolvePlacementGeometry(card, r, c);
                const checkResult = engine.state.canPlaceShape?.(
                    placement.startR,
                    placement.startC,
                    placement.shape,
                    definition,
                    placement.attributeCells
                );
                if (checkResult?.can) return { index, card, r, c };
            }
        }
    }
    return null;
}

const verse1Placement = findLegalLandPlacement();
check(Boolean(verse1Placement), "Verse1 playable LAND has a canonical legal anchor");
if (verse1Placement) {
    const placementResult = engine.placeLand(
        verse1Placement.r,
        verse1Placement.c,
        verse1Placement.card,
        0,
        { type: "OFFERING", index: verse1Placement.index }
    );
    check(placementResult?.success === true, "Verse1 LAND is placed through GameEngine.placeLand()", placementResult?.reason || null);
    check(engine.state.countPlacedTiles?.() > 0, "Verse1 placement mutates the live Board");
    check(engine.state.hasPickedThisTurn === true, "Verse1 placement consumes the Verse action");
}

function playNormalLandActionIfAvailable() {
    if (engine.state.hasPickedThisTurn === true) return { skipped: true, reason: "ACTION_ALREADY_USED" };
    const placement = findLegalLandPlacement();
    if (!placement) return { skipped: true, reason: "NO_LEGAL_LAND" };
    return engine.placeLand(
        placement.r,
        placement.c,
        placement.card,
        0,
        { type: "OFFERING", index: placement.index }
    );
}

function advanceTo(targetVerse, { playNormalActions = true } = {}) {
    while (engine.state.turn < targetVerse) {
        const before = engine.state.turn;
        if (playNormalActions && engine.state.hasPickedThisTurn !== true) {
            const action = playNormalLandActionIfAvailable();
            check(
                action?.success === true || action?.reason === "ACTION_ALREADY_USED",
                `Verse ${before} has a playable normal action before advance`,
                JSON.stringify(action || null)
            );
        }
        const result = engine.nextTurn();
        if (engine.state.turn !== before + 1) {
            failures.push({
                message: `Verse advance ${before} -> ${before + 1}`,
                details: JSON.stringify(result)
            });
            break;
        }
        check(engine.state.food >= 0, `Verse ${engine.state.turn} economy keeps food non-negative`, String(engine.state.food));
        check(engine.state.ember > 0, `Verse ${engine.state.turn} economy keeps Ember alive`, String(engine.state.ember));
    }
}

advanceTo(2);
check(
    (engine.enemyTruthReadModel?.getSnapshot?.()?.revision || 0) > 0,
    "Verse1 development is committed into Enemy Truth at the Verse boundary"
);

advanceTo(7);
check(engine.state.turn === 7, "TurnLifecycle reaches Verse7 through nextTurn()");
check(engine.state.investigationUnlocked === true, "Verse7 traces unlock Investigation through GE lifecycle");
check(engine.state.investigationUnlockedAtVerse === 7, "Investigation unlock records Verse7");
check(engine.warningStateService?.getState?.() === WARNING_STATES.OMEN, "Verse7 traces advance Warning to OMEN");

advanceTo(8);
check(engine.state.turn === 8, "TurnLifecycle reaches Verse8 through nextTurn()");
const verse8Offering = engine.state.handOffering || [];
const investigationIndex = verse8Offering.findIndex(card => (card?.terrain || card)?.category === "INVESTIGATION");
check(investigationIndex >= 0, "Verse8 Offering guarantees an Investigation card after unlock");

if (investigationIndex >= 0) {
    const beforeReports = engine.state.knownEnemyState?.reports?.length || 0;
    const truthSnapshot = engine.enemyTruthReadModel?.getSnapshot?.() || null;
    const observable = truthSnapshot?.observable || null;
    const observableCount = observable && typeof observable === "object"
        ? Object.values(observable).reduce((count, value) => {
            if (Array.isArray(value)) return count + value.length;
            return count + (value === null || value === undefined || value === "" ? 0 : 1);
        }, 0)
        : 0;
    check(
        observableCount > 0,
        "Verse8 Enemy Truth exposes at least one observable Investigation fragment",
        JSON.stringify({ trialIndex: truthSnapshot?.trialIndex ?? null, revision: truthSnapshot?.revision ?? null, observable })
    );

    const card = verse8Offering[investigationIndex];
    const result = engine.executeInvestigationCard?.(card, {
        type: "OFFERING",
        index: investigationIndex
    });
    check(
        result?.success === true,
        "Verse8 Investigation executes through live GameEngine API",
        JSON.stringify({ reason: result?.reason || null, observable })
    );
    check(
        (engine.state.knownEnemyState?.reports?.length || 0) === beforeReports + 1,
        "Investigation updates KnownEnemyState"
    );
    check(engine.warningStateService?.getState?.() === WARNING_STATES.WATCH, "Investigation advances Warning to WATCH");
}

advanceTo(10);
check(engine.warningStateService?.getState?.() === WARNING_STATES.TENSE, "Warning timing advances to TENSE at Trial1 T-5");
advanceTo(14);
check(engine.warningStateService?.getState?.() === WARNING_STATES.IMMINENT, "Warning timing advances to IMMINENT at Trial1 T-1");

const indexHtml = fs.readFileSync(new URL("../game/index.html", import.meta.url), "utf8");
const normalizedIndex = indexHtml.replace(/\s+/g, " ");
const browserCreateMatch = normalizedIndex.match(/GameEngine\.createGame\(\{([^}]*)\}\)/);
check(
    /firstRun\s*:/.test(browserCreateMatch?.[1] || ""),
    "Browser bootstrap supplies an explicit FirstRun activation source",
    browserCreateMatch ? `createGame options: {${browserCreateMatch[1].trim()}}` : "GameEngine.createGame options not found"
);

const runtimeAttachPos = normalizedIndex.indexOf("attachTrialRuntimeSubsystems(engine)");
const uiCreatePos = normalizedIndex.indexOf("new UIController(engine)");
const launchAttachPos = normalizedIndex.indexOf("attachTrialLaunchSubsystem(engine, ui)");

check(runtimeAttachPos >= 0, "Browser bootstrap attaches Trial runtime");
check(uiCreatePos > runtimeAttachPos, "Browser UI is created after Trial runtime attachment");
check(
    normalizedIndex.includes("trial_launch_bootstrap.js"),
    "Browser bootstrap imports Trial launch composition"
);
check(
    launchAttachPos > uiCreatePos,
    "Browser bootstrap attaches Trial launch after UI creation",
    launchAttachPos < 0 ? "attachTrialLaunchSubsystem(engine, ui) is not called from game/index.html" : null
);

const appSource = fs.readFileSync(new URL("../game/src/app.js", import.meta.url), "utf8");
const trialResultUiSource = fs.readFileSync(
    new URL("../game/src/ui/trial_result_ui_controller.js", import.meta.url),
    "utf8"
);
check(
    /TrialResultUIController\s+as\s+UIController/.test(appSource),
    "Browser app exports TrialResultUIController as the production UIController"
);
check(
    /startTrialSession\s*\(\s*scenario/.test(trialResultUiSource),
    "Production browser UI exposes the Trial launch session port"
);

advanceTo(15);
check(engine.state.turn === 15, "TurnLifecycle reaches fixed FirstRun Trial1 Verse15");
check(
    engine.state.grid.some((row, r) => row.some((cell, c) =>
        Boolean(cell) && (r === 0 || c === 0 || r === engine.state.grid.length - 1 || c === engine.state.grid.length - 1)
    )),
    "Normal Stage1 development reaches at least one perimeter cell before Trial1"
);
check(
    engine.trialDueStateService?.getPendingRequest?.()?.trialIndex === 1,
    "Verse15 creates a pending Trial1 due request before UI launch"
);

// Use the real TrialController behind the UI-session port. The browser DOM is
// intentionally not mocked here: presentation geometry has focused contracts,
// while this E2E owns the runtime boundary from launch through settlement.
const trialController = new TrialController({
    gameFactHub: engine.gameFactHub,
    emberSystem: engine.emberSystem,
    deploymentService: engine.trialDeploymentService || null,
    defenseReservation: engine.trialDefenseReservation || null
});
const uiPort = {
    trialController,
    startTrialSession(scenario) {
        return this.trialController.startScenario(scenario, {
            cellResolver: (r, c) => engine.state.grid?.[r]?.[c] || null
        });
    }
};
const explicitLaunch = attachTrialLaunchSubsystem(engine, uiPort);
check(explicitLaunch?.success === true, "Trial launch subsystem can attach to the live Stage1 runtime");
check(typeof engine.retryPendingTrialLaunch === "function", "TurnLifecycle retry port is installed when launch composition is attached");
const trialTruth = engine.enemyTruthReadModel?.getSnapshot?.() || null;
check(
    Number(trialTruth?.strategicSuppression) > 0,
    "Trial1 Enemy Truth has positive strategic suppression before launch",
    JSON.stringify({
        strategicSuppression: trialTruth?.strategicSuppression ?? null,
        routeCount: trialTruth?.armyStructure?.routeCount ?? null,
        forceCount: trialTruth?.armyStructure?.forceCount ?? null,
        revision: trialTruth?.revision ?? null
    })
);
check(
    Number(trialTruth?.armyStructure?.routeCount) > 0,
    "Trial1 Enemy Truth exposes at least one enemy route/force",
    JSON.stringify(trialTruth?.armyStructure || null)
);

const ingressCandidates = engine.trialLaunchIngressResolver?.listCandidates?.({ gameState: engine.state }) || [];
check(
    ingressCandidates.length > 0,
    "Stage1 developed board exposes at least one legal Trial ingress candidate",
    JSON.stringify({
        count: ingressCandidates.length,
        candidates: ingressCandidates,
        perimeter: engine.state.grid.flatMap((row, r) =>
            row.map((cell, c) => ({ cell, r, c }))
                .filter(({ cell, r, c }) => Boolean(cell)
                    && (r === 0 || c === 0 || r === engine.state.grid.length - 1 || c === engine.state.grid.length - 1))
                .map(({ cell, r, c }) => ({
                    r,
                    c,
                    terrainId: cell?.terrain?.id || cell?.terrain?.terrainId || cell?.terrainId || null,
                    placed: cell?.placed === true
                }))
        )
    })
);
const explicitLaunchResult = engine.retryPendingTrialLaunch?.();
check(
    explicitLaunchResult?.started === true,
    "Pending Verse15 Trial starts through TrialLaunchCoordinator",
    JSON.stringify(explicitLaunchResult || null)
);
check(engine.trialDueStateService?.getPendingRequest?.() === null, "Trial due request is acknowledged only after session start");
check(
    Array.isArray(trialController.state?.routes)
        && trialController.state.routes.length > 0,
    "Launched Trial session contains canonical route data"
);

if (explicitLaunchResult?.started === true && trialController.state) {
    const routes = trialController.getPlanningRoutes();
    const drafts = new Map();
    const availableDefense = Math.max(
        0,
        Math.floor(Number(trialController.state.human?.availableDefense) || 0)
    );
    let remainingDefense = availableDefense;
    let interceptedRoutes = 0;

    for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
        const route = routes[routeIndex];
        const routeId = route?.id ?? route?.routeId;
        const remainingRoutes = Math.max(1, routes.length - routeIndex);
        const desiredAllocation = remainingDefense > 0
            ? Math.max(1, Math.floor(remainingDefense / remainingRoutes))
            : 0;
        let interceptResult = null;

        if (desiredAllocation > 0) {
            for (const routeCell of (route?.cells || route?.path || [])) {
                const r = Number.isInteger(routeCell?.r) ? routeCell.r : routeCell?.row;
                const c = Number.isInteger(routeCell?.c) ? routeCell.c : routeCell?.column;
                if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
                const boardCell = engine.state.grid?.[r]?.[c] || null;
                if (!boardCell?.placed || boardCell.isHQ) continue;

                const attempt = trialController.setRouteInterceptPlan(
                    drafts,
                    routeId,
                    { r, c },
                    desiredAllocation
                );
                if (attempt?.success) {
                    interceptResult = attempt;
                    break;
                }
            }
        }

        if (interceptResult?.success) {
            interceptedRoutes += 1;
            remainingDefense -= desiredAllocation;
        } else {
            const skipped = trialController.setRouteSkipped(drafts, routeId);
            check(
                skipped?.success === true,
                `Trial1 route ${routeId} can be explicitly skipped when no legal interception is selected`,
                JSON.stringify(skipped || null)
            );
        }
    }

    check(
        interceptedRoutes > 0,
        "Trial1 canonical routes provide at least one legal interception battle",
        JSON.stringify({ routeCount: routes.length, interceptedRoutes, availableDefense })
    );

    const confirmed = trialController.confirmInterceptionPlan(drafts, { allowWarnings: true });
    check(
        confirmed?.success === true,
        "Trial1 interception plan confirms through TrialController",
        JSON.stringify(confirmed || null)
    );

    const defenseBeforeActivation = Math.max(
        0,
        Math.floor(Number(engine.state.currentDefense) || 0)
    );
    const expectedDefenseCommitted = Math.max(
        0,
        Math.floor(Number(confirmed?.plan?.totalDefenseAllocated) || 0)
    );
    const activated = confirmed?.success
        ? trialController.activateInterceptionPlan()
        : null;
    check(
        activated?.success === true,
        "Trial1 confirmed plan activates",
        JSON.stringify(activated || null)
    );
    if (activated?.success && expectedDefenseCommitted > 0) {
        check(
            Math.floor(Number(engine.state.currentDefense) || 0)
                === Math.max(0, defenseBeforeActivation - expectedDefenseCommitted),
            "Trial1 committed defense writes through to canonical GameState defense",
            JSON.stringify({
                before: defenseBeforeActivation,
                committed: expectedDefenseCommitted,
                after: engine.state.currentDefense,
                deploymentEconomyAttached: Boolean(engine.trialDeploymentService),
                deploymentCommit: activated.deploymentCommit || null
            })
        );
    }

    const battleQueue = Array.isArray(trialController.state?.battleQueue)
        ? trialController.state.battleQueue
        : [];
    check(
        battleQueue.length > 0,
        "Trial1 activation creates at least one battle",
        JSON.stringify({ battleCount: battleQueue.length, interceptedRoutes })
    );

    if (activated?.success && battleQueue.length > 0) {
        for (let battleIndex = 0; battleIndex < battleQueue.length; battleIndex += 1) {
            const started = trialController.startNextBattle();
            check(
                started?.success === true,
                `Trial1 battle ${battleIndex + 1} starts`,
                JSON.stringify(started || null)
            );
            if (!started?.success) break;

            const resolved = trialController.resolveCurrentBattle();
            check(
                resolved?.success === true,
                `Trial1 battle ${battleIndex + 1} resolves`,
                JSON.stringify(resolved || null)
            );
            if (!resolved?.success) break;

            const traversal = trialController.advanceAfterCurrentBattle();
            check(
                traversal?.success === true,
                `Trial1 enemy traversal ${battleIndex + 1} resolves`,
                JSON.stringify(traversal || null)
            );
            if (!traversal?.success) break;

            if (traversal.traversalResult?.reachedRouteEnd) {
                const damage = trialController.resolveRouteEndDamage(
                    traversal.traversalResult.battleIndex
                );
                check(
                    damage?.success === true,
                    `Trial1 route-end/HQ damage ${battleIndex + 1} resolves`,
                    JSON.stringify(damage || null)
                );
            }

            const transitioned = trialController.transitionAfterCurrentBattle();
            check(
                transitioned?.success === true,
                `Trial1 battle ${battleIndex + 1} transitions cleanly`,
                JSON.stringify(transitioned || null)
            );
            if (!transitioned?.success) break;
        }
    }

    const completed = trialController.canCompleteTrial()
        ? trialController.completeTrial()
        : null;
    check(
        completed?.success === true,
        "Trial1 completes after battle/traversal resolution",
        JSON.stringify(completed || {
            canComplete: trialController.canCompleteTrial(),
            lifecycle: trialController.getLifecycleReadModel?.() || null
        })
    );
    check(
        completed?.result?.outcome === "SURVIVED",
        "Stage1 canonical Trial1 path survives and may progress to Stage2",
        JSON.stringify(completed?.result || null)
    );

    if (completed?.success) {
        const settled = trialController.settleTrialResult();
        check(
            settled?.success === true,
            "Trial1 result settles through the canonical settlement boundary",
            JSON.stringify(settled || null)
        );
        check(
            Boolean(engine.state.postTrialTransition),
            "Trial1 settlement creates Post-Trial progression state"
        );
        check(
            engine.state.stage?.id === 1 && engine.state.grid?.length === 5,
            "Stage remains 5x5 until the Post-Trial stage gate opens"
        );

        if (settled?.success && completed?.result?.outcome === "SURVIVED") {
            const postTrialUiPort = {
                deferred: false,
                setPostTrialStageGateDeferred(enabled) {
                    this.deferred = Boolean(enabled);
                    return this.deferred;
                },
                completePostTrialStagePrelude() {
                    const before = engine.postTrialProgressionReadService?.read?.() || null;
                    const stageAdvance = before?.stageAdvance || null;
                    const stageAlreadyApplied = stageAdvance?.status === "APPLIED";
                    const stageIsCurrent = before?.currentStep?.type === "STAGE_ADVANCE";
                    if (!stageAlreadyApplied && !stageIsCurrent) {
                        return {
                            success: false,
                            reason: "POST_TRIAL_STAGE_PRELUDE_NOT_READY",
                            currentStepType: before?.currentStep?.type || null
                        };
                    }
                    const progression = stageAlreadyApplied
                        ? {
                            success: true,
                            alreadyApplied: true,
                            stageProgression: stageAdvance?.payload || null
                        }
                        : engine.postTrialProgressionService?.completeAfterPresentationCleanup?.();
                    return progression?.success === false
                        ? progression
                        : {
                            success: true,
                            progression,
                            stageProgression: progression?.stageProgression || null
                        };
                }
            };
            const presentationBridge = new PostTrialInterludePresentationBridge({
                uiController: postTrialUiPort
            });
            const interlude = new PostTrialInterludeProgressService({
                state: engine.state,
                readService: engine.postTrialProgressionReadService,
                presentationBridge,
                firstRunPolicyProvider: engine.firstRunService?.getPostTrialInterludePolicy
                    ? args => engine.firstRunService.getPostTrialInterludePolicy(args)
                    : null
            });

            const interludeStart = interlude.ensureSession();
            check(
                interludeStart?.success === true,
                "Post-Trial interlude starts from the settled Trial1 transition",
                JSON.stringify(interludeStart || null)
            );

            const sceneIds = [];
            for (let guard = 0; guard < 16; guard += 1) {
                const scene = interlude.getCurrentScene();
                if (!scene) break;
                sceneIds.push(scene.id);
                const sceneResult = interlude.completeCurrentScene({
                    expectedSceneId: scene.id
                });
                check(
                    sceneResult?.success === true,
                    `Post-Trial scene ${scene.id} completes`,
                    JSON.stringify(sceneResult || null)
                );
                if (!sceneResult?.success) break;
            }

            check(
                sceneIds.includes("STAGE_PRELUDE"),
                "Post-Trial presentation includes the Stage prelude gate",
                JSON.stringify(sceneIds)
            );
            check(
                interlude.getCurrentScene() === null,
                "Post-Trial presentation reaches CLOSE/completed state",
                JSON.stringify(interlude.getPresentation())
            );
            check(
                engine.state.stage?.id === 2 && engine.state.stage?.size === 7,
                "Trial1 Post-Trial progression advances Stage1 to Stage2"
            );
            check(
                engine.state.grid?.length === 7
                    && engine.state.grid.every(row => Array.isArray(row) && row.length === 7),
                "Stage2 expands the live board to 7x7"
            );
            check(
                engine.postTrialProgressionService?.canResumeNormalProgression?.() === true,
                "Post-Trial transition releases normal Verse progression"
            );

            trialController.endScenario();
            check(
                trialController.state === null,
                "Settled Trial session releases without residual Trial state"
            );

            const verseBeforeRestore = engine.state.turn;
            const normalResume = engine.nextTurn();
            check(
                engine.state.turn === verseBeforeRestore + 1,
                "Normal gameplay resumes on Stage2 after Post-Trial completion",
                JSON.stringify(normalResume || null)
            );
            check(
                Array.isArray(engine.state.handOffering) && engine.state.handOffering.length > 0,
                "Stage2 normal gameplay restores a non-empty Offering"
            );
        }
    }
}

console.log(`\nStage1 E2E audit checks: ${passed} PASS / ${failures.length} FAIL`);
if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
}
