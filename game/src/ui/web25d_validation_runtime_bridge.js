// Deprecated compatibility shim. Production code should import
// web25d_board_runtime_bridge.js and attachWeb25DBoardRuntime().
export {
    attachWeb25DBoardRuntime as attachWeb25DValidationRuntime,
    resolveWeb25DViewportProjection
} from './web25d_board_runtime_bridge.js';
export { attachWeb25DBoardRuntime as default } from './web25d_board_runtime_bridge.js';
