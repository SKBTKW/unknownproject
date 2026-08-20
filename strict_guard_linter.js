/* =============================================================
   strict_guard_linter.js (プロジェクトルート配置用)
   AI暴走・勝手なCSS改変・クラス改名・未接続を物理検知する厳格Linter
   ============================================================= */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let hasError = false;

console.log('🔍 [Strict Guard Linter] 自動検証を開始します...');

// 0. ユーザー事前Diff承認フラグ (.approved または scratch/.approved) の存在チェック
const approvedFlagPath = fs.existsSync(path.join('scratch', '.approved')) 
    ? path.join('scratch', '.approved') 
    : '.approved';

if (!fs.existsSync(approvedFlagPath)) {
    console.error('❌ [ERROR] ユーザーからの事前Diff承認が得られていません (.approved が未生成です)。');
    console.error('👉 事前に変更差分をユーザーに提示し、承認を得てから作業を実行してください。');
    hasError = true;
}

// 1. 勝手なCSSレイアウト属性（position, z-index, transform, width, height）の変更検知
try {
    const diff = execSync('git diff -- game/css/').toString();
    const forbiddenProps = ['position', 'z-index', 'transform', 'width', 'height', 'top', 'bottom', 'left', 'right'];
    
    forbiddenProps.forEach(prop => {
        const regex = new RegExp(`^[+-]\\s*${prop}\\s*:`, 'm');
        if (regex.test(diff)) {
            console.error(`❌ [ERROR] 指示されていないCSSプロパティ "${prop}" の変更が検出されました。`);
            hasError = true;
        }
    });
} catch (e) {
    // 差分がない場合はスキップ
}

// 2. index_v2.html 内での未接続モジュールの汎用自動検知 (systems, ui, data 全配下スキャン)
try {
    const htmlPath = path.join('game', 'index_v2.html');
    if (fs.existsSync(htmlPath)) {
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        const targetDirs = ['systems', 'ui', 'data'];
        targetDirs.forEach(dirName => {
            const dirPath = path.join('game', 'src', dirName);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                files.forEach(file => {
                    if (file.endsWith('.js')) {
                        const relativeScriptPath = `src/${dirName}/${file}`;
                        if (!htmlContent.includes(relativeScriptPath)) {
                            console.error(`❌ [ERROR] モジュール "${relativeScriptPath}" が index_v2.html に読み込まれていません。`);
                            hasError = true;
                        }
                    }
                });
            }
        });
    }
} catch (e) {
    console.error('❌ [ERROR] モジュール接続チェック中に例外が発生しました:', e.message);
    hasError = true;
}

if (hasError) {
    console.error('\n🛑 [Strict Guard Linter] ルール違反が検知されたため、処理を物理的に自動遮断します。');
    process.exit(1);
} else {
    console.log('✅ [Strict Guard Linter] すべての機械的ルールチェックに合格しました。');
    process.exit(0);
}
