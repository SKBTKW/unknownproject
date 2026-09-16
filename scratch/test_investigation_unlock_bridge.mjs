import { InvestigationUnlockBridge } from '../game/src/warning/index.js';
import { GLOBAL_EVENT_TIMINGS } from '../game/src/systems/global_event_system.js';

const listeners = new Set();
const manager = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit(notification) {
    for (const listener of listeners) listener(notification);
  }
};

const state = { turn: 4, investigationUnlocked: false };
const bridge = new InvestigationUnlockBridge();
const attached = bridge.attach({ state, globalEventManager: manager });
if (!attached.success) throw new Error('unlock bridge failed to attach');

manager.emit({ timing: GLOBAL_EVENT_TIMINGS.START, eventId: 'EVENT_COLD_WAVE', turn: 4 });
if (state.investigationUnlocked) throw new Error('unrelated event unlocked investigation');

manager.emit({ timing: GLOBAL_EVENT_TIMINGS.END, eventId: 'EVENT_DEMIHUMAN_SCOUTS', turn: 5 });
if (state.investigationUnlocked) throw new Error('event END unlocked investigation');

manager.emit({ timing: GLOBAL_EVENT_TIMINGS.START, eventId: 'EVENT_DEMIHUMAN_SCOUTS', turn: 5 });
if (state.investigationUnlocked) throw new Error('demihuman scouts incorrectly unlocked investigation');

manager.emit({ timing: GLOBAL_EVENT_TIMINGS.START, eventId: 'EVENT_DEMIHUMAN_TRACES', turn: 8 });
if (!state.investigationUnlocked) throw new Error('demihuman traces did not unlock investigation');
if (state.investigationUnlockedAtVerse !== 8) throw new Error('unlock verse not recorded from traces');

manager.emit({ timing: GLOBAL_EVENT_TIMINGS.START, eventId: 'EVENT_DEMIHUMAN_TRACES', turn: 10 });
if (state.investigationUnlockedAtVerse !== 8) throw new Error('unlock was not idempotent');

bridge.detach();
console.log('PASS investigation unlock bridge');
