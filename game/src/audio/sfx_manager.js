/**
 * 🔊 sfx_manager.js (The Age of Trials SFX統括マネージャー)
 * 
 * 責務:
 * 1. Event ID から音源を解決し、安全に再生を制御（new Audio の各所散乱を100%禁止）。
 * 2. 音声再生失敗や音源不在でもゲーム進行を絶対に止めない（100% Safe Fallback）。
 * 3. ブラウザ Autoplay 制約のスマート解除 (unlock)。
 * 4. クールダウン・多重発火抑制および土地配置 SE の優先度調停 (1アクション1主要SE)。
 */

import { SFX } from './sfx_manifest.js';

export class SfxManager {
    constructor() {
        this.manifest = SFX;
        this.volume = 1.0;
        this.enabled = true;
        this.isUnlocked = false;
        this.audioCache = new Map();
        this.lastPlayTimes = new Map();
        this.cooldownMs = 45; // 連打操作の最小インターバル
    }

    /**
     * 🔓 ブラウザ Autoplay 制約を解除
     */
    unlock() {
        if (this.isUnlocked) return;
        this.isUnlocked = true;

        if (typeof window !== "undefined" && window.AudioContext) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                if (ctx.state === "suspended") {
                    ctx.resume();
                }
            } catch (e) {
                // ignore
            }
        }
    }

    /**
     * 📦 全音源の事前ロード (ブラウザ環境のみ、ロード失敗時も安全)
     */
    preloadAll() {
        if (typeof window === "undefined" || typeof Audio === "undefined") return;

        for (const [eventId, path] of Object.entries(this.manifest)) {
            try {
                if (!this.audioCache.has(eventId)) {
                    const audio = new Audio();
                    audio.preload = "auto";
                    audio.src = path;
                    this.audioCache.set(eventId, audio);
                }
            } catch (e) {
                // ロード失敗時も例外を投げない
            }
        }
    }

    /**
     * 🔊 SFX の再生
     * @param {string} eventId - SFX Event ID (例: "LAND_PLACE", "MERGE_2X2")
     * @returns {boolean} 再生要求が受理されたかどうか
     */
    play(eventId) {
        if (!this.enabled || !eventId) return false;

        const path = this.manifest[eventId];
        if (!path) {
            console.warn(`[SFX] Unknown eventId: "${eventId}"`);
            return false;
        }

        // ⏱️ 同一 Event ID の過剰連続再生（連打）抑制
        const now = Date.now();
        const lastTime = this.lastPlayTimes.get(eventId) || 0;
        if (now - lastTime < this.cooldownMs) {
            return false;
        }
        this.lastPlayTimes.set(eventId, now);

        if (typeof window === "undefined" || typeof Audio === "undefined") {
            // Node.js 等のヘッドレステスト環境では安全に受理ログのみ
            return true;
        }

        try {
            const audio = new Audio(path);
            audio.volume = Math.max(0, Math.min(1, this.volume));
            const playPromise = audio.play();
            if (playPromise !== undefined && typeof playPromise.catch === "function") {
                playPromise.catch((err) => {
                    // Autoplay 制限や音源未配置 404 等でもゲームを絶対に止めない
                });
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 🎯 土地配置アクション結果から主要 SE を 1 つ決定して再生 (優先度調停)
     * 
     * 優先度:
     * MERGE_2X2 (100) > LAND_PLACE_SOCKET (80) > LAND_CONNECT_1X3 (70) > LAND_CONNECT_1X2 (60) > LAND_PLACE (50)
     * 
     * @param {Object} outcome - 土地配置メタデータ
     * @param {boolean} [outcome.merge2x2=false]
     * @param {boolean} [outcome.socketSpawned=false]
     * @param {boolean} [outcome.connection1x3=false]
     * @param {boolean} [outcome.connection1x2=false]
     * @returns {string} 選択された Event ID
     */
    resolveAndPlayPlacementOutcome(outcome = {}) {
        let chosenSfx = "LAND_PLACE";

        if (outcome.merge2x2) {
            chosenSfx = "MERGE_2X2";
        } else if (outcome.socketSpawned) {
            chosenSfx = "LAND_PLACE_SOCKET";
        } else if (outcome.connection1x3) {
            chosenSfx = "LAND_CONNECT_1X3";
        } else if (outcome.connection1x2) {
            chosenSfx = "LAND_CONNECT_1X2";
        }

        this.play(chosenSfx);
        return chosenSfx;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
    }
}

export const sfxManager = new SfxManager();

if (typeof window !== "undefined") {
    window.sfxManager = sfxManager;
    // 初回ユーザー操作で自動 unlock
    const unlockHandler = () => {
        sfxManager.unlock();
        window.removeEventListener("pointerdown", unlockHandler);
        window.removeEventListener("keydown", unlockHandler);
    };
    window.addEventListener("pointerdown", unlockHandler);
    window.addEventListener("keydown", unlockHandler);
}
if (typeof globalThis !== "undefined") {
    globalThis.sfxManager = sfxManager;
}
