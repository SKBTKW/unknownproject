/**
 * 📐 UILayoutConfig
 * ゲーム全UI要素の絶対レイアウト・位置座標・重ね順(z-index)を一括集中管理する単一の設定ファイル (Single Source of Truth)
 */
(function(exports) {
    const UILayoutConfig = {
        // 🎯 1. 中央土地盤面エリア (絶対不動のメイン基準軸)
        boardContainer: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: "100%",
            height: "100%",
            padding: "0px",
            margin: "0px",
            overflow: "visible"
        },

        // 🧩 2. 盤面グリッドラッパー (可変盤面の親枠・完全レスポンシブ中央)
        boardWrapper: {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
            marginBottom: "auto"
        },

        // ✨ 3. モジュール化バフ表示コンテナ (盤面直上の絶対配置・干渉0%)
        buffPanel: {
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "520px",
            zIndex: 800
        },

        // 🏷️ 4. メインエリア設置数バッジ (盤面エリア右上隅)
        mainBadge: {
            position: "absolute",
            top: "16px",
            right: "20px",
            zIndex: 10
        },

        // 📜 5. モジュール化ログコンテナ (盤面エリア左上隅)
        logPanel: {
            position: "absolute",
            top: "16px",
            left: "20px",
            zIndex: 850
        }
    };

    /**
     * DOM要素にレイアウト設定を一括適用するヘルパー関数
     */
    UILayoutConfig.applyLayout = function() {
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

        const boardWrapper = document.querySelector(".board-container-wrapper");
        if (boardWrapper) {
            Object.assign(boardWrapper.style, this.boardWrapper);
        }

        const boardContainer = document.querySelector(".board-container");
        if (boardContainer) {
            Object.assign(boardContainer.style, this.boardContainer);
        }
    };

    exports.UILayoutConfig = UILayoutConfig;
})(window);
