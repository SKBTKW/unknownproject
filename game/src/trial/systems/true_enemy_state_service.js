import { GAME_FACT_TYPES } from "../../core/game_fact.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function normalizeTrialIndex(value) {
    return Math.max(1, Math.floor(Number(value) || 1));
}

function buildInitialState({ trialIndex = 1, verse = null } = {}) {
    return {
        trialIndex: normalizeTrialIndex(trialIndex),
        strategicSuppression: 0,
        commander: null,
        forces: [],
        attributes: {
            body: [],
            equipment: [],
            terrainAffinity: [],
            marchTraits: []
        },
        revision: 0,
        updatedAtVerse: Number.isFinite(Number(verse)) ? Number(verse) : null,
        lastTransition: null
    };
}

/**
 * Enemy TruthのSSOT。
 *
 * Threatの更新を受けても、transitionResolverが明示的な遷移を返さない限り
 * Enemy Truthは変化しない。これにより「Threatが1増えた瞬間に敵が魔法のように増える」
 * 挙動を避ける。
 */
export class TrueEnemyStateService {
    constructor({
        gameState,
        gameFactHub,
        transitionResolver = null,
        initialState = null
    } = {}) {
        if (!gameState) throw new TypeError("TRUE_ENEMY_GAME_STATE_REQUIRED");
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("TRUE_ENEMY_GAME_FACT_HUB_REQUIRED");
        }
        if (transitionResolver !== null && typeof transitionResolver !== "function") {
            throw new TypeError("TRUE_ENEMY_TRANSITION_RESOLVER_INVALID");
        }

        this.gameState = gameState;
        this.gameFactHub = gameFactHub;
        this.transitionResolver = transitionResolver;
        this.lastThreat = null;

        const base = initialState || buildInitialState({
            trialIndex: gameState?.stage?.id,
            verse: gameState?.turn
        });
        this.current = Object.freeze(cloneData(base));
        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.TRIAL_THREAT_UPDATED) return;
        const payload = fact.payload || {};
        const previousThreatState = payload.previous || null;
        const currentThreatState = payload.current || null;
        this.applyThreatUpdate({ previousThreatState, currentThreatState });
    }

    applyThreatUpdate({ previousThreatState = null, currentThreatState = null } = {}) {
        const previousThreat = cloneData(previousThreatState?.threat || this.lastThreat);
        const currentThreat = cloneData(currentThreatState?.threat || null);
        this.lastThreat = cloneData(currentThreat);

        if (!this.transitionResolver) {
            return { updated: false, state: this.getSnapshot() };
        }

        const candidate = this.transitionResolver({
            previousEnemyState: this.getSnapshot(),
            previousThreat,
            currentThreat,
            verse: currentThreatState?.committedVerse ?? this.gameState?.turn ?? null,
            trialIndex: currentThreatState?.trialIndex ?? this.current?.trialIndex ?? 1
        });

        if (!candidate || typeof candidate !== "object") {
            return { updated: false, state: this.getSnapshot() };
        }

        const next = {
            ...cloneData(this.current),
            ...cloneData(candidate),
            trialIndex: normalizeTrialIndex(candidate.trialIndex ?? currentThreatState?.trialIndex ?? this.current?.trialIndex),
            strategicSuppression: nonNegative(candidate.strategicSuppression ?? this.current?.strategicSuppression),
            commander: cloneData(candidate.commander ?? this.current?.commander ?? null),
            forces: Array.isArray(candidate.forces) ? cloneData(candidate.forces) : cloneData(this.current?.forces || []),
            attributes: {
                body: cloneData(candidate.attributes?.body ?? this.current?.attributes?.body ?? []),
                equipment: cloneData(candidate.attributes?.equipment ?? this.current?.attributes?.equipment ?? []),
                terrainAffinity: cloneData(candidate.attributes?.terrainAffinity ?? this.current?.attributes?.terrainAffinity ?? []),
                marchTraits: cloneData(candidate.attributes?.marchTraits ?? this.current?.attributes?.marchTraits ?? [])
            },
            revision: (Number(this.current?.revision) || 0) + 1,
            updatedAtVerse: Number.isFinite(Number(currentThreatState?.committedVerse))
                ? Number(currentThreatState.committedVerse)
                : (Number.isFinite(Number(this.gameState?.turn)) ? Number(this.gameState.turn) : null),
            lastTransition: cloneData(candidate.lastTransition ?? null)
        };

        this.current = Object.freeze(next);
        return { updated: true, state: this.getSnapshot() };
    }

    getSnapshot() {
        return cloneData(this.current);
    }

    getRestoreState() {
        return {
            current: this.getSnapshot(),
            lastThreat: cloneData(this.lastThreat ?? null)
        };
    }

    restoreState(snapshot) {
        if (!snapshot || typeof snapshot !== "object" || !snapshot.current || typeof snapshot.current !== "object") {
            throw new TypeError("TRUE_ENEMY_RESTORE_STATE_INVALID");
        }

        this.current = Object.freeze(cloneData(snapshot.current));
        this.lastThreat = cloneData(snapshot.lastThreat ?? null);
        return this.getRestoreState();
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default TrueEnemyStateService;
