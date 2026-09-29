export class BattleEpithetResolver {
    resolve(snapshot) {
        const key = snapshot?.resultEpithetKey;
        return typeof key === "string" && key.length > 0 ? key : null;
    }
}

export default BattleEpithetResolver;
