import assert from 'node:assert/strict';
import {
    AdvisorDialogueSystem,
    ADVISOR_DIALOGUE_MODES
} from '../game/src/ui/advisor/advisor_dialogue_system.js';

const makeProfile = policy => ({ personality: 'stern', policy });
const translateAll = key => `T:${key}`;

function makeSystem(policy, dialogueMode = ADVISOR_DIALOGUE_MODES.DETAILED, translate = translateAll) {
    return new AdvisorDialogueSystem({
        profile: makeProfile(policy),
        dialogueMode,
        translate,
        setTimer: () => null,
        clearTimer: () => {}
    });
}

const detailedEntry = {
    event: 'DEFENSE_WEAK',
    segmentGroups: [[
        'SEG_1',
        'SEG_2',
        'SEG_3'
    ]],
    lineKeys: ['LEGACY_LINE']
};

{
    const system = makeSystem({ defense: 4 });
    const mode = system.resolveDialogueMode(detailedEntry, ADVISOR_DIALOGUE_MODES.DETAILED);
    const line = system.resolveLine(detailedEntry, {}, mode);

    assert.equal(mode, ADVISOR_DIALOGUE_MODES.DETAILED, 'Policy 4 should allow detailed dialogue');
    assert.deepEqual(line.segmentKeys, ['SEG_1', 'SEG_2', 'SEG_3'], 'Detailed dialogue should include all three segments');
}

{
    const system = makeSystem({ defense: 3 });
    const mode = system.resolveDialogueMode(detailedEntry, ADVISOR_DIALOGUE_MODES.DETAILED);
    const line = system.resolveLine(detailedEntry, {}, mode);

    assert.equal(mode, ADVISOR_DIALOGUE_MODES.NORMAL, 'Policy 3 should cap detailed dialogue at normal');
    assert.deepEqual(line.segmentKeys, ['SEG_1', 'SEG_2'], 'Normal dialogue should include two segments');
}

{
    const system = makeSystem({ defense: 1 });
    const mode = system.resolveDialogueMode(detailedEntry, ADVISOR_DIALOGUE_MODES.DETAILED);
    const line = system.resolveLine(detailedEntry, {}, mode);

    assert.equal(mode, ADVISOR_DIALOGUE_MODES.COMPACT, 'Policy 1 should cap detailed dialogue at compact');
    assert.deepEqual(line.segmentKeys, ['SEG_1'], 'Compact dialogue should include one segment');
}

{
    const system = makeSystem({ defense: 4 });
    const mode = system.resolveDialogueMode(detailedEntry, ADVISOR_DIALOGUE_MODES.COMPACT);
    const line = system.resolveLine(detailedEntry, {}, mode);

    assert.equal(mode, ADVISOR_DIALOGUE_MODES.COMPACT, 'Policy must never deepen the player requested dialogue mode');
    assert.deepEqual(line.segmentKeys, ['SEG_1'], 'Player compact request should remain one segment');
}

{
    const translateWithMissingSegment = key => {
        if (key === 'SEG_2') return key;
        if (key === 'LEGACY_LINE') return 'Legacy fallback';
        return `T:${key}`;
    };
    const system = makeSystem({ defense: 4 }, ADVISOR_DIALOGUE_MODES.DETAILED, translateWithMissingSegment);
    const line = system.resolveLine(detailedEntry, {}, ADVISOR_DIALOGUE_MODES.DETAILED);

    assert.equal(line.text, 'Legacy fallback', 'Missing segment translation should fall back to legacy lineKeys');
    assert.equal(line.segmentKeys, null, 'Fallback must not expose incomplete segment keys as active dialogue');
    assert.equal(line.lineKey, 'LEGACY_LINE', 'Fallback should report the selected legacy line key');
}

console.log('✅ Advisor dialogue depth contract passed');