import { I18n } from '../i18n.js';
import { GameState as LegacyGameState } from '../v2_unity_ready_main.js';

/**
 * Platform-neutral GameState boundary used by host runtimes.
 *
 * The legacy GameState still contains browser-era presentation fallbacks.
 * This adapter makes the default browser bootstrap consume GameState without
 * discovering window/globalThis UI. Unity can provide its own log sink later
 * without changing domain callers.
 */
export class PlatformNeutralGameState extends LegacyGameState {
    constructor(dependencies = {}) {
        super(dependencies);
        this.logSink = dependencies.logSink || null;
    }

    addLog(msg) {
        let finalMsg = msg;
        if (typeof msg === 'string' && msg.startsWith('LOG_') && I18n && typeof I18n.t === 'function') {
            finalMsg = I18n.t(msg);
        }

        this.gameLogs.unshift(finalMsg);
        if (this.gameLogs.length > 50) this.gameLogs.pop();

        const turn = this.turn || 1;
        if (typeof this.logSink === 'function') {
            this.logSink({ message: finalMsg, turn });
        } else if (this.logSink && typeof this.logSink.addLog === 'function') {
            this.logSink.addLog(finalMsg, turn);
        }
    }
}

export default PlatformNeutralGameState;
