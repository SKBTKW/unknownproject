import { spawn } from 'child_process';
import path from 'path';

/**
 * 🛡️ AG_ToA マスター完全統合検問パイプライン (Master Full Inspection Pipeline)
 * 
 * 目的:
 * あらゆる作業完了後・Push承認前の絶対防衛ラインとして、
 * 「① 仕様書突合 ➔ ② ゲームロジック ➔ ③ UIライフサイクル ➔ ④ ビルド識別表示」の全4スクリプトを一括実行する。
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
    console.log("🛡️  AG_ToA マスター完全統合検問パイプライン (全自動 4段階検査)");
    console.log("============================================================\n");

    const startTime = Date.now();

    // 📜 Step 1: 仕様書 ＆ 直書き日本語検問
    console.log("🔍 [STEP 1/4] 仕様書 ＆ コード数値突合検問 (Python)...");
    const step1Ok = await runCommand("python", ["scratch/verify_all_rule_files.py"]);
    if (!step1Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 1 (仕様書検問) で不合格が検出されました。");
        process.exit(1);
    }

    // 🎮 Step 2: ゲームロジック・経済・カード効果検問
    console.log("\n🧪 [STEP 2/4] ゲームロジック ＆ 経済サイクル全自動検問 (Node.js)...");
    const step2Ok = await runCommand("node", ["scratch/test_all_modules.mjs"]);
    if (!step2Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 2 (ゲームロジック検問) で不合格が検出されました。");
        process.exit(1);
    }

    // 🖥️ Step 3: UIライフサイクル ＆ DOM要素検問
    console.log("\n🖥️  [STEP 3/4] UIライフサイクル ＆ DOM構築・イベント検問 (Node.js)...");
    const step3Ok = await runCommand("node", ["scratch/test_ui_lifecycle.mjs"]);
    if (!step3Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 3 (UIライフサイクル検問) で不合格が検出されました。");
        process.exit(1);
    }

    // 🏷️ Step 4: 開発ブランチ / 製品バージョン表示検問
    console.log("\n🏷️  [STEP 4/4] ビルド識別バッジ検問 (Node.js)...");
    const step4Ok = await runCommand("node", ["scratch/test_build_identity_badge.mjs"]);
    if (!step4Ok) {
        console.error("\n❌ [PIPELINE BLOCKED] Step 4 (ビルド識別表示検問) で不合格が検出されました。");
        process.exit(1);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n============================================================");
    console.log(`✅ マスター統合検問 PASS (所要時間: ${elapsed}s)`);
    console.log("   ✅ 仕様書検証コマンド PASS");
    console.log("   ✅ ゲームロジック検証コマンド PASS");
    console.log("   ✅ UIライフサイクル検証コマンド PASS");
    console.log("   ✅ ビルド識別バッジ検証コマンド PASS");
    console.log("============================================================\n");
    process.exit(0);
}

main();
