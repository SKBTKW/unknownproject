import { hydrateGameState as hydrateBaseGameState } from "./hydrate_game_state_base.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export function hydrateGameState(state, serialized, options = {}) {
    if (!serialized || typeof serialized !== "object") {
        throw new TypeError("HYDRATE_GAME_STATE_REQUIRED");
    }

    const {
        isGameOver = false,
        runTermination = null,
        ...baseSerialized
    } = serialized;

    const hydrated = hydrateBaseGameState(state, baseSerialized, options);
    hydrated.isGameOver = !!isGameOver;
    hydrated.runTermination = cloneData(runTermination) ?? null;
    return hydrated;
}

export default hydrateGameState;
