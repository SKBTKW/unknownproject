export function isDevelopmentMode({ globalObject, locationObject } = {}) {
    const runtimeGlobal = globalObject ?? (typeof window !== "undefined" ? window : null);
    const runtimeLocation = locationObject ?? runtimeGlobal?.location ?? null;
    const searchParams = runtimeLocation && typeof runtimeLocation.search === "string"
        ? new URLSearchParams(runtimeLocation.search)
        : null;
    return runtimeGlobal?.__TOA_DEV_MODE__ === true || searchParams?.get("dev") === "1";
}
