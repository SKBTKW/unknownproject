import fs from 'node:fs';
import path from 'node:path';

// ==============================================================================
// 🛡️ System Authority Boundary Static Auditor
// ==============================================================================

const ROOT_DIR = process.cwd();

/**
 * Recursively find all JS files in a directory
 * @param {string} dir
 * @returns {string[]}
 */
function findJsFiles(dir) {
    const fullPath = path.resolve(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) return [];
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const res = path.join(fullPath, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(findJsFiles(res));
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
            files.push(res);
        }
    }
    return files;
}

/**
 * Scan files for forbidden regex patterns
 */
function scanFilesForPatterns({ targetDirs, patterns, allowlist = [] }) {
    const violations = [];
    for (const dir of targetDirs) {
        const files = findJsFiles(dir);
        for (const file of files) {
            const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
            if (allowlist.some(allowed => relPath.includes(allowed))) {
                continue;
            }
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, lineIdx) => {
                for (const { name, regex } of patterns) {
                    if (regex.test(line)) {
                        violations.push({
                            rule: name,
                            file: relPath,
                            line: lineIdx + 1,
                            code: line.trim()
                        });
                    }
                }
            });
        }
    }
    return violations;
}

export function auditSystemAuthorityBoundaries() {
    const allViolations = [];

    // --------------------------------------------------------------------------
    // Rule 1: Presentation (UI) to TrueEnemyState / EnemyTruth isolation
    // --------------------------------------------------------------------------
    const rule1Violations = scanFilesForPatterns({
        targetDirs: ['game/src/ui'],
        patterns: [
            { name: 'UI_READS_TRUE_ENEMY_STATE', regex: /\btrueEnemyState\b/ },
            { name: 'UI_READS_ENEMY_TRUTH', regex: /\bEnemyTruth\b/ },
            { name: 'UI_READS_TRUE_ENEMY_PROP', regex: /\btrueEnemy\b/ }
        ]
    });
    allViolations.push(...rule1Violations);

    // --------------------------------------------------------------------------
    // Rule 2: UI / Warning from legacy trial timing directly
    // --------------------------------------------------------------------------
    const rule2Violations = scanFilesForPatterns({
        targetDirs: ['game/src/ui', 'game/src/warning'],
        patterns: [
            { name: 'DIRECT_NEXT_TRIAL_TURN_READ', regex: /(?:state|\bthis)\.nextTrialTurn\b/ },
            { name: 'DIRECT_TRIAL_SCHEDULE_READ', regex: /(?:state|\bthis)\.trialSchedule\b/ }
        ]
    });
    allViolations.push(...rule2Violations);

    // --------------------------------------------------------------------------
    // Rule 3: Cards layer to TrialState isolation
    // --------------------------------------------------------------------------
    const rule3Violations = scanFilesForPatterns({
        targetDirs: ['game/src/cards'],
        patterns: [
            { name: 'CARDS_MUTATES_TRIAL_STATE', regex: /\btrialState\s*=/ },
            { name: 'CARDS_DIRECT_TRIAL_STATE_ACCESS', regex: /(?:state|\bthis)\.trialState\b/ }
        ]
    });
    allViolations.push(...rule3Violations);

    // --------------------------------------------------------------------------
    // Rule 4: Investigation to EnemyTruth isolation
    // --------------------------------------------------------------------------
    const rule4Violations = scanFilesForPatterns({
        targetDirs: ['game/src/investigation'],
        patterns: [
            { name: 'INVESTIGATION_MUTATES_TRUE_ENEMY', regex: /\btrueEnemyState\s*=/ },
            { name: 'INVESTIGATION_READS_ENEMY_TRUTH', regex: /\bEnemyTruth\b/ },
            { name: 'INVESTIGATION_READS_TRUE_ENEMY', regex: /\btrueEnemyState\b/ }
        ]
    });
    allViolations.push(...rule4Violations);

    // --------------------------------------------------------------------------
    // Rule 5: DeckManager legacy command card hardcoding lock
    // --------------------------------------------------------------------------
    // [POLICY: LEGACY_ONLY / DO NOT EXPAND / MIGRATION CANDIDATES]
    // The command card IDs below are strictly frozen historical implementations
    // scheduled for future migration to cardEffectHandlerRouter.
    // Under NO circumstances should new command cards be added to this allowlist
    // or directly hardcoded into deck_manager.js. Always use cardEffectHandlerRouter!
    const deckManagerPath = path.resolve(ROOT_DIR, 'game/src/systems/deck_manager.js');
    if (fs.existsSync(deckManagerPath)) {
        const deckContent = fs.readFileSync(deckManagerPath, 'utf8');
        const legacyAllowedIds = new Set([
            "CMD_ABANDONED_SETTLEMENT",
            "CMD_DEPOT",
            "CMD_GRANARY_NETWORK",
            "CMD_GREAT_RAMPART_PROJECT",
            "CMD_INDUSTRIAL_CLUSTER",
            "CMD_INDUSTRIAL_ROAD",
            "CMD_IRRIGATION",
            "CMD_IRRIGATION_NETWORK",
            "CMD_LIME_KILN",
            "CMD_MARKET",
            "CMD_PASTORAL_FARM",
            "CMD_QUARRY",
            "CMD_SAWMILL",
            "CMD_STABLE",
            "CMD_TRANSMUTE_GOLDEN",
            "CMD_WORKSHOP"
        ]);

        const cmdMatches = [...deckContent.matchAll(/cId\s*===\s*["'](CMD_[A-Z0-9_]+)["']/g)].map(m => m[1]);
        const uniqueFound = Array.from(new Set(cmdMatches)).sort();
        for (const foundId of uniqueFound) {
            if (!legacyAllowedIds.has(foundId)) {
                allViolations.push({
                    rule: 'DECK_MANAGER_NEW_COMMAND_BRANCH',
                    file: 'game/src/systems/deck_manager.js',
                    line: 0,
                    code: `Found new unrouted command branch: ${foundId}. [POLICY VIOLATION] DeckManager allowlist is LEGACY_ONLY / DO NOT EXPAND. New command cards MUST be registered in cardEffectHandlerRouter instead!`
                });
            }
        }
    }

    return allViolations;
}

import { fileURLToPath } from 'node:url';

// Direct execution
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
    const violations = auditSystemAuthorityBoundaries();
    if (violations.length > 0) {
        console.error('❌ Authority boundary violations found:');
        for (const v of violations) {
            console.error(`  - [${v.rule}] ${v.file}:${v.line} -> ${v.code}`);
        }
        process.exit(1);
    } else {
        console.log('✅ All authority boundary audits passed (0 violations).');
        process.exit(0);
    }
}
