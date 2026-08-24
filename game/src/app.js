/* =============================================================
   game/src/app.js
   Pure ES Module Master Entry Point for Trial of Ages : Last Ember
   ============================================================= */

import { I18n } from './i18n.js';
import { LAND_SYSTEM_DATA } from './data/land_system.js';
import { DIRECTIVES, DirectiveSystem } from './systems/directive_system.js';
import { DeckManager, Step1DrawSystem } from './systems/deck_manager.js';
import { ProductionCalculator } from './systems/production_calculator.js';
import { UndoLandSystem } from './systems/undo_land_system.js';
import { GridEngine } from './systems/grid_engine.js';
import { BuffSystem } from './systems/buff_system.js';
import { GameState, Step1Engine, rotateShapeMatrix } from './v2_unity_ready_main.js';
import { GameEngine } from './core/game_engine.js';
import { ModalSystem } from './ui/modal_system.js';
import { LogComponent } from './ui/log_component.js';
import { BuffPanelComponent } from './ui/buff_panel_component.js';
import { territoryBadgeInstance as TerritoryBadgeComponent, TerritoryBadgeComponent as TerritoryBadgeComponentClass } from './ui/territory_badge_component.js';
import { UILayoutConfig, UI_FEATURE_FLAGS } from './ui/layout_config.js';
import { BlockPlacementSystem } from './ui/block_placement_system.js';
import { UIController } from './ui/ui_controller.js';
import { FocusLayerManager, focusLayerManager } from './ui/focus_layer_system.js';
import { BoardCameraSystem, boardCameraSystem } from './ui/board_camera_system.js';
import { GameSettings, gameSettings, SettingsModalSystem, settingsModalInstance } from './ui/settings_modal_system.js';
import { EmberStatusComponent } from './ui/ember_status_component.js';
import { HandCardsComponent } from './ui/hand_cards_component.js';
import { ReserveSlotComponent } from './ui/reserve_slot_component.js';
import { TopHeaderComponent } from './ui/top_header_component.js';
import { BoardGridComponent } from './ui/board_grid_component.js';
import { TooltipSystem, tooltipSystemInstance } from './ui/tooltip_system.js';

export {
    I18n,
    LAND_SYSTEM_DATA,
    DIRECTIVES,
    DirectiveSystem,
    DeckManager,
    Step1DrawSystem,
    ProductionCalculator,
    UndoLandSystem,
    GridEngine,
    BuffSystem,
    GameState,
    Step1Engine,
    rotateShapeMatrix,
    GameEngine,
    ModalSystem,
    LogComponent,
    BuffPanelComponent,
    TerritoryBadgeComponent,
    UILayoutConfig,
    UI_FEATURE_FLAGS,
    BlockPlacementSystem,
    UIController,
    FocusLayerManager,
    focusLayerManager,
    BoardCameraSystem,
    boardCameraSystem,
    GameSettings,
    gameSettings,
    SettingsModalSystem,
    settingsModalInstance,
    EmberStatusComponent,
    HandCardsComponent,
    ReserveSlotComponent,
    TopHeaderComponent,
    BoardGridComponent,
    TooltipSystem,
    tooltipSystemInstance
};

console.log('🎮 [App] Clean True ES Modules Master Entrypoint Loaded Successfully.');
