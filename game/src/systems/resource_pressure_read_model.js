/* =============================================================
   game/src/systems/resource_pressure_read_model.js
   Economy-owned semantic resource-pressure read model.
   Cards consume shortage facts; they do not own threshold logic.
   ============================================================= */

export const DEFAULT_MATERIAL_SHORTAGE_THRESHOLD = 30;

function finiteResource(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export class ResourcePressureReadModel {
    constructor({
        state,
        materialShortageThreshold = DEFAULT_MATERIAL_SHORTAGE_THRESHOLD
    } = {}) {
        this.state = state || null;
        this.materialShortageThreshold = Number.isFinite(Number(materialShortageThreshold))
            ? Number(materialShortageThreshold)
            : DEFAULT_MATERIAL_SHORTAGE_THRESHOLD;
    }

    readMaterial() {
        const state = this.state;
        if (!state) return 0;
        if (state.wood !== undefined) return finiteResource(state.wood);
        return finiteResource(state.material);
    }

    isMaterialShortage() {
        return this.readMaterial() <= this.materialShortageThreshold;
    }
}

export default ResourcePressureReadModel;
