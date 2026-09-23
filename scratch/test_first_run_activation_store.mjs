import assert from "node:assert/strict";
import fs from "node:fs";

import {
    BrowserFirstRunActivationStore,
    FIRST_RUN_ACTIVATION_SCHEMA_VERSION,
    FIRST_RUN_ACTIVATION_STORAGE_KEY
} from "../game/src/tutorial/browser_first_run_activation_store.js";
import { UIController } from "../game/src/ui/ui_controller.js";
import { FIRST_RUN_TRIAL_TUTORIAL_EVENTS } from "../game/src/tutorial/first_run_trial_tutorial_service.js";

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }
    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }
    setItem(key, value) {
        this.values.set(key, String(value));
    }
}

console.log("\nFirstRun browser activation store contract");

{
    const storage = new MemoryStorage();
    const store = new BrowserFirstRunActivationStore({ storage });

    assert.equal(store.isFirstRun(), true, "missing completion marker must activate FirstRun");

    const marked = store.markCompleted();
    assert.equal(marked.success, true, "completion marker must persist");
    assert.equal(store.isFirstRun(), false, "completed player must not re-enter FirstRun");

    const parsed = JSON.parse(storage.getItem(FIRST_RUN_ACTIVATION_STORAGE_KEY));
    assert.deepEqual(parsed, {
        schemaVersion: FIRST_RUN_ACTIVATION_SCHEMA_VERSION,
        completed: true
    });
}

{
    const storage = new MemoryStorage();
    storage.setItem(FIRST_RUN_ACTIVATION_STORAGE_KEY, "{broken");
    const store = new BrowserFirstRunActivationStore({ storage });
    assert.equal(store.isFirstRun(), true, "corrupt marker must fail open to FirstRun");
}

{
    const store = new BrowserFirstRunActivationStore({
        storage: {
            getItem() {
                throw new Error("read blocked");
            },
            setItem() {
                throw new Error("write blocked");
            }
        }
    });
    assert.equal(store.isFirstRun(), true, "storage read failure must not skip FirstRun");
    assert.deepEqual(
        store.markCompleted(),
        { success: false, reason: "STORAGE_WRITE_FAILED" },
        "storage write failure must not break gameplay"
    );
}

{
    let completionWrites = 0;
    const fakeUi = {
        firstRunTrialTutorialService: {
            record() {
                return { active: false, completed: true, currentStep: "COMPLETED" };
            }
        },
        engine: {
            firstRunState: { active: true },
            firstRunActivationStore: {
                markCompleted() {
                    completionWrites += 1;
                    return { success: true, completed: true };
                }
            }
        },
        trialController: {
            state: { trialIndex: 1 }
        },
        trialActionTrayComponent: {
            render() {}
        }
    };

    UIController.prototype.recordFirstRunTrialTutorialEvent.call(
        fakeUi,
        FIRST_RUN_TRIAL_TUTORIAL_EVENTS.ROUTE_ACKNOWLEDGED
    );
    assert.equal(completionWrites, 0, "non-causality tutorial events must not persist completion");

    const completed = UIController.prototype.recordFirstRunTrialTutorialEvent.call(
        fakeUi,
        FIRST_RUN_TRIAL_TUTORIAL_EVENTS.CAUSALITY_OBSERVED
    );
    assert.equal(completed.completed, true);
    assert.equal(completionWrites, 1, "causality acknowledgement must persist FirstRun completion");
    assert.deepEqual(fakeUi.lastFirstRunActivationPersistenceResult, {
        success: true,
        completed: true
    });
}

{
    const indexHtml = fs.readFileSync(new URL("../game/index.html", import.meta.url), "utf8");
    const normalized = indexHtml.replace(/\s+/g, " ");
    assert.match(
        normalized,
        /firstRun\s*:\s*firstRunActivationStore\.isFirstRun\(\)/,
        "browser bootstrap must supply an explicit persisted FirstRun activation decision"
    );
    assert.match(
        normalized,
        /firstRunActivationStore\s*(?:,|\})/,
        "browser bootstrap must pass the activation persistence port into GameEngine"
    );
}

console.log("✅ FirstRun browser activation store contract PASS");
