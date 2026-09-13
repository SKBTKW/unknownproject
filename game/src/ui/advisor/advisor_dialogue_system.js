import { findAdvisorDialogue } from './advisor_dialogue_database.js';

const defaultSetTimer = (callback, delay) => setTimeout(callback, delay);
const defaultClearTimer = timerId => clearTimeout(timerId);

export const ADVISOR_DIALOGUE_MODES = Object.freeze({
    COMPACT: "compact",
    NORMAL: "normal",
    DETAILED: "detailed"
});

const SEGMENT_LIMITS = Object.freeze({
    [ADVISOR_DIALOGUE_MODES.COMPACT]: 1,
    [ADVISOR_DIALOGUE_MODES.NORMAL]: 2,
    [ADVISOR_DIALOGUE_MODES.DETAILED]: Infinity
});

const MODE_RANK = Object.freeze({
    [ADVISOR_DIALOGUE_MODES.COMPACT]: 1,
    [ADVISOR_DIALOGUE_MODES.NORMAL]: 2,
    [ADVISOR_DIALOGUE_MODES.DETAILED]: 3
});

function normalizeDialogueMode(mode) {
    return Object.prototype.hasOwnProperty.call(SEGMENT_LIMITS, mode)
        ? mode
        : ADVISOR_DIALOGUE_MODES.NORMAL;
}

function policyValueToMode(value) {
    if (value >= 4) return ADVISOR_DIALOGUE_MODES.DETAILED;
    if (value >= 2) return ADVISOR_DIALOGUE_MODES.NORMAL;
    return ADVISOR_DIALOGUE_MODES.COMPACT;
}

function shallowerMode(a, b) {
    const normalizedA = normalizeDialogueMode(a);
    const normalizedB = normalizeDialogueMode(b);
    return MODE_RANK[normalizedA] <= MODE_RANK[normalizedB] ? normalizedA : normalizedB;
}

export class AdvisorDialogueSystem {
    constructor({ profile, translate = key => key, now = () => Date.now(), setTimer = defaultSetTimer, clearTimer = defaultClearTimer, dialogueMode = ADVISOR_DIALOGUE_MODES.NORMAL } = {}) {
        this.profile = profile;
        this.translate = translate;
        this.now = now;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.dialogueMode = normalizeDialogueMode(dialogueMode);
        this.queue = [];
        this.recentHistory = [];
        this.cooldowns = new Map();
        this.listeners = new Set();
        this.current = null;
        this.dismissTimer = null;
    }

    setDialogueMode(mode) {
        this.dialogueMode = normalizeDialogueMode(mode);
    }

    subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("ADVISOR_DIALOGUE_LISTENER_REQUIRED");
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    resolveDialogueMode(entry, requestedMode = this.dialogueMode) {
        const normalizedRequestedMode = normalizeDialogueMode(requestedMode);
        if (!entry?.policyKey) return normalizedRequestedMode;

        const policyValue = this.profile?.policy?.[entry.policyKey];
        if (!Number.isFinite(policyValue)) return normalizedRequestedMode;

        return shallowerMode(normalizedRequestedMode, policyValueToMode(policyValue));
    }

    translateSegmentKeys(segmentKeys, context) {
        const translated = segmentKeys.map(key => this.translate(key, context));
        return translated.some((text, index) => text === segmentKeys[index]) ? null : translated;
    }

    resolveLine(entry, context = {}, mode = this.dialogueMode) {
        const segmentGroups = Array.isArray(entry.segmentGroups)
            ? entry.segmentGroups.filter(group => Array.isArray(group) && group.length > 0)
            : [];

        if (segmentGroups.length > 0) {
            const group = segmentGroups.find(candidate => !this.recentHistory.includes(candidate[0])) || segmentGroups[0];
            const normalizedMode = normalizeDialogueMode(mode);
            const segmentKeys = group.slice(0, SEGMENT_LIMITS[normalizedMode]);
            const translatedSegments = this.translateSegmentKeys(segmentKeys, context);

            if (translatedSegments) {
                return {
                    lineKey: group[0],
                    segmentKeys,
                    text: translatedSegments.join(entry.segmentJoiner ?? "")
                };
            }
        }

        const lineKeys = Array.isArray(entry.lineKeys) ? entry.lineKeys : [];
        const lineKey = lineKeys.find(key => !this.recentHistory.includes(key)) || lineKeys[0];
        if (!lineKey) return null;

        return {
            lineKey,
            segmentKeys: null,
            text: this.translate(lineKey, context)
        };
    }

    emit(event, context = {}, options = {}) {
        const entry = findAdvisorDialogue(event, this.profile);
        if (!entry) return false;
        const lastAt = this.cooldowns.get(event);
        if (lastAt !== undefined && this.now() - lastAt < entry.cooldownMs) return false;

        const requestedMode = options.dialogueMode ?? this.dialogueMode;
        const effectiveMode = this.resolveDialogueMode(entry, requestedMode);
        const resolvedLine = this.resolveLine(entry, context, effectiveMode);
        if (!resolvedLine) return false;

        const item = {
            event,
            topic: options.topic || event,
            lineKey: resolvedLine.lineKey,
            segmentKeys: resolvedLine.segmentKeys,
            text: resolvedLine.text,
            dialogueMode: effectiveMode,
            priority: options.priority ?? entry.priority,
            durationMs: entry.durationMs
        };

        this.cooldowns.set(event, this.now());
        if (!this.current || item.priority > this.current.priority) this.show(item);
        else {
            this.queue.push(item);
            this.queue.sort((a, b) => b.priority - a.priority);
        }
        return true;
    }

    emitTopic(topicResult, context = {}) {
        if (!topicResult?.id) return false;
        return this.emit(topicResult.id, { ...context, ...(topicResult.context || {}) }, { topic: topicResult.topic, priority: topicResult.priority });
    }

    show(item) {
        if (this.dismissTimer) this.clearTimer(this.dismissTimer);
        this.current = item;
        this.recentHistory.unshift(item.lineKey);
        this.recentHistory = this.recentHistory.slice(0, 8);
        this.listeners.forEach(listener => listener(item));
        this.dismissTimer = this.setTimer(() => this.dismiss(), item.durationMs);
    }

    dismiss() {
        if (this.dismissTimer) this.clearTimer(this.dismissTimer);
        this.dismissTimer = null;
        this.current = null;
        this.listeners.forEach(listener => listener(null));
        const next = this.queue.shift();
        if (next) this.show(next);
    }

    destroy() {
        if (this.dismissTimer) this.clearTimer(this.dismissTimer);
        this.listeners.clear();
        this.queue = [];
        this.current = null;
    }
}
