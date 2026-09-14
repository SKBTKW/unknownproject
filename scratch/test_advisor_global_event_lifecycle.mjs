import assert from 'node:assert/strict';
import { GlobalEventManager, GLOBAL_EVENT_TIMINGS } from '../game/src/systems/global_event_system.js';
import { AdvisorEventBridge } from '../game/src/ui/advisor/advisor_event_bridge.js';

function createLifecycleBus() {
    const listeners = new Set();
    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        emit(notification) {
            listeners.forEach(listener => listener(notification));
        },
        listenerCount() {
            return listeners.size;
        }
    };
}

// GlobalEventManager publishes START after the event has become active and END after expiry.
{
    const state = {
        turn: 3,
        activeGlobalEvents: [],
        eventCooldowns: {},
        temporaryWeightModifiers: [],
        lastGlobalEventTurn: 0,
        addLog() {}
    };
    const manager = new GlobalEventManager(state, null);
    const notifications = [];
    manager.subscribe(notification => notifications.push(notification));

    const instance = manager.triggerEvent('EVENT_COLD_WAVE');
    assert.ok(instance, 'cold wave should trigger');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].timing, GLOBAL_EVENT_TIMINGS.START);
    assert.equal(notifications[0].eventId, 'EVENT_COLD_WAVE');
    assert.equal(notifications[0].importance, 'MAJOR');

    manager.tickTurn();
    manager.tickTurn();
    manager.tickTurn();
    assert.equal(notifications.length, 2);
    assert.equal(notifications[1].timing, GLOBAL_EVENT_TIMINGS.END);
    assert.equal(notifications[1].eventId, 'EVENT_COLD_WAVE');
}

// Advisor OFF never becomes a prerequisite for Global Event lifecycle and emits no dialogue.
{
    const bus = createLifecycleBus();
    const emitted = [];
    const dialogueSystem = {
        emit() { return false; },
        emitTopic(result, context) {
            emitted.push({ result, context });
            return true;
        }
    };
    const bridge = new AdvisorEventBridge(dialogueSystem, null, {
        profile: { policy: { survival: 4 } },
        enabledProvider: () => false
    });

    bridge.observeSnapshot({
        turn: 1,
        trialActive: false,
        trialRemaining: 20,
        warningDuration: 5,
        state: { globalEventManager: bus },
        zoneCount: 0,
        linkCount: 0
    });
    assert.equal(bus.listenerCount(), 1, 'bridge should subscribe without changing event ownership');

    bus.emit({
        timing: 'START',
        eventId: 'EVENT_COLD_WAVE',
        category: 'ENVIRONMENT',
        importance: 'MAJOR',
        turn: 2
    });
    assert.equal(emitted.length, 0, 'advisor OFF must suppress only advisor reaction');
    bridge.destroy();
    assert.equal(bus.listenerCount(), 0, 'destroy should release lifecycle subscription');
}

// Advisor ON reacts once to lifecycle START, while repeated Verse snapshots do not replay it.
{
    const bus = createLifecycleBus();
    const emitted = [];
    const dialogueSystem = {
        emit() { return false; },
        emitTopic(result, context) {
            emitted.push({ result, context });
            return true;
        }
    };
    const bridge = new AdvisorEventBridge(dialogueSystem, null, {
        profile: { policy: { survival: 4 } },
        enabledProvider: () => true
    });

    const baseSnapshot = {
        trialActive: false,
        trialRemaining: 20,
        warningDuration: 5,
        state: { globalEventManager: bus },
        zoneCount: 0,
        linkCount: 0
    };
    bridge.observeSnapshot({ ...baseSnapshot, turn: 1 });
    bus.emit({
        timing: 'START',
        eventId: 'EVENT_DEMIHUMAN_SCOUTS',
        category: 'THREAT',
        importance: 'MAJOR',
        turn: 2
    });
    const afterStart = emitted.length;
    assert.equal(afterStart, 1, 'MAJOR threat START should produce one advisor reaction');

    bridge.observeSnapshot({ ...baseSnapshot, turn: 2 });
    bridge.observeSnapshot({ ...baseSnapshot, turn: 3 });
    assert.equal(emitted.length, afterStart, 'Verse snapshots must not replay Global Event reaction');

    bus.emit({
        timing: 'END',
        eventId: 'EVENT_DEMIHUMAN_SCOUTS',
        category: 'THREAT',
        importance: 'MAJOR',
        turn: 3
    });
    assert.equal(emitted.length, afterStart, 'END is not an advisor comment trigger by default');
    bridge.destroy();
}

console.log('Advisor × Global Event lifecycle boundary: OK');
