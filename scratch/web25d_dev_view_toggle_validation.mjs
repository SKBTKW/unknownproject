import assert from 'node:assert/strict';
import {
    shouldToggleWeb25DView
} from '../game/src/ui/web25d_validation_runtime_bridge.js';

const event = overrides => ({
    code: 'KeyV',
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    target: null,
    ...overrides
});

assert.equal(
    shouldToggleWeb25DView(event()),
    true,
    'Alt+Shift+V should toggle the Web 2.5D validation view.'
);

assert.equal(
    shouldToggleWeb25DView(event({ code: 'KeyB' })),
    false,
    'Unrelated shortcuts must not toggle the board view.'
);

assert.equal(
    shouldToggleWeb25DView(event({ altKey: false })),
    false,
    'The validation toggle requires Alt.'
);

assert.equal(
    shouldToggleWeb25DView(event({ shiftKey: false })),
    false,
    'The validation toggle requires Shift.'
);

for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(
        shouldToggleWeb25DView(event({ target: { tagName, isContentEditable: false } })),
        false,
        `Typing target ${tagName} must not trigger the board view toggle.`
    );
}

assert.equal(
    shouldToggleWeb25DView(event({ target: { tagName: 'DIV', isContentEditable: true } })),
    false,
    'Content-editable targets must not trigger the board view toggle.'
);

console.log('WEB25D_DEV_VIEW_TOGGLE_VALIDATION_OK');
