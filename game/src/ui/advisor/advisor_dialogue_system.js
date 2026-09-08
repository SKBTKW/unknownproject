import { findAdvisorDialogue } from './advisor_dialogue_database.js';

export class AdvisorDialogueSystem {
    constructor({ profile, translate = key => key, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
        this.profile = profile;
        this.translate = translate;
        this.now = now;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.queue = [];
        this.recentHistory = [];
        this.cooldowns = new Map();
        this.listeners = new Set();
        this.current = null;
        this.dismissTimer = null;
    }

    subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("ADVISOR_DIALOGUE_LISTENER_REQUIRED");
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(event, context = {}) {
        const entry = findAdvisorDialogue(event, this.profile);
        if (!entry) return false;
        const lastAt = this.cooldowns.get(event);
        if (lastAt !== undefined && this.now() - lastAt < entry.cooldownMs) return false;
        const lineKey = entry.lineKeys.find(key => !this.recentHistory.includes(key)) || entry.lineKeys[0];
        const item = { event, lineKey, text: this.translate(lineKey, context), priority: entry.priority, durationMs: entry.durationMs };
        this.cooldowns.set(event, this.now());
        if (!this.current || item.priority > this.current.priority) this.show(item);
        else {
            this.queue.push(item);
            this.queue.sort((a, b) => b.priority - a.priority);
        }
        return true;
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
