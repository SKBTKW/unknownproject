/**
 * 🛡️ check_validator (CheckDefinitions 厳格バリデータ)
 * 
 * 責務:
 * 1. CheckSystem 初期化時に全判定定義の整合性を完全走査する。
 * 2. id重複、不正なダイス数/面数、不正なkeep指定を即時検知。
 * 3. outcomeの重複帯、空白帯（穴）、min > max の論理矛盾を検知し例外を投げる。
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
        let keptCount = dice.count;
        if (keepRule === "all") {
            keptCount = dice.count;
        } else if (typeof keepRule === "string" && (keepRule.startsWith("highest_") || keepRule.startsWith("lowest_"))) {
            const isHighest = keepRule.startsWith("highest_");
            const rawN = isHighest ? keepRule.replace("highest_", "") : keepRule.replace("lowest_", "");
            const n = parseInt(rawN, 10);
            if (!Number.isInteger(n) || n < 1 || n > dice.count || String(n) !== rawN) {
                throw new Error(`[CheckValidator] "${key}": keep rule "${keepRule}" has invalid N (must be 1 <= N <= ${dice.count}).`);
            }
            keptCount = n;
        } else {
            throw new Error(`[CheckValidator] "${key}": unknown keep rule "${keepRule}".`);
        }

        // 3. Outcomes 検証
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

        // 4. 出目可能範囲における重複 ＆ 空白帯の数学的完全検査
        // 理論出目範囲 (修正値 0 の場合: keptCount * 1 〜 keptCount * sides)
        // 修正値による拡張も考慮し、十分な範囲 (-20 〜 +40) で走査
        const scanMin = (keptCount * 1) - 10;
        const scanMax = (keptCount * dice.sides) + 10;

        for (let roll = scanMin; roll <= scanMax; roll++) {
            let matchedCount = 0;
            for (const outcome of def.outcomes) {
                const passMin = outcome.min === undefined || roll >= outcome.min;
                const passMax = outcome.max === undefined || roll <= outcome.max;
                if (passMin && passMax) {
                    matchedCount++;
                }
            }

            if (matchedCount > 1) {
                throw new Error(`[CheckValidator] "${key}": Overlapping outcomes detected at value ${roll}. Each value must match exactly 1 outcome.`);
            }
            // 理論出目 (keptCount * 1 〜 keptCount * sides) 内で空白がある場合は重大エラー
            if (roll >= (keptCount * 1) && roll <= (keptCount * dice.sides) && matchedCount === 0) {
                throw new Error(`[CheckValidator] "${key}": Gap (uncovered value) detected at roll value ${roll}. No outcome covers this value.`);
            }
        }
    }
}
