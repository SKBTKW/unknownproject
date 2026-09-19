import { spawn } from 'child_process';
import path from 'path';

/**
 * 🛡️ AG_ToA マスター完全統合検問パイプライン (Master Full Inspection Pipeline)
 * 
 * 目的:
 * あらゆる作業完了後・Push承認前の絶対防衛ラインとして、
 * 「① 仕様書突合 ➔ ② ゲームロジック ➔ ③ UIライフサイクル ➔ ④ ビルド識別表示 ➔ ⑤ 食料決済」の全5スクリプトを一括実行する。
 */

function runCommand(cmd, args) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
        proc.on('close', (code) => {
            resolve(code === 0);
        });
    });
}

async function main() {
    console.log("\n============================================================");
    console.log("🛡️  AoT 統合検問パイプライン (6 レイヤー自動検証)");
    console.log("============================================================\n");

    const startTime = Date.now();

    // 🛡️ Layer 1: Static Lint (禁止パターン・CSS・境界)
    console.log("🛡️ [LAYER 1/6] Static Lint (Fast Guardrail)...");
    const step1Ok = await runCommand("python", ["scratch/pre_write_linter.py"]);
    if (!step1Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 1 (Static Lint) で違反が検出されました。");
        process.exit(1);
    }
    const gitBranchGuardOk = await runCommand("python", ["-B", "scratch/test_git_branch_guard.py"]);
    if (!gitBranchGuardOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 1 (GIT001 Branch Authorization) で違反が検出されました。");
        process.exit(1);
    }
    const taskHealthOk = await runCommand("node", ["scratch/test_task_health.mjs"]);
    if (!taskHealthOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 1 (Task Health Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const integrationGuardOk = await runCommand("node", ["scratch/test_integration_guard.mjs"]);
    if (!integrationGuardOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 1 (Integration Guard Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const cssRelocationOk = await runCommand("python", ["-B", "scratch/test_css_important_relocation.py"]);
    if (!cssRelocationOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 1 (CSS001 Relocation Contract) で違反が検出されました。");
        process.exit(1);
    }

    // 📜 Layer 2: Spec Assertions (仕様定数 expected vs actual 突合)
    console.log("\n📜 [LAYER 2/6] Spec Assertions (定数 1:1 数値突合)...");
    const step2Ok = await runCommand("python", ["scratch/verify_all_rule_files.py"]);
    if (!step2Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 2 (Spec Assertions) で不合格が検出されました。");
        process.exit(1);
    }

    // 🎮 Layer 3: Domain Unit Tests (経済・配置・マージ・探索)
    console.log("\n🧪 [LAYER 3/6] Domain Unit Tests (ゲームロジック検証)...");
    const step3Ok = await runCommand("node", ["scratch/test_all_modules.mjs"]);
    if (!step3Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Domain Tests) で不合格が検出されました。");
        process.exit(1);
    }
    const turnLifecycleOk = await runCommand("node", ["scratch/test_turn_lifecycle_service.mjs"]);
    if (!turnLifecycleOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Turn Lifecycle Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const verseChronicleOk = await runCommand("node", ["scratch/test_verse_chronicle_facts.mjs"]);
    if (!verseChronicleOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Verse Chronicle Facts) で不合格が検出されました。");
        process.exit(1);
    }
    const historySnapshotOk = await runCommand("node", ["scratch/test_history_snapshot_service.mjs"]);
    if (!historySnapshotOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (History Snapshot Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const verseRestorePointOk = await runCommand("node", ["scratch/test_verse_restore_point_contract.mjs"]);
    if (!verseRestorePointOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Verse Restore Point) で不合格が検出されました。");
        process.exit(1);
    }
    const verse1RestorePointOk = await runCommand("node", ["scratch/test_verse1_restore_point.mjs"]);
    if (!verse1RestorePointOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Verse 1 Restore Point) で不合格が検出されました。");
        process.exit(1);
    }
    const snapshotSchemaOk = await runCommand("node", ["scratch/test_snapshot_schema_ownership.mjs"]);
    if (!snapshotSchemaOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Snapshot Schema Ownership) で不合格が検出されました。");
        process.exit(1);
    }
    const hydrateRoundTripOk = await runCommand("node", ["scratch/test_hydrate_game_state_round_trip.mjs"]);
    if (!hydrateRoundTripOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Hydrate GameState Round-trip) で不合格が検出されました。");
        process.exit(1);
    }
    const historyPrimitivesOk = await runCommand("node", ["scratch/test_history_restore_primitives.mjs"]);
    if (!historyPrimitivesOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (History Restore Primitives) で不合格が検出されました。");
        process.exit(1);
    }
    const historyRestoreOk = await runCommand("node", ["scratch/test_history_restore_service.mjs"]);
    if (!historyRestoreOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (History Restore Service) で不合格が検出されました。");
        process.exit(1);
    }
    const historyRestoreAtomicOk = await runCommand("node", ["scratch/test_history_restore_atomic_rollback.mjs"]);
    if (!historyRestoreAtomicOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (History Restore Atomic Rollback) で不合格が検出されました。");
        process.exit(1);
    }
    const chronicleRestoreUiOk = await runCommand("node", ["scratch/test_dev_chronicle_restore_ui.mjs"]);
    if (!chronicleRestoreUiOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Dev Chronicle Restore UI) で不合格が検出されました。");
        process.exit(1);
    }
    const trialRestoreBoundaryOk = await runCommand("node", ["scratch/test_trial_restore_boundary_service.mjs"]);
    if (!trialRestoreBoundaryOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Trial Restore Boundary Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const serializerCoverageOk = await runCommand("node", ["scratch/test_state_serializer_restore_coverage.mjs"]);
    if (!serializerCoverageOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (StateSerializer Restore Coverage) で不合格が検出されました。");
        process.exit(1);
    }
    const gameplayRandomOk = await runCommand("node", ["scratch/test_gameplay_random_service.mjs"]);
    if (!gameplayRandomOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Gameplay RNG Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const flexibleDiceOk = await runCommand("node", ["scratch/test_flexible_dice_contract.mjs"]);
    if (!flexibleDiceOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Flexible Dice Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const mixedRngRestoreOk = await runCommand("node", ["scratch/test_mixed_rng_restore_determinism.mjs"]);
    if (!mixedRngRestoreOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Mixed RNG Restore) で不合格が検出されました。");
        process.exit(1);
    }
    const deckRandomOk = await runCommand("node", ["scratch/test_deck_manager_rng_migration.mjs"]);
    if (!deckRandomOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (DeckManager RNG Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const offeringMinimumOk = await runCommand("node", ["scratch/test_offering_minimum_requirements.mjs"]);
    if (!offeringMinimumOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Offering Minimum Requirement Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const firstRunOk = await runCommand("node", ["scratch/test_first_run_service.mjs"]);
    if (!firstRunOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (FirstRun Orchestration Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const scheduledGlobalEventOk = await runCommand("node", ["scratch/test_scheduled_global_event_contract.mjs"]);
    if (!scheduledGlobalEventOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 3 (Scheduled Global Event Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const investigationContracts = [
        ["Warning Observation Boundary", "scratch/test_warning_observation_boundary.mjs"],
        ["Investigation Resolver", "scratch/test_investigation_resolver.mjs"],
        ["Investigation Card Execution", "scratch/test_investigation_card_execution.mjs"],
        ["Known Enemy State", "scratch/test_known_enemy_state_service.mjs"],
        ["Investigation Offering Adapter", "scratch/test_investigation_offering_adapter.mjs"],
        ["Investigation Runtime Bridge", "scratch/test_investigation_runtime_bridge.mjs"],
        ["Investigation Unlock Bridge", "scratch/test_investigation_unlock_bridge.mjs"],
        ["Investigation Restore Round-trip", "scratch/test_investigation_restore_round_trip.mjs"],
        ["Investigation Restore Offering Master", "scratch/test_investigation_restore_offering_master.mjs"],
        ["Investigation GameEngine Attach", "scratch/test_investigation_game_engine_attach.mjs"],
        ["Investigation History Comparator", "scratch/test_investigation_history_comparator.mjs"],
        ["Investigation Report Presenter", "scratch/test_investigation_report_presenter.mjs"],
        ["Investigation Report Text Renderer", "scratch/test_investigation_report_text_renderer.mjs"],
        ["Investigation Narrative", "scratch/test_investigation_narrative.mjs"],
    ];
    for (const [label, testPath] of investigationContracts) {
        const ok = await runCommand("node", [testPath]);
        if (!ok) {
            console.error(`\n❌ [PIPELINE BLOCKED] Layer 3 (${label}) で不合格が検出されました。`);
            process.exit(1);
        }
    }
    const runTerminationContracts = [
        ["Run Termination Contract", "game/src/core/dev/diagnose_run_termination_contract.mjs"],
        ["Terminal Verse Lifecycle", "game/src/core/dev/diagnose_terminal_verse_lifecycle.mjs"],
    ];
    for (const [label, testPath] of runTerminationContracts) {
        const ok = await runCommand("node", [testPath]);
        if (!ok) {
            console.error(`\n❌ [PIPELINE BLOCKED] Layer 3 (${label}) で不合格が検出されました。`);
            process.exit(1);
        }
    }

    // ⚔️ Layer 4: Trial Phase 1〜2.8G Tests (試練・迎撃・戦闘・完了)
    console.log("\n⚔️  [LAYER 4/6] Trial Subsystem Tests (迎撃・戦闘・完了)...");
    const trialPresentationBoundaryOk = await runCommand("node", ["scratch/test_trial_core_presentation_boundary.mjs"]);
    if (!trialPresentationBoundaryOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Core Presentation Boundary) で違反が検出されました。");
        process.exit(1);
    }
    const trialFoundationOk = await runCommand("node", ["scratch/test_trial_foundation.mjs"]);
    if (!trialFoundationOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Foundation) で不合格が検出されました。");
        process.exit(1);
    }
    const trialPreviewOk = await runCommand("node", ["scratch/test_trial_phase2_preview.mjs"]);
    if (!trialPreviewOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Preview) で不合格が検出されました。");
        process.exit(1);
    }
    const trialDevHarnessOk = await runCommand("node", ["scratch/test_trial_phase25_dev_harness.mjs"]);
    if (!trialDevHarnessOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Dev Harness) で不合格が検出されました。");
        process.exit(1);
    }
    const trialSelectionOk = await runCommand("node", ["scratch/test_trial_phase27a_selection.mjs"]);
    if (!trialSelectionOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Selection) で不合格が検出されました。");
        process.exit(1);
    }
    const trialAllocationOk = await runCommand("node", ["scratch/test_trial_phase27b_defense_allocation.mjs"]);
    if (!trialAllocationOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Defense Allocation) で不合格が検出されました。");
        process.exit(1);
    }
    const trialPlanningOk = await runCommand("node", ["scratch/test_trial_phase27c_foundation.mjs"]);
    if (!trialPlanningOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 4 (Trial Planning Foundation) で不合格が検出されました。");
        process.exit(1);
    }
    const trialFlowTests = [
        ["Trial Route Decision UI", "scratch/test_trial_phase27cd_route_decision_ui.mjs"],
        ["Trial Completion Flow", "scratch/test_trial_phase27ce_completion_flow.mjs"],
        ["Trial Final Review Confirm", "scratch/test_trial_phase27cf_final_review_confirm.mjs"],
        ["Trial Plan Activation", "scratch/test_trial_phase28a_plan_activation.mjs"],
        ["Trial Battle Sequence Start", "scratch/test_trial_phase28b_battle_sequence_start.mjs"],
        ["Trial Battle Resolution", "scratch/test_trial_phase28c_battle_resolution.mjs"],
        ["Trial Enemy Traversal", "scratch/test_trial_phase28d_enemy_traversal.mjs"],
        ["Trial Next Battle Transition", "scratch/test_trial_phase28e_next_battle_transition.mjs"],
        ["Trial HQ Ember Damage", "scratch/test_trial_phase28f_hq_ember_damage.mjs"],
        ["Trial Completion", "scratch/test_trial_phase28g_trial_completion.mjs"],
        ["Trial HQ Arrival Aggregation", "game/src/trial/dev/diagnose_hq_arrival_aggregation.mjs"],
        ["Trial HQ Aggregate Resolution", "game/src/trial/dev/diagnose_hq_aggregate_resolution.mjs"],
        ["Trial All-SKIP Completion", "game/src/trial/dev/diagnose_all_skip_trial_completion.mjs"],
        ["Trial Fatal HQ Resolution", "game/src/trial/dev/diagnose_trial_fatal_hq_resolution.mjs"],
    ];
    for (const [label, testPath] of trialFlowTests) {
        const ok = await runCommand("node", [testPath]);
        if (!ok) {
            console.error(`\n❌ [PIPELINE BLOCKED] Layer 4 (${label}) で不合格が検出されました。`);
            process.exit(1);
        }
    }

    // 🖥️ Layer 5: UI Lifecycle Tests (DOM構築・多言語・イベント)
    console.log("\n🖥️  [LAYER 5/6] UI Lifecycle Tests (DOMライフサイクル・描画)...");
    const step5Ok = await runCommand("node", ["scratch/test_ui_lifecycle.mjs"]);
    if (!step5Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (UI Lifecycle) で不合格が検出されました。");
        process.exit(1);
    }
    const layoutStateOk = await runCommand("node", ["scratch/test_layout_state_manager.mjs"]);
    if (!layoutStateOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Layout State Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const layoutTrialTransitionOk = await runCommand("node", ["scratch/test_layout_trial_transition_contract.mjs"]);
    if (!layoutTrialTransitionOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Layout Trial Transition Contract) で不合格が検出されました。");
        process.exit(1);
    }
    const layoutCssOwnershipOk = await runCommand("node", ["scratch/test_layout_css_ownership.mjs"]);
    if (!layoutCssOwnershipOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Layout CSS Ownership) で不合格が検出されました。");
        process.exit(1);
    }
    const trialUiIntegrationOk = await runCommand("node", ["scratch/test_trial_ui_integration.mjs"]);
    if (!trialUiIntegrationOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Trial UI Integration) で不合格が検出されました。");
        process.exit(1);
    }
    const settingsModalOk = await runCommand("node", ["scratch/test_settings_modal_system.mjs"]);
    if (!settingsModalOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Settings Modal) で不合格が検出されました。");
        process.exit(1);
    }
    const advisorFoundationOk = await runCommand("node", ["scratch/test_advisor_foundation.mjs"]);
    if (!advisorFoundationOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Advisor Foundation) で不合格が検出されました。");
        process.exit(1);
    }
    const globalEventChoiceRestoreOk = await runCommand("node", ["scratch/test_global_event_choice_restore_reconciliation.mjs"]);
    if (!globalEventChoiceRestoreOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Global Event Choice Restore Reconciliation) で不合格が検出されました。");
        process.exit(1);
    }
    const advisorPeaceOk = await runCommand("node", ["scratch/test_advisor_peace_dialogue.mjs"]);
    if (!advisorPeaceOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Advisor Peace Dialogue) で不合格が検出されました。");
        process.exit(1);
    }
    const advisorUiShellOk = await runCommand("node", ["scratch/test_advisor_ui_shell.mjs"]);
    if (!advisorUiShellOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Advisor UI Shell) で不合格が検出されました。");
        process.exit(1);
    }
    const trialUiIsolationTests = [
        ["Trial Normal Input Isolation", "scratch/test_trial_normal_input_isolation.mjs"],
        ["Trial FocusLayer Suppression", "scratch/test_trial_focus_layer_suppression.mjs"],
        ["Trial Hover Tooltip Isolation", "scratch/test_trial_hover_tooltip_isolation.mjs"],
        ["Trial 2D/2.5D Input Semantics", "scratch/test_trial_2d_25d_input_semantics.mjs"],
        ["Trial Right Context Geometry", "scratch/test_trial_right_context_geometry.mjs"],
    ];
    for (const [label, testPath] of trialUiIsolationTests) {
        const ok = await runCommand("node", [testPath]);
        if (!ok) {
            console.error(`\n❌ [PIPELINE BLOCKED] Layer 5 (${label}) で不合格が検出されました。`);
            process.exit(1);
        }
    }

    // 🏷️ Layer 6: Other Integration & Economic Settlement (ビルド識別・食料決済)
    console.log("\n🌾 [LAYER 6/6] Integration & Economic Settlement Tests...");
    const step6BadgeOk = await runCommand("node", ["scratch/test_build_identity_badge.mjs"]);
    if (!step6BadgeOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 6 (ビルド識別表示) で不合格が検出されました。");
        process.exit(1);
    }
    const step6MaintOk = await runCommand("node", ["scratch/test_maintenance_fallback_system.mjs"]);
    if (!step6MaintOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 6 (食料決済・不足補填) で不合格が検出されました。");
        process.exit(1);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n============================================================");
    console.log(`✅ 統合検問パイプライン合格 (所要時間: ${elapsed}s)`);
    console.log("   ✅ Layer 1: Static Lint (0 errors)");
    console.log("   ✅ Layer 2: Spec Assertions (all assertions matched)");
    console.log("   ✅ Layer 3: Domain Unit Tests + Run Termination Contracts PASS");
    console.log("   ✅ Layer 4: Trial Phase 1〜2.8G + HQ Resolution Contracts PASS");
    console.log("   ✅ Layer 5: UI Lifecycle Tests PASS");
    console.log("   ✅ Layer 6: Integration & Settlement Tests PASS");
    console.log("============================================================\n");
    process.exit(0);
}

main();
