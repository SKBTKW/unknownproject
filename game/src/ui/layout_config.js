/**
 * 📐 UILayoutConfig
 * ゲーム全UI要素の絶対レイアウト・位置座標・2層レイヤー構造・重ね順(z-index)を一括集中管理する設定ファイル
 */
const UI_TILE_TEXT_PRESETS = {
    DEFAULT: "DEFAULT",               // 0. 現行スタイル (100%完全保持・即時復元用)
    PILL_BADGE: "PILL_BADGE",         // 1. アイデアA: 上品な半透明カプセルUI
    ICON_SYMMETRIC: "ICON_SYMMETRIC", // 2. アイデアB: アイコン完全対称・シンプル
    MODERN_BOARD: "MODERN_BOARD",     // 3. ハイブリッド: ボードゲーム風モダン階層UI
    SYMBOLIC_BOARD: "SYMBOLIC_BOARD"  // 4. 新パターン: 右上産出 + 左下属性＆資源 (マージン2px)
};

const UI_FEATURE_FLAGS = {
    enableBottomFocusBlur: true,  // 🌟 2層レイヤー構造（手札ホバー時の盤面暗転ブラー）有効化
    enableReserveArea: false,
    tileTextStyle: UI_TILE_TEXT_PRESETS.SYMBOLIC_BOARD // 🎨 デフォルトを「4. 新アイコン配置(右上産出+左下属性＆資源)」に設定
};

