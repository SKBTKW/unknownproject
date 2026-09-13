import { serializeGameState as serializeBaseGameState } from "./state_serializer_base.js";
import { createSerializerStateView } from "./state_serializer_state_view.js";

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

export function serializeGameState(state) {
    const serialized = serializeBaseGameState(createSerializerStateView(state));
    if (!serialized) return serialized;
    return {
        ...serialized,
        isGameOver: !!state?.isGameOver,
        runTermination: cloneData(state?.runTermination)
    };
}

export default serializeGameState;
