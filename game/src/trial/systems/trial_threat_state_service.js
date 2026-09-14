import { GAME_FACT_TYPES } from "../../core/game_fact.js";
import { CivilizationDevelopmentSnapshotService } from "./civilization_development_snapshot_service.js";
import { TrialThreatResolver } from "./trial_threat_resolver.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function normalizeTrialIndex(value) {
    return Math.max(1, Math.floor(Number(value) || 1));
}

function defaultTrialIndexResolver(gameState) {
    return normalizeTrialIndex(gameState?.stage?.id);
}

/**
 * Threat-relevant state changeをVerse境界で一括反映する状態サービス。
 *
 * - CIVILIZATION_DEVELOPMENT_CHANGED: dirty化のみ
 * - VERSE_COMMITTED: dirty時だけ最新SnapshotからThreatを再計算
 * - 更新確定後にTRIAL_THREAT_UPDATEDをpublish
 * - Investigation / Advisor / UIはThreat更新契機にしない
 * - TrueEnemyStateの変化はこのサービスの責務外
 */
export class TrialThreatStateService {
    constructor({
        gameState,
        gameFactHub,
        developmentSnapshotService = new CivilizationDevelopmentSnapshotService(),
        threatResolver = new TrialThreatResolver(),
        trialIndexResolver = defaultTrialIndexResolver
    } = {}) {
        if (!gameState) throw new TypeError("TRIAL_THREAT_GAME_STATE_REQUIRED");
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("TRIAL_THREAT_GAME_FACT_HUB_REQUIRED");
        }
        if (!developmentSnapshotService || typeof developmentSnapshotService.capture !== "function") {
            throw new TypeError("TRIAL_THREAT_DEVELOPMENT_SNAPSHOT_SERVICE_REQUIRED");
        }
        if (!threatResolver || typeof threatResolver.resolve !== "function") {
            throw new TypeError("TRIAL_THREAT_RESOLVER_REQUIRED");
        }
        if (typeof trialIndexResolver !== "function") {
            throw new TypeError("TRIAL_THREAT_INDEX_RESOLVER_REQUIRED");
        }

        this.gameState = gameState;
        this.gameFactHub = gameFactHub;
        this.developmentSnapshotService = developmentSnapshotService;
        this.threatResolver = threatResolver;
        this.trialIndexResolver = trialIndexResolver;

        this.dirty = false;
        this.revision = 0;
        this.lastCommittedVerse = null;
        this.lastDevelopmentChange = null;

        const initialDevelopment = this.developmentSnapshotService.capture(this.gameState);
        const initialTrialIndex = normalizeTrialIndex(this.trialIndexResolver(this.gameState));
        const initialThreat = this.threatResolver.resolve({
            trialIndex: initialTrialIndex,
            development: initialDevelopment
        });

        this.current = Object.freeze({
            trialIndex: initialTrialIndex,
            development: cloneData(initialDevelopment),
            threat: cloneData(initialThreat),
            revision: this.revision,
            committedVerse: null
        });

        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || !fact.type) return;

        if (fact.type === GAME_FACT_TYPES.CIVILIZATION_DEVELOPMENT_CHANGED) {
            this.dirty = true;
            this.lastDevelopmentChange = cloneData(fact.payload || {});
            return;
        }

        if (fact.type === GAME_FACT_TYPES.VERSE_COMMITTED && this.dirty) {
            this.recalculateAtVerseBoundary(fact.payload || {});
        }
    }

    recalculateAtVerseBoundary(boundary = {}) {
        if (!this.dirty) {
            return {
                updated: false,
                state: this.getReadModel()
            };
        }

        const previous = cloneData(this.current);
        const development = this.developmentSnapshotService.capture(this.gameState);
        const trialIndex = normalizeTrialIndex(this.trialIndexResolver(this.gameState));
        const threat = this.threatResolver.resolve({ trialIndex, development });
        this.revision += 1;
        this.lastCommittedVerse = Number.isFinite(Number(boundary.completedTurn))
            ? Number(boundary.completedTurn)
            : null;
        this.dirty = false;

        this.current = Object.freeze({
            trialIndex,
            development: cloneData(development),
            threat: cloneData(threat),
            revision: this.revision,
            committedVerse: this.lastCommittedVerse
        });

        if (typeof this.gameFactHub.emit === "function") {
            this.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_THREAT_UPDATED, {
                previous,
                current: cloneData(this.current)
            });
        }

        return {
            updated: true,
            state: this.getReadModel()
        };
    }

    markDirty(payload = {}) {
        this.dirty = true;
        this.lastDevelopmentChange = cloneData(payload);
    }

    isDirty() {
        return this.dirty;
    }

    getCurrentThreat() {
        return cloneData(this.current?.threat || null);
    }

    getReadModel() {
        return {
            dirty: this.dirty,
            revision: this.revision,
            lastCommittedVerse: this.lastCommittedVerse,
            lastDevelopmentChange: cloneData(this.lastDevelopmentChange),
            current: cloneData(this.current)
        };
    }

    getRestoreState() {
        return this.getReadModel();
    }

    restoreState(snapshot) {
        if (!snapshot || typeof snapshot !== "object" || !snapshot.current || typeof snapshot.current !== "object") {
            throw new TypeError("TRIAL_THREAT_RESTORE_STATE_INVALID");
        }

        this.dirty = Boolean(snapshot.dirty);
        this.revision = Math.max(0, Math.floor(Number(snapshot.revision) || 0));
        this.lastCommittedVerse = Number.isFinite(Number(snapshot.lastCommittedVerse))
            ? Number(snapshot.lastCommittedVerse)
            : null;
        this.lastDevelopmentChange = cloneData(snapshot.lastDevelopmentChange ?? null);
        this.current = Object.freeze(cloneData(snapshot.current));
        return this.getRestoreState();
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default TrialThreatStateService;