const UILayoutConfig = {
    // 🎲 画面右辺右下隅ダイストレイ HUD (完全受動 / pointer-events: none / 右辺沿い)
    diceWidget: {
        desktop: {
            position: "fixed",
            right: "16px",
            bottom: "80px",
            width: "180px",
            diceSize: "32px",
            zIndex: 850,
            pointerEvents: "none"
        },
        mobile: {
            position: "fixed",
            right: "8px",
            bottom: "60px",
            width: "140px",
            diceSize: "26px",
            zIndex: 850,
            pointerEvents: "none"
        },
        importanceThemes: {
            NORMAL: {
                rollDurationMs: 650,
                displayDurationMs: 1000,
                borderColor: "#64748b",
                badgeBg: "#1e293b",
                badgeColor: "#f8fafc",
                glowShadow: "0 0 10px rgba(100, 116, 139, 0.3)"
            },
            TACTICAL: {
                rollDurationMs: 700,
                displayDurationMs: 1200,
                borderColor: "#3b82f6",
                badgeBg: "#1e3a8a",
                badgeColor: "#60a5fa",
                glowShadow: "0 0 15px rgba(59, 130, 246, 0.45)"
            },
            CRITICAL: {
                rollDurationMs: 800,
                displayDurationMs: 1600,
                borderColor: "#f59e0b",
                badgeBg: "#78350f",
                badgeColor: "#fbbf24",
                glowShadow: "0 0 22px rgba(245, 158, 11, 0.6)"
            }
        }
    },

    // 🧪 テスト用ダイス判定 HUD (画面左下・コンパクト)
    devDiceControls: {
        desktop: {
            position: "fixed",
            left: "24px",
            bottom: "24px",
            zIndex: 700,
            pointerEvents: "auto"
        },
        mobile: {
            position: "fixed",
            left: "12px",
            bottom: "12px",
            zIndex: 700,
            pointerEvents: "auto"
        }
    },

    devChronicleRestore: {
        position: "fixed",
        top: "72px",
        right: "24px",
        width: "270px",
        maxHeight: "calc(100vh - 96px)",
        zIndex: 900,
        pointerEvents: "auto"
    },

    // ⚔️ Trial迎撃計画: Layout-owned screen-space geometry only.
    trialDefenseAllocation: {
        desktop: {
            position: "fixed",
            right: "var(--layout-right-context-right)",
            top: "var(--layout-right-context-top)",
            bottom: "var(--layout-right-context-bottom)",
            width: "var(--layout-right-context-width)",
            maxHeight: "var(--layout-right-context-max-height)",
            zIndex: "var(--z-right-context)",
            pointerEvents: "auto"
        },
        mobile: {
            position: "fixed",
            right: "var(--layout-right-context-mobile-right)",
            top: "var(--layout-right-context-mobile-top)",
            bottom: "auto",
            width: "var(--layout-right-context-mobile-width)",
            maxHeight: "var(--layout-right-context-mobile-max-height)",
            zIndex: "var(--z-right-context)",
            pointerEvents: "auto"
        }
    },

    // 🏷️ 開発ブランチ / 製品バージョン表示バッジ（画面左下隅）
    buildIdentityBadge: {
        desktop: {
            position: "fixed",
            bottom: "16px",
            left: "18px",
            top: "auto",
            right: "auto",
            zIndex: 980,
            pointerEvents: "none"
        },
        mobile: {
            position: "fixed",
            bottom: "12px",
            left: "12px",
            top: "auto",
            right: "auto",
            zIndex: 980,
            pointerEvents: "none"
        }
    },

    // ⚙️ 設定モーダル: タブ内容量に依存しない固定外形
    settingsModal: {
        width: "min(680px, 92vw)",
        height: "min(680px, calc(100vh - 64px))"
    },

    // ✨ 3. モジュール化バフ表示コンテナ
    // 盤面の見た目上端は動かさず、最大展開分だけ論理上端を上方へ予約する。
    buffPanel: {
        position: "absolute",
        top: "calc(-1 * var(--layout-buff-panel-headroom))",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        height: "var(--layout-buff-panel-headroom)",
        marginBottom: "0px",
        width: "100%",
        maxWidth: "520px",
        zIndex: 800
    },

    // 🏷️ 4. 土地グリッド右下角直接吸着 領土占有バッジ (グリッド完全追従)
    mainBadge: {
        position: "absolute",
        bottom: "6px",
        right: "6px",
        zIndex: 25
    },

    // 📜 5. モジュール化ログコンテナ (左上隅)
    logPanel: {
        position: "absolute",
        top: "16px",
        left: "20px",
        zIndex: 950,
        whiteSpace: "nowrap"
    },

    advisorDock: {
        position: "fixed",
        right: "var(--layout-advisor-right)",
        bottom: "var(--layout-advisor-bottom)",
        zIndex: "var(--z-advisor)",
        pointerEvents: "none",
        "--advisor-report-expanded-left": "18px",
        "--advisor-report-expanded-top": "30%"
    },

    // 🎛️ 7. 画面右下隅 ターン終了 ＆ ギブアップ 操作エリア
    rightBottomControls: {
        position: "absolute",
        bottom: "0px",
        right: "0px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        alignItems: "flex-end",
        zIndex: 600
    },

    // 🌌 8. 背景ウォールペーパーアート (タイトルロゴ: メインエリア左上)
    gameWallpaperArt: {
        position: "absolute",
        top: "calc(var(--layout-header-height, 120px) + var(--layout-app-gap, 4px) + 4px)",
        left: "18px",
        right: "auto",
        width: "clamp(260px, 24vw, 420px)",
        maxWidth: "30vw",
        transform: "none",
        opacity: "0.94",
        zIndex: 20,
        pointerEvents: "none"
    },

    // 🌌 9. Verse表示: ヘッダー右隅のコンパクトHUD
    bgTurnWatermark: {
        position: "relative",
        top: "auto",
        right: "auto",
        marginTop: "0px",
        marginLeft: "auto",
        marginRight: "0px",
        opacity: "1.0",
        zIndex: 2,
        pointerEvents: "none"
    }
};

/**
 * 🎨 地形IDに応じたブロック形状（Tetrisブロック）のテーマカラー定義 (Single Source of Truth)
 * @param {string} terrainId 
 * @returns {{ bg: string, border: string, shadow: string }}
 */
