function cloneScalar(value) {
    return value === undefined ? null : value;
}

function freezeProvenance(checkResult) {
    return Object.freeze({
        checkId: cloneScalar(checkResult.checkId),
        actionId: cloneScalar(checkResult.actionId),
        checkSequence: Number.isInteger(checkResult.checkSequence)
            ? checkResult.checkSequence
            : null,
        outcomeId: cloneScalar(checkResult.outcome?.id)
    });
}

/**
 * Anti-corruption boundary from a shared check result into Battle Fortune.
 *
 * This adapter intentionally does not own the generic CheckResult schema,
 * RNG, DicePool, outcome table, or dice animation. It only extracts the
 * resolved facts that Battle Fortune currently needs after the check has
 * already been completed elsewhere.
 */
export class BattleFortuneCheckResultAdapter {
    adapt(checkResult) {
        if (!checkResult || typeof checkResult !== "object") {
            throw new TypeError("BATTLE_FORTUNE_CHECK_RESULT_REQUIRED");
        }

        const kept = checkResult.dice?.kept;
        if (!Array.isArray(kept) || kept.length === 0) {
            throw new TypeError("BATTLE_FORTUNE_CHECK_DICE_REQUIRED");
        }
        const dice = kept.map(value => Number(value));
        if (dice.some(value => !Number.isFinite(value))) {
            throw new TypeError("BATTLE_FORTUNE_CHECK_DICE_INVALID");
        }

        const total = Number(checkResult.finalTotal);
        if (!Number.isFinite(total)) {
            throw new TypeError("BATTLE_FORTUNE_CHECK_TOTAL_REQUIRED");
        }

        return Object.freeze({
            dice: Object.freeze(dice),
            total,
            provenance: freezeProvenance(checkResult)
        });
    }
}

export default BattleFortuneCheckResultAdapter;
