function integerDie(value) {
    return Number.isInteger(Number(value)) ? Number(value) : null;
}

/**
 * Presentation-only adapter for a fortune roll that was already resolved by Domain.
 * No RNG, payment, or result resolution is performed here.
 */
export function createResolvedBattleDicePresentation(snapshot) {
    const roll = snapshot?.fortuneRoll;
    if (!roll || typeof roll !== "object") {
        return Object.freeze({ available: false, result: null });
    }

    const die1 = integerDie(roll.die1 ?? roll.dice?.[0]);
    const die2 = integerDie(roll.die2 ?? roll.dice?.[1]);
    const total = integerDie(roll.total);
    if (die1 === null || die2 === null || total === null) {
        return Object.freeze({ available: false, result: null });
    }

    return Object.freeze({
        available: true,
        result: Object.freeze({
            die1,
            die2,
            dice: Object.freeze([die1, die2]),
            total,
            outcome: roll.outcome ?? roll.result ?? null
        }),
        context: Object.freeze({
            battleId: snapshot?.battleId ?? snapshot?.id ?? null,
            presentationOnly: true
        })
    });
}

export default createResolvedBattleDicePresentation;
