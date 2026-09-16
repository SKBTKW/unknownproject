/* =============================================================
   BuildIdentityService
   実行環境のブランチ名または製品バージョン名を解決する
   ============================================================= */

import {
    BUILD_IDENTITY_CONFIG,
    BUILD_IDENTITY_MODES
} from '../config/build_identity_config.js';

function normalizeBuildIdentity(rawIdentity, config = BUILD_IDENTITY_CONFIG) {
    const raw = rawIdentity && typeof rawIdentity === "object" ? rawIdentity : {};
    const mode = raw.mode === BUILD_IDENTITY_MODES.DEVELOPMENT
        ? BUILD_IDENTITY_MODES.DEVELOPMENT
        : BUILD_IDENTITY_MODES.PRODUCTION;
    const branchName = typeof raw.branchName === "string" ? raw.branchName.trim() : "";
    const commitId = typeof raw.commitId === "string" ? raw.commitId.trim() : "";
    const versionName = typeof raw.versionName === "string" ? raw.versionName.trim() : "";

    if (mode === BUILD_IDENTITY_MODES.DEVELOPMENT && branchName) {
        return Object.freeze({ mode, value: branchName, commitId });
    }

    return Object.freeze({
        mode: BUILD_IDENTITY_MODES.PRODUCTION,
        value: versionName || config.productionVersionName,
        commitId: ""
    });
}

class BuildIdentityService {
    constructor({
        config = BUILD_IDENTITY_CONFIG,
        fetchFn = typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
            ? globalThis.fetch.bind(globalThis)
            : null,
        injectedIdentity = typeof globalThis !== "undefined"
            ? globalThis.__TOA_BUILD_IDENTITY__
            : null
    } = {}) {
        this.config = config;
        this.fetchFn = fetchFn;
        this.injectedIdentity = injectedIdentity;
    }

    async resolve() {
        if (this.injectedIdentity) {
            return normalizeBuildIdentity(this.injectedIdentity, this.config);
        }

        const developmentIdentity = await this.fetchDevelopmentIdentity();
        if (developmentIdentity) {
            return normalizeBuildIdentity(developmentIdentity, this.config);
        }

        return normalizeBuildIdentity({
            mode: BUILD_IDENTITY_MODES.PRODUCTION,
            versionName: this.config.productionVersionName
        }, this.config);
    }

    async fetchDevelopmentIdentity() {
        if (!this.fetchFn || !this.config.metadataEndpoint) return null;

        const abortController = typeof AbortController !== "undefined"
            ? new AbortController()
            : null;
        const timeoutId = abortController && typeof setTimeout === "function"
            ? setTimeout(() => abortController.abort(), this.config.requestTimeoutMs)
            : null;

        try {
            const response = await this.fetchFn(this.config.metadataEndpoint, {
                cache: "no-store",
                signal: abortController ? abortController.signal : undefined
            });
            if (!response || !response.ok || typeof response.json !== "function") return null;
            return await response.json();
        } catch (_error) {
            return null;
        } finally {
            if (timeoutId !== null && typeof clearTimeout === "function") {
                clearTimeout(timeoutId);
            }
        }
    }
}

export { BuildIdentityService, normalizeBuildIdentity };
export default BuildIdentityService;
