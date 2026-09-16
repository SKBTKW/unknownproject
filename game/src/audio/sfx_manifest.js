/**
 * 🎵 sfx_manifest.js (SFX Event ID & 音源ファイルマニフェスト Single Source of Truth)
 * 
 * 責務:
 * 1. Event ID から音源ファイル相対パスへのマッピングを一元管理。
 * 2. ゲームロジック側でのファイルパス直書きを100%排除。
 */

export const SFX = Object.freeze({
    // 🎛️ UI イベント
    UI_CARD_SELECT: "assets/audio/sfx/ui/ui_card_select.wav",
    UI_CARD_CANCEL: "assets/audio/sfx/ui/ui_card_cancel.wav",

    // 🗺️ 地形カード選択イベント (10種)
    LAND_SELECT_PLAINS: "assets/audio/sfx/land/select/land_select_plains.wav",
    LAND_SELECT_HILL: "assets/audio/sfx/land/select/land_select_hill.wav",
    LAND_SELECT_MOUNTAIN: "assets/audio/sfx/land/select/land_select_mountain.wav",
    LAND_SELECT_DESERT: "assets/audio/sfx/land/select/land_select_desert.wav",
    LAND_SELECT_FOREST: "assets/audio/sfx/land/select/land_select_forest.wav",
    LAND_SELECT_DEEP_FOREST: "assets/audio/sfx/land/select/land_select_deep_forest.wav",
    LAND_SELECT_FOREST_HILL: "assets/audio/sfx/land/select/land_select_forest_hill.wav",
    LAND_SELECT_DEEP_HILL: "assets/audio/sfx/land/select/land_select_deep_hill.wav",
    LAND_SELECT_WASTELAND: "assets/audio/sfx/land/select/land_select_wasteland.wav",
    LAND_SELECT_WETLAND: "assets/audio/sfx/land/select/land_select_wetland.wav",

    // 🔨 土地アクション
    LAND_ROTATE: "assets/audio/sfx/land/action/land_rotate.wav",
    LAND_PLACE: "assets/audio/sfx/land/action/land_place.wav",
    LAND_UNDO: "assets/audio/sfx/land/action/land_undo.wav",
    LAND_PLACE_SOCKET: "assets/audio/sfx/land/action/land_place_socket.wav",

    // 🔗 連結即時ボーナス (1x2 / 1x3)
    LAND_CONNECT_1X2: "assets/audio/sfx/merge/merge_1x2.wav",
    LAND_CONNECT_1X3: "assets/audio/sfx/merge/merge_1x3.wav",
    MERGE_1X2: "assets/audio/sfx/merge/merge_1x2.wav",
    MERGE_1X3: "assets/audio/sfx/merge/merge_1x3.wav",

    // 🎉 2x2 正方形マージ
    MERGE_2X2: "assets/audio/sfx/merge/merge_2x2.wav",

    // 📜 コマンドカード発動
    COMMAND_EXECUTE: "assets/audio/sfx/command/command_execute.wav"
});
