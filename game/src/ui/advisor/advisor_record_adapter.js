export function getAdvisorRecords(state, limit = 20) {
    const logs = Array.isArray(state?.gameLogs) ? state.gameLogs : [];
    return logs.slice(0, limit).map(raw => {
        const match = typeof raw === "string" ? raw.match(/^\[T(\d+)\]\s*(.*)$/) : null;
        return match
            ? { turn: Number(match[1]), message: match[2] }
            : { turn: state?.turn || 1, message: String(raw ?? "") };
    });
}
