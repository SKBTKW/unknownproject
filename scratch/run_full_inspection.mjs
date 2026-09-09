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

    // ⚔️ Layer 4: Trial Phase 1〜2.7B Tests (試練・迎撃・配分プレビュー)
    console.log("\n⚔️  [LAYER 4/6] Trial Subsystem Tests (迎撃・戦闘・プレビュー)...");
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

    // 🖥️ Layer 5: UI Lifecycle Tests (DOM構築・多言語・イベント)
    console.log("\n🖥️  [LAYER 5/6] UI Lifecycle Tests (DOMライフサイクル・描画)...");
    const step5Ok = await runCommand("node", ["scratch/test_ui_lifecycle.mjs"]);
    if (!step5Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (UI Lifecycle) で不合格が検出されました。");
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
    const advisorPeaceOk = await runCommand("node", ["scratch/test_advisor_peace_dialogue.mjs"]);
    if (!advisorPeaceOk) {
        console.error("\n❌ [PIPELINE BLOCKED] Layer 5 (Advisor Peace Dialogue) で不合格が検出されました。");
        process.exit(1);
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
    console.log("   ✅ Layer 3: Domain Unit Tests PASS");
    console.log("   ✅ Layer 4: Trial Phase 1〜2.7C Tests PASS");
    console.log("   ✅ Layer 5: UI Lifecycle Tests PASS");
    console.log("   ✅ Layer 6: Integration & Settlement Tests PASS");
    console.log("============================================================\n");
    process.exit(0);
}

main();
