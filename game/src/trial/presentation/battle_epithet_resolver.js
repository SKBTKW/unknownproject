export class BattleEpithetResolver {
    resolve(snapshot) {
        const key = snapshot?.resultEpithetKey
            ?? snapshot?.presentationFacts?.find?.(row => row?.type === "BATTLE_EPITHET")?.key
            ?? null;
        return typeof key === "string" && key.length > 0 ? key : null;
    }
}

export default BattleEpithetResolver;
