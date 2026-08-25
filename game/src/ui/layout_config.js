/**
 * 📐 UILayoutConfig
 * ゲーム全UI要素の絶対レイアウト・位置座標・2層レイヤー構造・重ね順(z-index)を一括集中管理する設定ファイル
 */
const UI_FEATURE_FLAGS = {
    enableBottomFocusBlur: true,  // 🌟 2層レイヤー構造（手札ホバー時の盤面暗転ブラー）有効化
    enableReserveArea: false
};

const UILayoutConfig = {
    // 🏛️ 4大責務レイヤー構造 定義 (4 Major Responsibility Layers)
    layers: {
        // 1️⃣ [Layer 1: Header HUD] 最上部固定情報バー
        header: {
            position: "fixed",
            top: "0px",
            left: "0px",
            width: "100%",
            height: "56px",
            zIndex: 600,
            pointerEvents: "auto"
        },
        // 2️⃣ [Layer 2: World Board] 画面中央・主役盤面
        worldBoard: {
            position: "relative",
            width: "100%",
            height: "100%",
            zIndex: 10,
            pointerEvents: "auto",
            transition: "filter 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s ease, box-shadow 0.22s ease"
        },
        // 3️⃣ [Layer 3: Player Action Tray] 画面下部・浮遊操作トレイ
        playerTray: {
            position: "absolute",
            bottom: "16px",
            left: "20px",
            right: "20px",
            zIndex: 500,
            pointerEvents: "none",
            defaultOpacity: 0.92,
            activeOpacity: 1.0,
            selectedDimOpacity: 0.35
        },
        // 4️⃣ [Layer 4: System Overlay] 四隅・最前面ポップアップ
        systemOverlay: {
            position: "fixed",
            top: "0px",
            left: "0px",
            width: "100%",
            height: "100%",
            zIndex: 900,
            pointerEvents: "none"
        },
        dimBlurStyle: {
            brightness: "0.60",
            blur: "2.5px"
        }
    },

    // 🎯 1. 中央土地盤面エリア (画面の真中央へ100%完全自動固定)
    boardContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width: "100%",
        height: "100%",
        padding: "0px",
        margin: "0 auto",
        overflow: "visible",
        zIndex: 10
    },

    // 🧩 2. 盤面グリッドラッパー (中央揃えの不動軸)
    boardWrapper: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginTop: "auto",
        marginBottom: "auto"
    },

    // ✨ 3. モジュール化バフ表示コンテナ (盤面直上の安定配置)
    buffPanel: {
        position: "relative",
        marginBottom: "10px",
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

    // 🃏 6. 画面左下隅: ドローカード選択エリア (Layer 3: プレイヤートレイ)
    offeringCardArea: {
        position: "absolute",
        bottom: "16px",
        left: "20px",
        zIndex: 500,
        pointerEvents: "auto"
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

    // 🌌 8. 背景ウォールペーパーアート (300% 拡大 ＆ 試練アナウンス下部完全クリアランス)
    gameWallpaperArt: {
        position: "absolute",
        top: "200px",
        right: "-20px",
        left: "auto",
        transform: "none",
        width: "1100px",
        maxWidth: "68vw",
        zIndex: 0,
        pointerEvents: "none",
        opacity: "0.88"
    },

    // 🌌 9. メインエリア背景 ウォーターマーク ターン表示 (AAA級スタイリッシュ演出)
    bgTurnWatermark: {
        position: "absolute",
        top: "20px",
        right: "28px",
        opacity: "1.0",
        zIndex: 2,
        pointerEvents: "none"
    }
};

/**
 * DOM要素にレイアウト設定を一括適用し、フォーカスイベントを初期化するヘルパー関数
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

    const offeringSec = document.querySelector(".offering-section");
    if (offeringSec) {
        Object.assign(offeringSec.style, this.offeringCardArea);
    }

    const rightControls = document.querySelector(".right-bottom-controls");
    if (rightControls) {
        Object.assign(rightControls.style, this.rightBottomControls);
    }

    const boardContainer = document.querySelector(".board-container");
    if (boardContainer) {
        Object.assign(boardContainer.style, this.boardContainer);
    }

    const boardWrapper = document.querySelector(".board-container-wrapper") || document.querySelector(".grid-board-wrapper");
    if (boardWrapper) {
        Object.assign(boardWrapper.style, this.boardWrapper);
    }

    if (!offeringSec || !boardContainer) return;

    offeringSec.addEventListener("mouseenter", () => {
        if (UI_FEATURE_FLAGS && UI_FEATURE_FLAGS.enableBottomFocusBlur) {
            boardContainer.classList.add("board-blur-focus");
            offeringSec.classList.add("card-container-active-focus");
        }
    });

    offeringSec.addEventListener("mouseleave", () => {
        boardContainer.classList.remove("board-blur-focus");
        offeringSec.classList.remove("card-container-active-focus");
    });
};

if (typeof window !== "undefined") {
    window.UILayoutConfig = UILayoutConfig;
    window.UI_FEATURE_FLAGS = UI_FEATURE_FLAGS;
}
if (typeof globalThis !== "undefined") {
    globalThis.UILayoutConfig = UILayoutConfig;
    globalThis.UI_FEATURE_FLAGS = UI_FEATURE_FLAGS;
}

export { UI_FEATURE_FLAGS, UILayoutConfig };
export default UILayoutConfig;

