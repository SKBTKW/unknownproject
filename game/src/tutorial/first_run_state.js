function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Service-owned runtime state for FirstRun / tutorial orchestration.
 *
 * Keeps track of whether FirstRun policy is active, which tutorial scenes
 * have occurred, and whether the basic game loop has completed.
 *
 * This state is owned by the engine (engine.firstRunState), NOT inside GameState.
 */
export class FirstRunState {
    constructor({
        active = false,
        occurredScenes = [],
        basicLoopComplete = false
    } = {}) {
        this.active = active === true;
        this.occurredScenes = new Set(Array.isArray(occurredScenes) ? occurredScenes : []);
        this.basicLoopComplete = basicLoopComplete === true;
    }

    recordScene(sceneId) {
        if (typeof sceneId === "string" && sceneId.trim()) {
            this.occurredScenes.add(sceneId.trim());
        }
    }

    hasSceneOccurred(sceneId) {
        return this.occurredScenes.has(sceneId);
    }

    setBasicLoopComplete(value = true) {
        this.basicLoopComplete = value === true;
    }

    getRestoreState() {
        return {
            active: this.active,
            occurredScenes: Array.from(this.occurredScenes),
            basicLoopComplete: this.basicLoopComplete
        };
    }

    restoreState(snapshot) {
        if (!snapshot || typeof snapshot !== "object") {
            return this.getRestoreState();
        }
        if (typeof snapshot.active === "boolean") {
            this.active = snapshot.active;
        }
        if (Array.isArray(snapshot.occurredScenes)) {
            this.occurredScenes = new Set(snapshot.occurredScenes);
        }
        if (typeof snapshot.basicLoopComplete === "boolean") {
            this.basicLoopComplete = snapshot.basicLoopComplete;
        }
        return this.getRestoreState();
    }
}

export default FirstRunState;
