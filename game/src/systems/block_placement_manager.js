/* =============================================================
   game/src/systems/block_placement_manager.js
   BlockPlacementSystem への後方互換リダイレクトモジュール (Pure ES Module)
   ============================================================= */

import { BlockPlacementSystem } from '../ui/block_placement_system.js';

if (typeof window !== "undefined") {
    window.BlockPlacementSystem = BlockPlacementSystem;
}
if (typeof globalThis !== "undefined") {
    globalThis.BlockPlacementSystem = BlockPlacementSystem;
}

export { BlockPlacementSystem };
export default BlockPlacementSystem;

