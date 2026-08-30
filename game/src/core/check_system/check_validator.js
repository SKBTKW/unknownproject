/**
 * 🛡️ check_validator (CheckDefinitions 数学的区間バリデータ)
 * 
 * 責務:
 * 1. CheckSystem 初期化時に全判定定義の整合性を数学的に検証する。
 * 2. id重複、不正なダイス数/面数、不正なkeep指定を即時検知。
 * 3. 各 outcome を区間 [min, max] として解析し、(-∞, +∞) の全整数域において
 *    重複帯および空白帯（穴）が一切存在しない連続性を厳密に証明する。
 */

export function validateCheckDefinitions(definitions) {
    if (!definitions || typeof definitions !== "object") {
        throw new Error("[CheckValidator] definitions must be a valid object.");
    }

    for (const [key, def] of Object.entries(definitions)) {
        if (!def || typeof def !== "object") {
            throw new Error(`[CheckValidator] Definition for "${key}" must be an object.`);
        }
        if (def.id !== key) {
            throw new Error(`[CheckValidator] Definition key "${key}" does not match def.id "${def.id}".`);
        }

        // 1. ダイス定義検証
        const dice = def.dice;
        if (!dice || typeof dice !== "object") {
            throw new Error(`[CheckValidator] "${key}": dice definition is missing.`);
        }
        if (!Number.isInteger(dice.count) || dice.count < 1) {
            throw new Error(`[CheckValidator] "${key}": dice.count must be an integer >= 1 (got: ${dice.count}).`);
        }
        if (!Number.isInteger(dice.sides) || dice.sides < 2) {
            throw new Error(`[CheckValidator] "${key}": dice.sides must be an integer >= 2 (got: ${dice.sides}).`);
        }

        // 2. keep ルール検証
        const keepRule = dice.keep || "all";
        if (keepRule === "all") {
            // OK
        } else if (typeof keepRule === "string" && (keepRule.startsWith("highest_") || keepRule.startsWith("lowest_"))) {
            const isHighest = keepRule.startsWith("highest_");
            const rawN = isHighest ? keepRule.replace("highest_", "") : keepRule.replace("lowest_", "");
            const n = parseInt(rawN, 10);
            if (!Number.isInteger(n) || n < 1 || n > dice.count || String(n) !== rawN) {
                throw new Error(`[CheckValidator] "${key}": keep rule "${keepRule}" has invalid N (must be 1 <= N <= ${dice.count}).`);
            }
        } else {
            throw new Error(`[CheckValidator] "${key}": unknown keep rule "${keepRule}".`);
        }

        // 3. Outcomes 配列・ID一意性・min/max 基本検証
        if (!Array.isArray(def.outcomes) || def.outcomes.length === 0) {
            throw new Error(`[CheckValidator] "${key}": outcomes must be a non-empty array.`);
        }

        const outcomeIds = new Set();
        for (const outcome of def.outcomes) {
            if (!outcome || !outcome.id) {
                throw new Error(`[CheckValidator] "${key}": each outcome must have an "id".`);
            }
            if (outcomeIds.has(outcome.id)) {
                throw new Error(`[CheckValidator] "${key}": duplicate outcome id "${outcome.id}".`);
            }
            outcomeIds.add(outcome.id);

            if (outcome.min !== undefined && outcome.max !== undefined && outcome.min > outcome.max) {
                throw new Error(`[CheckValidator] "${key}": outcome "${outcome.id}" has min (${outcome.min}) > max (${outcome.max}).`);
            }
        }

        // 4. 📐 数学的区間解析 (Interval Continuity Analysis)
        // 各 outcome を [lower, upper] に正規化 (undefined は -Infinity / +Infinity)
        const intervals = def.outcomes.map((outcome) => ({
            id: outcome.id,
            lower: outcome.min !== undefined ? outcome.min : -Infinity,
            upper: outcome.max !== undefined ? outcome.max : Infinity
        }));

        // lower 昇順でソート (lower が同じなら upper 昇順)
        intervals.sort((a, b) => {
            if (a.lower !== b.lower) return a.lower - b.lower;
            return a.upper - b.upper;
        });

        // 4-A. 最左端の区間は -Infinity から始まらなければならない (負の修正値でも穴が空かない保証)
        if (intervals[0].lower !== -Infinity) {
            throw new Error(`[CheckValidator] "${key}": Lowest outcome "${intervals[0].id}" must have no min (must cover down to -Infinity).`);
        }

        // 4-B. 最右端の区間は +Infinity で終わらなければならない (極大の修正値でも穴が空かない保証)
        const lastInterval = intervals[intervals.length - 1];
        if (lastInterval.upper !== Infinity) {
            throw new Error(`[CheckValidator] "${key}": Highest outcome "${lastInterval.id}" must have no max (must cover up to +Infinity).`);
        }

        // 4-C. 隣接区間の連続性 ＆ 重複検査
        for (let i = 0; i < intervals.length - 1; i++) {
            const current = intervals[i];
            const next = intervals[i + 1];

            // 重複検査: current の upper が next の lower 以上であれば重複
            if (current.upper >= next.lower) {
                throw new Error(`[CheckValidator] "${key}": Overlapping outcomes detected between "${current.id}" (upper: ${current.upper}) and "${next.id}" (lower: ${next.lower}).`);
            }

            // 空白帯（穴）検査: 離散整数のため、next.lower は current.upper + 1 でなければならない
            if (next.lower !== current.upper + 1) {
                throw new Error(`[CheckValidator] "${key}": Gap detected between "${current.id}" (upper: ${current.upper}) and "${next.id}" (lower: ${next.lower}). Value ${current.upper + 1} is uncovered.`);
            }
        }
    }
}