UILayoutConfig.getBlockThemeColor = function(terrainId) {
    const tid = String(terrainId || "");
    // 🐸 湿原: 濃い青緑 (Deep Teal)
    if (tid.includes("WETLAND")) {
        return { bg: "#0f766e", border: "#14b8a6", shadow: "rgba(20, 184, 166, 0.85)" };
    }
    // 🌲 深い森 / 森林丘陵: 深緑・ティール
    if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) {
        return { bg: "#16a085", border: "#117a65", shadow: "rgba(22, 160, 133, 0.85)" };
    }
    // 🌲 森: エメラルドグリーン
    if (tid.includes("FOREST")) {
        return { bg: "#2ecc71", border: "#27ae60", shadow: "rgba(46, 204, 113, 0.85)" };
    }
    // ⛰️ 丘陵: アースオレンジ
    if (tid.includes("HILL")) {
        return { bg: "#e67e22", border: "#d35400", shadow: "rgba(230, 126, 34, 0.85)" };
    }
    // 🏔️ 山岳: パープル
    if (tid.includes("MOUNTAIN")) {
        return { bg: "#9b59b6", border: "#8e44ad", shadow: "rgba(155, 89, 182, 0.85)" };
    }
    // 🏜️ 砂漠: サンドゴールド
    if (tid.includes("DESERT")) {
        return { bg: "#f7d794", border: "#f1c40f", shadow: "rgba(247, 215, 148, 0.85)" };
    }
    // 🌾 草原: フレッシュグリーン
    return { bg: "#1abc9c", border: "#16a085", shadow: "rgba(26, 188, 156, 0.85)" };
};

/**
 * DOM要素にレイアウト設定を一括適用するヘルパー関数
 */
UILayoutConfig.applyLayout = function() {
    if (typeof document === "undefined") return;
    const buffContainer = document.getElementById("buffComponentContainer");
    if (buffContainer) {
        Object.assign(buffContainer.style, this.buffPanel);
    }

    const logContainer = document.getElementById("logComponentContainer");
    if (logContainer) {
        Object.assign(logContainer.style, this.logPanel);
    }

    const advisorContainer = document.getElementById("advisorDockContainer");
    if (advisorContainer) {
        Object.assign(advisorContainer.style, this.advisorDock);
    }

    const badgeContainer = document.getElementById("territoryBadgeContainer");
    if (badgeContainer) {
        Object.assign(badgeContainer.style, this.mainBadge);
    }

    const bgTurn = document.getElementById("bgTurnWatermark");
    if (bgTurn) {
        Object.assign(bgTurn.style, this.bgTurnWatermark);
    }

    const wallpaper = document.getElementById("gameWallpaperArt");
    if (wallpaper && this.gameWallpaperArt) {
        Object.assign(wallpaper.style, this.gameWallpaperArt);
    }

    const buildBadge = document.getElementById("buildIdentityBadge");
    if (buildBadge && this.buildIdentityBadge) {
        const isMobile = typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia("(max-width: 768px)").matches
            : Boolean(typeof window !== "undefined" && window.innerWidth <= 768);
        const config = isMobile ? this.buildIdentityBadge.mobile : this.buildIdentityBadge.desktop;
        Object.assign(buildBadge.style, config);
    }

    const diceRoot = document.getElementById("diceWidgetRoot");
    if (diceRoot && this.diceWidget) {
        const isMobile = typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia("(max-width: 768px)").matches
            : Boolean(typeof window !== "undefined" && window.innerWidth <= 768);
        const config = isMobile ? this.diceWidget.mobile : this.diceWidget.desktop;
        Object.assign(diceRoot.style, {
            position: config.position,
            right: config.right,
            bottom: config.bottom,
            width: config.width,
            zIndex: String(config.zIndex),
            pointerEvents: config.pointerEvents
        });
    }

    const rightControls = document.querySelector(".right-bottom-controls");
    if (rightControls) {
        Object.assign(rightControls.style, this.rightBottomControls);
    }
};

if (typeof window !== "undefined") {
    window.UILayoutConfig = UILayoutConfig;
    window.UI_FEATURE_FLAGS = UI_FEATURE_FLAGS;
    window.UI_TILE_TEXT_PRESETS = UI_TILE_TEXT_PRESETS;
}
if (typeof globalThis !== "undefined") {
    globalThis.UILayoutConfig = UILayoutConfig;
    globalThis.UI_FEATURE_FLAGS = UI_FEATURE_FLAGS;
    globalThis.UI_TILE_TEXT_PRESETS = UI_TILE_TEXT_PRESETS;
}

export { UI_FEATURE_FLAGS, UI_TILE_TEXT_PRESETS, UILayoutConfig };
export default UILayoutConfig;