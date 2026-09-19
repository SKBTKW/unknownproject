import { findAdvisorDialogue } from './advisor_dialogue_database.js';
import { ADVISOR_DIALOGUE_CHANNELS, getAdvisorEventResponsibility } from '../../data/advisor_dialogue_responsibility.js';

const defaultSetTimer = (callback, delay) => setTimeout(callback, delay);
const defaultClearTimer = timerId => clearTimeout(timerId);
const defaultGetLanguage = () => globalThis?.I18n?.getLanguage?.() || "ja";

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
    constructor({ profile, translate = key => key, getLanguage = defaultGetLanguage, now = () => Date.now(), setTimer = defaultSetTimer, clearTimer = defaultClearTimer, dialogueMode = ADVISOR_DIALOGUE_MODES.NORMAL } = {}) {
        this.profile = profile;
        this.translate = translate;
        this.getLanguage = getLanguage;
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
        const responsibility = getAdvisorEventResponsibility(entry?.event);
        if (responsibility?.channel !== ADVISOR_DIALOGUE_CHANNELS.ADVICE || !responsibility.policyKey) {
            return normalizedRequestedMode;
        }

        const policyValue = this.profile?.policy?.[responsibility.policyKey];
        if (!Number.isFinite(policyValue)) return normalizedRequestedMode;

        return shallowerMode(normalizedRequestedMode, policyValueToMode(policyValue));
    }

    translateSegmentKeys(segmentKeys, context) {
        const translated = segmentKeys.map(key => this.translate(key, context));
        return translated.some((text, index) => text === segmentKeys[index]) ? null : translated;
    }

    resolveLocalizedSegments(entry, mode) {
        const localized = entry?.localizedSegments;
        if (!localized || typeof localized !== "object") return null;
        const lang = this.getLanguage?.() || "ja";
        const segments = localized[lang] || localized.ja || localized.en;
        if (!Array.isArray(segments) || segments.length === 0) return null;
        const normalizedMode = normalizeDialogueMode(mode);
        const visible = segments.slice(0, SEGMENT_LIMITS[normalizedMode]);
        const lineKey = `LOCALIZED_ADVISOR:${entry.event || "UNKNOWN"}`;
        return {
            lineKey,
            segmentKeys: visible.map((_, index) => `${lineKey}:${index + 1}`),
            text: visible.join(entry.segmentJoiner ?? "")
        };
    }

    resolveLine(entry, context = {}, mode = this.dialogueMode) {
        const localizedLine = this.resolveLocalizedSegments(entry, mode);
        if (localizedLine) return localizedLine;

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

    enqueueItem(item) {
        if (!this.current || item.priority > this.current.priority) this.show(item);
        else {
            this.queue.push(item);
            this.queue.sort((a, b) => b.priority - a.priority);
        }
        return true;
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
        return this.enqueueItem(item);
    }

    emitDutyScene(scene, context = {}, options = {}) {
        const definition = this.profile?.dutyDialogue?.[scene] || null;
        if (!definition) return false;

        const entry = {
            event: scene,
            priority: 90,
            durationMs: 4200,
            cooldownMs: 0,
            ...definition
        };
        const lastAt = this.cooldowns.get(scene);
        if (lastAt !== undefined && this.now() - lastAt < Number(entry.cooldownMs || 0)) return false;

        const requestedMode = options.dialogueMode ?? this.dialogueMode;
        const effectiveMode = normalizeDialogueMode(requestedMode);
        const resolvedLine = this.resolveLine(entry, context, effectiveMode);
        if (!resolvedLine) return false;

        this.cooldowns.set(scene, this.now());
        return this.enqueueItem({
            event: scene,
            topic: options.topic || scene,
            lineKey: resolvedLine.lineKey,
            segmentKeys: resolvedLine.segmentKeys,
            text: resolvedLine.text,
            expression: definition.expression || "NORMAL",
            dialogueMode: effectiveMode,
            priority: Number(options.priority ?? entry.priority ?? 90),
            durationMs: Number(entry.durationMs || 4200)
        });
    }

    emitResolved(reaction) {
        if (!reaction?.lineKey) return false;
        const context = reaction.context || {};
        const text = this.translate(reaction.lineKey, context);
        if (!text || text === reaction.lineKey) return false;

        const item = {
            event: reaction.event || "RESOLVED_REACTION",
            topic: reaction.topic || reaction.event || "RESOLVED_REACTION",
            lineKey: reaction.lineKey,
            segmentKeys: null,
            text,
            dialogueMode: normalizeDialogueMode(reaction.dialogueMode ?? this.dialogueMode),
            priority: Number(reaction.priority || 0),
            durationMs: Number(reaction.durationMs || 4200)
        };

        return this.enqueueItem(item);
    }

    emitPresentation(presentation) {
        if (!presentation || typeof presentation.line !== "string" || !presentation.line.trim()) return false;
        const scene = presentation.scene || "CHARACTER_REACTION";
        const text = presentation.line.trim();
        return this.enqueueItem({
            event: scene,
            topic: scene,
            lineKey: `REACTION:${scene}:${text}`,
            segmentKeys: null,
            text,
            expression: presentation.expression || "NORMAL",
            dialogueMode: ADVISOR_DIALOGUE_MODES.COMPACT,
            priority: Number(presentation.priority || 70),
            durationMs: Number(presentation.durationMs || 4200)
        });
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
