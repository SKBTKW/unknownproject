function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function normalizeVerse(value, field) {
    const verse = Math.floor(Number(value));
    if (!Number.isInteger(verse) || verse < 1) {
        throw new TypeError(`TRIAL_TIMING_${field}_INVALID`);
    }
    return verse;
}

function normalizeTrialIndex(value) {
    const index = Math.floor(Number(value));
    if (!Number.isInteger(index) || index < 1) {
        throw new TypeError("TRIAL_TIMING_INDEX_INVALID");
    }
    return index;
}

function normalizeSchedule(schedule) {
    if (!schedule || typeof schedule !== "object") {
        throw new TypeError("TRIAL_TIMING_SCHEDULE_REQUIRED");
    }

    const entries = Object.entries(schedule)
        .map(([key, value]) => {
            const match = /^trial(\d+)$/.exec(key);
            if (!match) return null;
            return {
                trialIndex: normalizeTrialIndex(match[1]),
                verse: normalizeVerse(value, `TRIAL${match[1]}_VERSE`)
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.trialIndex - b.trialIndex);

    if (entries.length === 0) {
        throw new TypeError("TRIAL_TIMING_SCHEDULE_EMPTY");
    }

    for (let i = 0; i < entries.length; i++) {
        if (entries[i].trialIndex !== i + 1) {
            throw new TypeError("TRIAL_TIMING_SCHEDULE_INDEX_GAP");
        }
        if (i > 0 && entries[i].verse <= entries[i - 1].verse) {
            throw new TypeError("TRIAL_TIMING_SCHEDULE_NOT_ASCENDING");
        }
    }

    return entries;
}

/**
 * Internal exact Trial clock.
 *
 * This service answers simulation questions such as "is Trial 1 due now?".
 * It is deliberately NOT a player-facing Warning/Advisor read model. Exact
 * remaining Verse counts must not be surfaced through presentation code.
 */
export class TrialTimingAuthorityService {
    constructor({ schedule, currentTrialIndex = 1 } = {}) {
        this.entries = Object.freeze(normalizeSchedule(schedule).map(entry => Object.freeze({ ...entry })));
        this.currentTrialIndex = normalizeTrialIndex(currentTrialIndex);
        if (this.currentTrialIndex > this.entries.length + 1) {
            throw new TypeError("TRIAL_TIMING_INDEX_OUT_OF_RANGE");
        }
        this.lastSettledTrialIndex = this.currentTrialIndex - 1;
    }

    getScheduledVerse(trialIndex) {
        const index = normalizeTrialIndex(trialIndex);
        return this.entries.find(entry => entry.trialIndex === index)?.verse ?? null;
    }

    getCurrentTrialIndex() {
        return this.currentTrialIndex;
    }

    getNextScheduledVerse() {
        return this.getScheduledVerse(this.currentTrialIndex);
    }

    getDistanceToNextTrial(currentVerse) {
        const verse = normalizeVerse(currentVerse, "CURRENT_VERSE");
        const scheduledVerse = this.getNextScheduledVerse();
        return scheduledVerse === null ? null : scheduledVerse - verse;
    }

    isCurrentTrialDue(currentVerse) {
        const distance = this.getDistanceToNextTrial(currentVerse);
        return distance !== null && distance <= 0;
    }

    markTrialSettled(trialIndex = this.currentTrialIndex) {
        const settledIndex = normalizeTrialIndex(trialIndex);
        if (settledIndex !== this.currentTrialIndex) {
            throw new Error("TRIAL_TIMING_SETTLEMENT_INDEX_MISMATCH");
        }
        if (this.getScheduledVerse(settledIndex) === null) {
            throw new Error("TRIAL_TIMING_SETTLEMENT_UNKNOWN_TRIAL");
        }

        this.lastSettledTrialIndex = settledIndex;
        this.currentTrialIndex = settledIndex + 1;
        return this.getReadModel();
    }

    getReadModel() {
        return {
            currentTrialIndex: this.currentTrialIndex,
            lastSettledTrialIndex: this.lastSettledTrialIndex,
            nextScheduledVerse: this.getNextScheduledVerse(),
            schedule: this.entries.map(entry => ({ ...entry }))
        };
    }

    getRestoreState() {
        return cloneData(this.getReadModel());
    }

    restoreState(snapshot) {
        if (!snapshot || typeof snapshot !== "object") {
            throw new TypeError("TRIAL_TIMING_RESTORE_STATE_INVALID");
        }

        const restoredIndex = normalizeTrialIndex(snapshot.currentTrialIndex);
        if (restoredIndex > this.entries.length + 1) {
            throw new TypeError("TRIAL_TIMING_RESTORE_INDEX_OUT_OF_RANGE");
        }

        const restoredSchedule = Array.isArray(snapshot.schedule)
            ? snapshot.schedule.map(entry => ({ [`trial${entry.trialIndex}`]: entry.verse }))
            : null;
        if (restoredSchedule) {
            const flatSchedule = Object.assign({}, ...restoredSchedule);
            const normalized = normalizeSchedule(flatSchedule);
            const current = this.entries.map(entry => `${entry.trialIndex}:${entry.verse}`).join("|");
            const incoming = normalized.map(entry => `${entry.trialIndex}:${entry.verse}`).join("|");
            if (current !== incoming) {
                throw new Error("TRIAL_TIMING_RESTORE_SCHEDULE_MISMATCH");
            }
        }

        this.currentTrialIndex = restoredIndex;
        this.lastSettledTrialIndex = Number.isInteger(snapshot.lastSettledTrialIndex)
            ? snapshot.lastSettledTrialIndex
            : restoredIndex - 1;
        return this.getRestoreState();
    }
}

export function createLegacyCompatibleTrialTimingAuthority(gameState) {
    if (!gameState?.trialSchedule) {
        throw new TypeError("TRIAL_TIMING_LEGACY_SCHEDULE_REQUIRED");
    }
    return new TrialTimingAuthorityService({
        schedule: {
            trial1: gameState.trialSchedule.trial1,
            trial2: gameState.trialSchedule.trial2,
            trial3: gameState.trialSchedule.trial3
        },
        currentTrialIndex: Math.max(1, Math.floor(Number(gameState.stage?.id) || 1))
    });
}

export default TrialTimingAuthorityService;
