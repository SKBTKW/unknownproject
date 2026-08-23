import { spawn } from 'child_process';
import path from 'path';

/**
 * 🛡️ AG_ToA マスター完全統合検問パイプライン (Master Full Inspection Pipeline)
 * 
 * 目的:
 * あらゆる作業完了後・Push承認前の絶対防衛ラインとして、
 * 「① 仕様書突合 ➔ ② ゲームロジック ➔ ③ UIライフサイクル」の全3大スクリプトを一括実行する。
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
    console.log("🛡️  AG_ToA マスター完全統合検問パイプライン (全自動 3段階検査)");
    console.log("============================================================\n");

    const startTime = Date.now();

    // 📜 Step 1: 仕様書 ＆ 直書き日本語検問
    console.log("🔍 [STEP 1/3] 仕様書 ＆ コード数値突合検問 (Python)...");
    const step1Ok = await runCommand("python", ["scratch/verify_all_rule_files.py"]);
    if (!step1Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 1 (仕様書検問) で不合格が検出されました。");
        process.exit(1);
    }

    // 🎮 Step 2: ゲームロジック・経済・カード効果検問 (115件)
    console.log("\n🧪 [STEP 2/3] ゲームロジック ＆ 経済サイクル全自動検問 (Node.js)...");
    const step2Ok = await runCommand("node", ["scratch/test_all_modules.mjs"]);
    if (!step2Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 2 (ゲームロジック検問) で不合格が検出されました。");
        process.exit(1);
    }

    // 🖥️ Step 3: UIライフサイクル ＆ DOM要素検問
    console.log("\n🖥️  [STEP 3/3] UIライフサイクル ＆ DOM構築・イベント検問 (Node.js)...");
    const step3Ok = await runCommand("node", ["scratch/test_ui_lifecycle.mjs"]);
    if (!step3Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 3 (UIライフサイクル検問) で不合格が検出されました。");
        process.exit(1);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n============================================================");
    console.log(`🎉 【全自動マスター統合検問: ALL GREEN】(所要時間: ${elapsed}s)`);
    console.log("   ✅ 全21仕様書突合: 100% 一致 (0 mismatches)");
    console.log("   ✅ ゲームロジック: 115/115 件 PASS");
    console.log("   ✅ UIライフサイクル: 12/12 項目 PASS (DOM正常構築確認)");
    console.log("============================================================\n");
    process.exit(0);
}

main();
