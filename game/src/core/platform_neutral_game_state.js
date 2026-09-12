import { I18n } from '../i18n.js';
import { GameState as LegacyGameState } from '../v2_unity_ready_main.js';
import { WorldInitializationService } from './world_initialization_service.js';

/**
 * Platform-neutral GameState boundary used by host runtimes.
 *
 * The legacy GameState still contains browser-era presentation fallbacks.
 * This adapter makes the default browser bootstrap consume GameState without
 * discovering window/globalThis UI. Unity can provide its own presentation
 * sinks later without changing domain callers.
 */
export class PlatformNeutralGameState extends LegacyGameState {
    constructor(dependencies = {}) {
        const gameplayRandom = dependencies.gameplayRandom || dependencies.engine?.gameplayRandom || null;
        if (!gameplayRandom) throw new Error('GAMEPLAY_RANDOM_REQUIRED');
        super({ ...dependencies, gameplayRandom });
        this.gameplayRandom = gameplayRandom;
        this.logSink = dependencies.logSink || null;
    }

    /**
     * LegacyGameState calls initGrid during super construction. Overriding it
     * here moves initial world generation behind a deterministic, host-neutral
     * service without forcing a large rewrite of the legacy state class.
     */
    initGrid(size = 5) {
        const gameplayRandom = this.gameplayRandom || this.engine?.gameplayRandom || null;
        if (!gameplayRandom) throw new Error('GAMEPLAY_RANDOM_REQUIRED');
        return new WorldInitializationService(gameplayRandom).createInitialGrid(size);
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
