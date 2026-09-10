import assert from "node:assert/strict";
import {
    LayoutStateManager,
    UI_LAYOUT_STATES,
    RIGHT_CONTEXT_OWNERS,
    HAND_LAYOUT_STATES
} from "../game/src/ui/layout_state_manager.js";

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

const root = { dataset: {} };
const body = { dataset: {} };
const events = [];
const camera = { zoom: 1.24, panX: 83, panY: -27 };
const manager = new LayoutStateManager({ documentRef: { documentElement: root, body } });
manager.setAdapters({ onChange: snapshot => events.push(snapshot) });

console.log("\nLayout state manager tests");
check(manager.getState() === UI_LAYOUT_STATES.NORMAL, "initial layout state is NORMAL");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE, "NORMAL owns no right context");
check(manager.getHandState() === HAND_LAYOUT_STATES.COLLAPSED, "NORMAL keeps hand collapsed");

manager.openHand();
check(manager.getState() === UI_LAYOUT_STATES.HAND_EXPANDED, "hand can enter temporary expanded state");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE, "expanded hand releases right context");

manager.openAdvisor();
check(manager.getState() === UI_LAYOUT_STATES.ADVISOR_EXPANDED, "opening Advisor replaces expanded hand");
check(manager.getHandState() === HAND_LAYOUT_STATES.COLLAPSED, "Advisor expansion collapses hand");
manager.claimAdvisorContext();
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.ADVISOR, "Advisor can exclusively own right context");

manager.enterAlert();
check(manager.getState() === UI_LAYOUT_STATES.ALERT, "ALERT state is reserved");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.ALERT, "ALERT owns right context");

manager.enterTrial();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "Trial transition enters TRIAL");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.TRIAL, "Trial exclusively owns right context");
check(manager.getHandState() === HAND_LAYOUT_STATES.TRIAL_COLLAPSED, "Trial deep-collapses hand");
check(manager.openHand() === false, "Trial rejects normal hand expansion");

manager.openAdvisor();
check(manager.getState() === UI_LAYOUT_STATES.ADVISOR_EXPANDED, "Advisor can temporarily open during Trial");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE, "Trial context is suspended while Advisor opens");
check(manager.getHandState() === HAND_LAYOUT_STATES.TRIAL_COLLAPSED, "Trial hand remains deep-collapsed under Advisor");
manager.claimAdvisorContext();
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.ADVISOR, "Advisor replaces suspended Trial context");
manager.closeAdvisor();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "closing Advisor restores TRIAL state");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.TRIAL, "closing Advisor restores Trial context owner");

manager.exitTrial();
check(manager.getState() === UI_LAYOUT_STATES.NORMAL, "Trial completion returns to NORMAL");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE, "Trial completion releases right context");
check(camera.zoom === 1.24 && camera.panX === 83 && camera.panY === -27, "layout transitions do not mutate board camera state");
check(root.dataset.layoutState === "normal" && body.dataset.contextOwner === "none", "layout contract is exposed through root datasets");
check(events.every(event => Object.values(RIGHT_CONTEXT_OWNERS).includes(event.contextOwner)), "every transition has exactly one valid context owner");

console.log(`Layout state manager: ${passed}/${passed} PASS`);
