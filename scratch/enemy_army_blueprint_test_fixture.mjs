// Synthetic fixtures only; no production balance policy.
export function fixturePolicy() {
    const composition = (species, equipment) => ({
        speciesComposition: [{ type: species, share: 1 }],
        equipmentComposition: [{ type: equipment, share: 1 }]
    });
    return {
        id: 'test-only', version: 1,
        slots: Object.fromEntries(['A', 'B', 'C'].map(slot => [slot, [
            { weight: 1, composition: composition('LARGE', 'HEAVY') },
            { weight: 1, composition: composition('MEDIUM', 'STANDARD') },
            { weight: 1, composition: {
                speciesComposition: [{ type: 'SMALL', share: 0.75 }, { type: 'MEDIUM', share: 0.25 }],
                equipmentComposition: [{ type: 'LIGHT', share: 0.5 }, { type: 'STANDARD', share: 0.5 }]
            } }
        ]]))
    };
}
