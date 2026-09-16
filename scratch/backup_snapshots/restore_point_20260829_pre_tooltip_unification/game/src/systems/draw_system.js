/* =============================================================
   game/src/systems/draw_system.js
   DeckManager への後方互換リダイレクトモジュール
   ============================================================= */

import { DeckManager } from './deck_manager.js';
const Step1DrawSystem = DeckManager;

if (typeof window !== "undefined") {
    window.Step1DrawSystem = DeckManager;
}
if (typeof globalThis !== "undefined") {
    globalThis.Step1DrawSystem = DeckManager;
}

export { Step1DrawSystem, DeckManager };
export default Step1DrawSystem;
