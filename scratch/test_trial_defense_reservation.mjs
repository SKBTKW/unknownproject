import assert from "node:assert/strict";
import {
    TrialDefenseReservation,
    TRIAL_DEFENSE_RESERVATION_REASONS
} from "../game/src/trial/systems/trial_defense_reservation.js";

function fixture(initial = 10) {
    const state = { currentDefense: initial };
    const reservation = new TrialDefenseReservation({
        getAvailableDefense: () => state.currentDefense,
        applyDefenseLoss: amount => {
            const before = state.currentDefense;
            state.currentDefense = Math.max(0, before - amount);
            return {
                before,
                after: state.currentDefense,
                reduced: before - state.currentDefense
            };
        },
        recoverDefense: amount => {
            const before = state.currentDefense;
            state.currentDefense += amount;
            return {
                before,
                after: state.currentDefense,
                recovered: state.currentDefense - before
            };
        }
    });
    return { state, reservation };
}

{
    const { state, reservation } = fixture(10);
    assert.equal(reservation.readBalance(), 10);
    assert.deepEqual(reservation.canReserve(4), {
        reservable: true,
        reasons: [],
        balance: 10
    });
    const committed = reservation.reserve(4);
    assert.equal(committed.success, true);
    assert.equal(committed.before, 10);
    assert.equal(committed.after, 6);
    assert.equal(committed.reserved, 4);
    assert.equal(state.currentDefense, 6);

    const rolledBack = reservation.rollback(committed);
    assert.equal(rolledBack.success, true);
    assert.equal(rolledBack.restored, 4);
    assert.equal(state.currentDefense, 10);
}

{
    const { state, reservation } = fixture(3);
    const denied = reservation.reserve(4);
    assert.equal(denied.success, false);
    assert.equal(
        denied.reasons.includes(TRIAL_DEFENSE_RESERVATION_REASONS.INSUFFICIENT_DEFENSE),
        true
    );
    assert.equal(state.currentDefense, 3);
}

{
    const state = { currentDefense: 10 };
    const reservation = new TrialDefenseReservation({
        getAvailableDefense: () => state.currentDefense,
        applyDefenseLoss: amount => {
            const before = state.currentDefense;
            const reduced = Math.max(0, amount - 1);
            state.currentDefense -= reduced;
            return { before, after: state.currentDefense, reduced };
        },
        recoverDefense: amount => {
            const before = state.currentDefense;
            state.currentDefense += amount;
            return { before, after: state.currentDefense, recovered: amount };
        }
    });

    const failed = reservation.reserve(4);
    assert.equal(failed.success, false);
    assert.equal(
        failed.reasons.includes(TRIAL_DEFENSE_RESERVATION_REASONS.DEFENSE_RESERVATION_FAILED),
        true
    );
    assert.equal(failed.rollback?.success, true, "partial reservation must be rolled back internally");
    assert.equal(state.currentDefense, 10);
}

{
    const unavailable = new TrialDefenseReservation();
    assert.equal(unavailable.readBalance(), null);
    const denied = unavailable.reserve(1);
    assert.equal(denied.success, false);
    assert.equal(
        denied.reasons.includes(TRIAL_DEFENSE_RESERVATION_REASONS.DEFENSE_BOUNDARY_UNAVAILABLE),
        true
    );
}

console.log("test_trial_defense_reservation: PASS");
