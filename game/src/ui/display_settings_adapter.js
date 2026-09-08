export class DisplaySettingsAdapter {
    constructor(rootResolver = () => globalThis.document?.documentElement || null) {
        this.rootResolver = rootResolver;
    }

    applyResolution(value) {
        const match = /^(\d+)x(\d+)$/.exec(String(value));
        if (!match) return false;

        const root = this.rootResolver();
        if (!root) return true;

        root.dataset.resolution = value;
        root.style?.setProperty?.("--display-target-width", `${match[1]}px`);
        root.style?.setProperty?.("--display-target-height", `${match[2]}px`);
        return true;
    }
}

export const displaySettingsAdapter = new DisplaySettingsAdapter();
