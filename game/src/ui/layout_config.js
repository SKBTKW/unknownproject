/**
 * 📐 UILayoutConfig
 * ゲーム全UI要素の絶対レイアウト・位置座標・重ね順(z-index)を一括集中管理する単一の設定ファイル
 */
(function(exports) {
    // 🛡️ 1秒で元の仕様に復帰できる安全策スイッチ (Feature Flag)
    exports.UI_FEATURE_FLAGS = {
        enableBottomFocusBlur: true // false にすると即座に元の仕様(ボカシなし)に復帰します
    };

    const UILayoutConfig = {
        // 🎯 1. 中央土地盤面エリア
        boardContainer: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justify-content: "center",
            position: "relative",
            width: "100%",
            height: "100%",
            padding: "0px",
            margin: "0px",
            overflow: "visible"
        },

        // 🧩 2. 盤面グリッドラッパー
        boardWrapper: {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
            marginBottom: "auto"
        },

        // ✨ 3. モジュール化バフ表示コンテナ
        buffPanel: {
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "520px",
            zIndex: 800
        },

        // 🏷️ 4. メインエリア設置数バッジ
        mainBadge: {
            position: "absolute",
            top: "16px",
            right: "20px",
            zIndex: 10
        },

        // 📜 5. モジュール化ログコンテナ
        logPanel: {
            position: "absolute",
            top: "16px",
            left: "20px",
            zIndex: 850,
            whiteSpace: "nowrap"
        }
    };

    /**
     * DOM要素にレイアウト設定を一括適用し、フォーカスイベントを初期化するヘルパー関数
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

        // 🎯 下部カードエリアのマウスオーバー時「盤面微細ボカシフォーカス」イベント設定
        this.initBottomFocusEvents();
    };

    /**
     * 下部カードエリアのマウス進入・離脱に応じた盤面フォーカス制御
     */
    UILayoutConfig.initBottomFocusEvents = function() {
        const bottomCardContainer = document.querySelector(".bottom-card-container");
        const boardContainer = document.querySelector(".board-container");

        if (!bottomCardContainer || !boardContainer) return;

        // 重複登録防止
        if (bottomCardContainer._hasFocusEvents) return;
        bottomCardContainer._hasFocusEvents = true;

        bottomCardContainer.addEventListener("mouseenter", () => {
            if (exports.UI_FEATURE_FLAGS && exports.UI_FEATURE_FLAGS.enableBottomFocusBlur) {
                boardContainer.classList.add("board-blur-focus");
                bottomCardContainer.classList.add("card-container-active-focus");
            }
        });

        bottomCardContainer.addEventListener("mouseleave", () => {
            boardContainer.classList.remove("board-blur-focus");
            bottomCardContainer.classList.remove("card-container-active-focus");
        });
    };

    exports.UILayoutConfig = UILayoutConfig;
})(window);
