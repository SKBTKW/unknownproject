import assert from 'node:assert/strict';
import {
    TUTORIAL_TARGET_TYPES,
    createTutorialTargetRef
} from '../game/src/presentation/tutorial_target_ref.js';
import { tutorialTargetToCameraIntent } from '../game/src/presentation/tutorial_target_camera_adapter.js';

const cellTarget = createTutorialTargetRef(
    TUTORIAL_TARGET_TYPES.BOARD_CELL,
    { cell: { r: 2, c: 4 } }
);
assert.deepEqual(cellTarget, { type: 'BOARD_CELL', cell: { r: 2, c: 4 } });
assert.deepEqual(tutorialTargetToCameraIntent(cellTarget), {
    type: 'FOCUS_CELL',
    cell: { r: 2, c: 4 }
});

const blockTarget = createTutorialTargetRef(
    TUTORIAL_TARGET_TYPES.BOARD_BLOCK,
    { blockId: 'placement:7', cells: [{ r: 1, c: 1 }, { r: 1, c: 2 }] }
);
assert.equal(tutorialTargetToCameraIntent(blockTarget).type, 'FOCUS_BLOCK');
assert.equal(tutorialTargetToCameraIntent(blockTarget).blockId, 'placement:7');

const handTarget = createTutorialTargetRef(TUTORIAL_TARGET_TYPES.HAND);
assert.equal(tutorialTargetToCameraIntent(handTarget), null);

const advisorAction = createTutorialTargetRef(
    TUTORIAL_TARGET_TYPES.ADVISOR_ACTION,
    { actionId: 'REPORT' }
);
assert.deepEqual(advisorAction, { type: 'ADVISOR_ACTION', actionId: 'REPORT' });

assert.equal('x' in cellTarget, false);
assert.equal('y' in cellTarget, false);
assert.equal('zoom' in cellTarget, false);

console.log('tutorial target ref contract ok');
