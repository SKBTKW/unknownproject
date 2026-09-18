export const WEB25D_MATERIALIZATION_DURATION_MS = 480;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function cellKey(r, c) {
    return `${r}:${c}`;
}

/**
 * Renderer-local animation state for Web 2.5D placement feedback.
 *
 * It observes BoardPresentationData snapshots and only tracks the visual
 * transition from unplaced -> placed. No placement rule or GameState state is
 * stored here.
 */
export class Web25DMaterializationState {
    constructor({
        durationMs = WEB25D_MATERIALIZATION_DURATION_MS,
        groundEnd = 0.34,
        growthEnd = 0.72
    } = {}) {
        this.durationMs = Math.max(1, Number(durationMs) || WEB25D_MATERIALIZATION_DURATION_MS);
        this.groundEnd = clamp01(groundEnd);
        this.growthEnd = Math.max(this.groundEnd, clamp01(growthEnd));
        this.active = new Map();
        this.primed = false;
    }

    update(previousModel, nextModel, nowMs = 0) {
        this.prune(nowMs);

        if (!this.primed) {
            this.primed = true;
            return Object.freeze([]);
        }

        const started = [];
        for (const row of nextModel?.cells || []) {
            for (const cell of row || []) {
                if (!cell?.placed) continue;
                const previousCell = previousModel?.cells?.[cell.r]?.[cell.c] || null;
                if (previousCell?.placed) continue;

                const key = cellKey(cell.r, cell.c);
                this.active.set(key, Object.freeze({
                    r: cell.r,
                    c: cell.c,
                    startedAt: nowMs
                }));
                started.push(Object.freeze({ r: cell.r, c: cell.c }));
            }
        }
        return Object.freeze(started);
    }

    getCellState(r, c, nowMs = 0) {
        const key = cellKey(r, c);
        const entry = this.active.get(key);
        if (!entry) {
            return Object.freeze({ active: false, progress: 1, ground: 1, growth: 1, resource: 1 });
        }

        const progress = clamp01((nowMs - entry.startedAt) / this.durationMs);
        if (progress >= 1) {
            this.active.delete(key);
            return Object.freeze({ active: false, progress: 1, ground: 1, growth: 1, resource: 1 });
        }

        const ground = this.groundEnd <= 0
            ? 1
            : clamp01(progress / this.groundEnd);
        const growthRange = Math.max(0.0001, this.growthEnd - this.groundEnd);
        const growth = clamp01((progress - this.groundEnd) / growthRange);
        const resourceRange = Math.max(0.0001, 1 - this.growthEnd);
        const resource = clamp01((progress - this.growthEnd) / resourceRange);

        return Object.freeze({ active: true, progress, ground, growth, resource });
    }

    hasActive(nowMs = 0) {
        this.prune(nowMs);
        return this.active.size > 0;
    }

    prune(nowMs = 0) {
        for (const [key, entry] of this.active.entries()) {
            if (nowMs - entry.startedAt >= this.durationMs) {
                this.active.delete(key);
            }
        }
    }

    clear() {
        this.active.clear();
        this.primed = false;
    }
}

export default Web25DMaterializationState;
