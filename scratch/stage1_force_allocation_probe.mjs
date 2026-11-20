import { GameplayRandomService } from "../game/src/core/gameplay_random_service.js";

const forceIds = ["A", "B", "C"];
const baseShares = [50, 30, 20];

export function sampleStage1ForceShares(seed) {
    const random = new GameplayRandomService(seed);
    // A and B each vary by up to five percentage points. Restrict B's
    // range so C receives the residual within the same bounds.
    const offsetA = random.nextInt(-5, 5);
    const offsetB = random.nextInt(Math.max(-5, -5 - offsetA), Math.min(5, 5 - offsetA));
    return Object.freeze([baseShares[0] + offsetA, baseShares[1] + offsetB, baseShares[2] - offsetA - offsetB]);
}

function distribute(total, shares, rounding) {
    const totalShare = shares.reduce((sum, share) => sum + share, 0);
    const entries = shares.map((share, index) => {
        const numerator = total * share;
        return { index, whole: Math.floor(numerator / totalShare), fraction: numerator % totalShare };
    });
    const integers = entries.map(entry => entry.whole);
    const remainder = total - integers.reduce((sum, whole) => sum + whole, 0);
    if (rounding === "remainder-to-a") {
        integers[0] += remainder;
    } else {
        const byRemainder = entries.toSorted((a, b) => b.fraction - a.fraction || a.index - b.index);
        for (const { index } of byRemainder.slice(0, remainder)) integers[index]++;
    }
    return { integers, entries, totalShare };
}

/** An independent diagnostic. Persist the result or the sampled shares as data. */
export function resolveStage1ForceAllocation({
    total, minimum, shares = baseShares, rounding = "largest-remainder", minimumCheck = "rounded"
} = {}) {
    if (!Number.isSafeInteger(total) || total < 0 || total > Math.floor(Number.MAX_SAFE_INTEGER / 100)
        || !Number.isSafeInteger(minimum) || minimum < 1
        || !Array.isArray(shares) || shares.length !== forceIds.length
        || shares.some((share, index) => !Number.isInteger(share) || Math.abs(share - baseShares[index]) > 5)
        || shares.reduce((sum, share) => sum + share, 0) !== 100
        || !["largest-remainder", "remainder-to-a"].includes(rounding)
        || !["rounded", "unrounded"].includes(minimumCheck)) {
        throw new RangeError("Invalid Stage1 force allocation diagnostic input");
    }

    let allocation = [];
    if (total > 0) {
        // The lead force retains the total when no subordinate can form.
        for (let count = forceIds.length; count >= 1; count--) {
            const { integers, entries, totalShare } = distribute(total, shares.slice(0, count), rounding);
            const meetsMinimum = integers.slice(1).every((value, index) =>
                minimumCheck === "rounded" ? value >= minimum
                    : entries[index + 1].whole + entries[index + 1].fraction / totalShare >= minimum
            );
            if (meetsMinimum) {
                allocation = integers;
                break;
            }
        }
    }

    return Object.freeze({
        total, minimum, rounding, minimumCheck,
        forces: Object.freeze(forceIds.map((id, index) => Object.freeze({
            id, originalShare: shares[index], participates: index < allocation.length,
            suppression: allocation[index] ?? 0
        })))
    });
}
