import {
    BoardPresentationGridComponent,
    TRIAL_VISUAL_CLASSES
} from '../game/src/ui/board_presentation_grid_component.js';
import { BOARD_CONTEXT_MODES } from '../game/src/presentation/board_presentation_state.js';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

class MockClassList {
    constructor(initial = []) {
        this.values = new Set(initial);
    }
    add(...items) { items.forEach(item => this.values.add(item)); }
    remove(...items) { items.forEach(item => this.values.delete(item)); }
    contains(item) { return this.values.has(item); }
    toggle(item, force) {
        const next = force === undefined ? !this.values.has(item) : Boolean(force);
        if (next) this.values.add(item);
        else this.values.delete(item);
        return next;
    }
}

class MockCell {
    constructor(r, c, classes = []) {
        this.attrs = new Map([
            ['data-r', String(r)],
            ['data-c', String(c)]
        ]);
        this.classList = new MockClassList(classes);
    }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    removeAttribute(name) { this.attrs.delete(name); }
}

class MockBoard {
    constructor(cells) {
        this.cells = cells;
        this.attrs = new Map();
    }
    querySelectorAll(selector) {
        return selector === '.cell' ? this.cells : [];
    }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
}

const cell = new MockCell(0, 0, TRIAL_VISUAL_CLASSES);
cell.setAttribute('data-trial-direction', 'south');
const board = new MockBoard([cell]);

globalThis.document = {
    getElementById(id) {
        return id === 'gridBoard' ? board : null;
    }
};

let readModel = {
    presentation: {
        viewMode: '2D',
        contextMode: BOARD_CONTEXT_MODES.NORMAL
    },
    trial: {
        activeRouteId: null
    },
    cells: [[{
        interaction: {
            hovered: true,
            focused: false,
            selected: false
        },
        trial: {
            onRoute: false,
            route: null,
            interceptionCandidate: null,
            plannedIntercept: null,
            battleMarker: null
        }
    }]]
};

const ui = {
    getBoardPresentationData() {
        return readModel;
    }
};

const component = new BoardPresentationGridComponent(ui);
component.applyBoardPresentation();

assert(
    board.getAttribute('data-board-context-mode') === BOARD_CONTEXT_MODES.NORMAL,
    'NORMAL context token missing'
);
assert(cell.classList.contains('board-logical-hover'), 'logical hover not applied');
for (const cls of TRIAL_VISUAL_CLASSES) {
    assert(!cell.classList.contains(cls), `NORMAL leaked legacy Trial class: ${cls}`);
}
assert(cell.getAttribute('data-trial-direction') === null, 'NORMAL leaked Trial direction');

readModel = {
    presentation: {
        viewMode: '2_5D',
        contextMode: BOARD_CONTEXT_MODES.TRIAL
    },
    trial: {
        activeRouteId: 'R1'
    },
    cells: [[{
        interaction: {
            hovered: false,
            focused: true,
            selected: true
        },
        trial: {
            onRoute: true,
            route: {
                routeId: 'R1',
                isRouteEntry: true,
                isRouteEnd: false,
                routeDirection: 'east'
            },
            interceptionCandidate: {
                canIntercept: true,
                isBlockPlannedByOther: false
            },
            plannedIntercept: {
                routeId: 'R1'
            },
            battleMarker: {
                isCurrent: true
            }
        }
    }]]
};

component.applyBoardPresentation();

assert(board.getAttribute('data-board-view-mode') === '2_5D', 'view token missing');
assert(cell.classList.contains('board-logical-focus'), 'logical focus not applied');
assert(cell.classList.contains('board-logical-selected'), 'logical selection not applied');
assert(cell.classList.contains('trial-route-cell'), 'Trial route not applied');
assert(cell.classList.contains('trial-route-entry'), 'Trial entry not applied');
assert(cell.classList.contains('trial-interception-candidate'), 'candidate not applied');
assert(cell.classList.contains('trial-interception-selected'), 'selection not applied');
assert(cell.classList.contains('trial-interception-planned'), 'planned marker not applied');
assert(cell.classList.contains('trial-interception-planned-active'), 'active plan not applied');
assert(cell.classList.contains('trial-battle-active'), 'battle marker not applied');
assert(cell.getAttribute('data-trial-direction') === 'east', 'route direction not applied');

console.log('PASS: BoardPresentationGridComponent semantic projection');
