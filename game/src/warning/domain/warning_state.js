export const WARNING_STATES = Object.freeze({
    CALM: "CALM",
    OMEN: "OMEN",
    WATCH: "WATCH",
    TENSE: "TENSE",
    IMMINENT: "IMMINENT"
});

export const WARNING_STATE_ORDER = Object.freeze([
    WARNING_STATES.CALM,
    WARNING_STATES.OMEN,
    WARNING_STATES.WATCH,
    WARNING_STATES.TENSE,
    WARNING_STATES.IMMINENT
]);

export function isWarningState(value) {
    return WARNING_STATE_ORDER.includes(value);
}

export function getWarningStateRank(value) {
    return WARNING_STATE_ORDER.indexOf(value);
}

export function canAdvanceWarningState(from, to) {
    if (!isWarningState(from) || !isWarningState(to)) return false;
    return getWarningStateRank(to) >= getWarningStateRank(from);
}

export default WARNING_STATES;
