import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createFirstRunTrial1RelativeDeploymentCostResolver } from "../game/src/trial/config/first_run_trial1_relative_deployment_policy_v1.js";

// Reuse the Economy owner's executable Offering trace; never replace its paid
// Board investments with a fabricated resource snapshot.
const trace = execFileSync(process.execPath, [fileURLToPath(new URL("./test_stage1_pretrial_economy_envelope.mjs", import.meta.url))], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    maxBuffer: 1024 * 1024
});
const prefix = "STAGE1_PRETRIAL_ECONOMY_SNAPSHOT ";
const samples = trace.split("\n").filter(line => line.startsWith(prefix)).map(line => JSON.parse(line.slice(prefix.length)));
assert.equal(samples.length, 8);
assert.equal(new Set(samples.map(sample => sample.seed)).size, 8);
assert.ok(samples.every(sample => sample.verse === 15 && sample.boardInvestmentSpend > 0 && sample.activeInvestments > 0));

function summary(values) {
    const ordered = values.toSorted((a, b) => a - b);
    return { min: ordered[0], median: (ordered[3] + ordered[4]) / 2, max: ordered[7] };
}

console.log("\nStage1 Trial1 burden against paid Board investments");
for (const [name, fraction, distance] of [
    ["LIGHT_NEAR", 0.25, 0], ["LIGHT_FAR", 0.25, 4],
    ["MEDIUM_NEAR", 0.50, 0], ["MEDIUM_FAR", 0.50, 4],
    ["HEAVY_NEAR", 0.90, 0], ["HEAVY_FAR", 0.90, 4]
]) {
    const rows = samples.map(sample => {
        const requestedDefense = Math.max(1, Math.round(sample.defense * fraction));
        const resolver = createFirstRunTrial1RelativeDeploymentCostResolver({
            balanceProvider: () => ({ food: sample.food, material: sample.material }),
            defenseBalanceProvider: () => sample.defense
        });
        const quote = resolver({ requestedDefense, distance, context: {
            trialIndex: 1, interceptionCount: 1, defenseAvailable: sample.defense
        } });
        assert.ok(quote, `seed ${sample.seed}: concrete FirstRun Trial1 quote`);
        assert.ok(quote.food <= sample.food && quote.material <= sample.material);
        // This is the observed material portfolio ratio, not a counterfactual
        // no-investment run: investment actions also change later production.
        const materialPortfolioShare = (sample.boardInvestmentSpend + quote.material)
            / (sample.boardInvestmentSpend + sample.material);
        const combinedPortfolioShare = (sample.boardInvestmentSpend + quote.food + quote.material)
            / (sample.boardInvestmentSpend + sample.food + sample.material);
        return {
            seed: sample.seed,
            defense: `${requestedDefense}/${sample.defense}`,
            share: quote.breakdown.burdenShare,
            foodShare: quote.breakdown.foodShare,
            foodCost: quote.food,
            materialCost: quote.material,
            foodRemaining: sample.food - quote.food,
            materialRemaining: sample.material - quote.material,
            materialPortfolioShare,
            combinedPortfolioShare
        };
    });
    const result = {
        scenario: name,
        share: summary(rows.map(row => row.share)),
        foodShare: summary(rows.map(row => row.foodShare)),
        foodCost: summary(rows.map(row => row.foodCost)),
        materialCost: summary(rows.map(row => row.materialCost)),
        foodRemaining: summary(rows.map(row => row.foodRemaining)),
        materialRemaining: summary(rows.map(row => row.materialRemaining)),
        materialPortfolioShare: summary(rows.map(row => row.materialPortfolioShare)),
        combinedPortfolioShare: summary(rows.map(row => row.combinedPortfolioShare)),
        seeds: rows
    };
    console.log("TRIAL1_BURDEN_MEASURED", JSON.stringify(result));
    if (name === "HEAVY_FAR") {
        assert.ok(rows.every(row => row.materialPortfolioShare >= 0.70 && row.materialPortfolioShare <= 0.80),
            "heavy far paid-investment material portfolio stays in the 70-80% design band for all observed seeds");
        assert.ok(rows.every(row => row.combinedPortfolioShare >= 0.70 && row.combinedPortfolioShare <= 0.80),
            "heavy far paid-investment food and material portfolio stays in the 70-80% design band for all observed seeds");
        assert.ok(rows.every(row => row.foodRemaining >= 35 && row.materialRemaining >= 35),
            "heavy far preview retains a nontrivial food and material reserve in every observed seed");
    }
}
console.log("✅ Stage1 Trial1 burden certification probe PASS");
