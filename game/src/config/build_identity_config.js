/* =============================================================
   BuildIdentityConfig
   開発ブランチ表示と製品版バージョン表示の設定正本
   ============================================================= */

const BUILD_IDENTITY_MODES = Object.freeze({
    DEVELOPMENT: "development",
    PRODUCTION: "production"
});

const BUILD_IDENTITY_CONFIG = Object.freeze({
    metadataEndpoint: "./__toa_build_identity__.json",
    productionVersionName: "PROTOTYPE",
    requestTimeoutMs: 800
});

export { BUILD_IDENTITY_CONFIG, BUILD_IDENTITY_MODES };
export default BUILD_IDENTITY_CONFIG;
