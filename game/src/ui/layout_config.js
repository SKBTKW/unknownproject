/**
 * 📐 UILayoutConfig
 * ゲーム全UI要素の絶対レイアウト・位置座標・重ね順(z-index)を一括集中管理する設定ファイル
 */
const UI_FEATURE_FLAGS = {
    enableBottomFocusBlur: false, // ❌ 親要素全体のボケを完全無効化
    enableReserveArea: false
};

const UILayoutConfig = {
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
        overflow: "visible"
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

    // 🏷️ 4. メインエリア設置数バッジ (右上隅)
    mainBadge: {
        position: "absolute",
        top: "16px",
        right: "20px",
        zIndex: 10
    },

    // 📜 5. モジュール化ログコンテナ (左上隅)
    logPanel: {
        position: "absolute",
        top: "16px",
        left: "20px",
        zIndex: 950,
        whiteSpace: "nowrap"
    },

    // 🃏 6. 画面左下隅: ドローカード選択エリア
    offeringCardArea: {
        position: "absolute",
        bottom: "16px",
        left: "20px",
        zIndex: 100
    },

    // 🎮 7. 画面右下隅: 統合操作グループ (ターン表示・マリガン・TURN END)
    rightBottomControls: {
        position: "absolute",
        bottom: "16px",
        right: "20px",
        width: "260px",
        zIndex: 100
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

    const mainBadge = document.querySelector(".main-area-badge");
    if (mainBadge) {
        Object.assign(mainBadge.style, this.mainBadge);
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

