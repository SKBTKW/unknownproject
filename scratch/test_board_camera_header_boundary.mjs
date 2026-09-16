import assert from "node:assert/strict";
import { BoardCameraSystem } from "../game/src/ui/board_camera_system.js";

const camera = new BoardCameraSystem();
camera.panX = 0;
camera.panY = 0;
camera.currentZoom = 1;
camera.containerEl = {
    getBoundingClientRect: () => ({ left: 0, top: 80, right: 1000, bottom: 680, width: 1000, height: 600 })
};
camera.targetEl = {
    getBoundingClientRect: () => ({ left: 250, top: 90, right: 750, bottom: 590, width: 500, height: 500 })
};

const clamped = camera.clampPosition(0, -1000);
assert.equal(clamped.y, -10, "盤面上端をコンテナ上端（ヘッダー底面）で停止する");
assert.equal(90 + clamped.y, 80, "盤面グリッドがヘッダー底面より上へ移動しない");

console.log("Board camera header boundary: 2/2 PASS");
