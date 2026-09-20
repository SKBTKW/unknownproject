function readPath(source, path) {
    if (!source || typeof source !== "object") return undefined;
    const parts = String(path || "").split(".").filter(Boolean);
    let current = source;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== "object") return undefined;
        current = current[part];
    }
    return current;
}

/**
 * Interpolates authored Advisor dialogue using an already-sanitized presentation
 * context. Missing placeholders remain visible instead of silently inventing data.
 */
export function formatAdvisorDialogueTemplate(template, context = {}) {
    if (typeof template !== "string") return "";
    return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, path) => {
        const value = readPath(context, path);
        if (value === undefined || value === null) return match;
        if (typeof value === "object") return match;
        return String(value);
    });
}

export default formatAdvisorDialogueTemplate;
