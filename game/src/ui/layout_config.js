/**
 * 📐 UILayoutConfig
 * ゲーム全UI要素の絶対レイアウト・位置座標・重ね順(z-index)を一括集中管理する設定ファイル
 */
(function(exports) {
    // 🛡️ 1秒で復帰できる安全策スイッチ (Feature Flag)
    exports.UI_FEATURE_FLAGS = {
        enableBottomFocusBlur: true, // 左下カードエリアフォーカスボカシ演出
        enableReserveArea: false     // 保留エリアの表示スイッチ (退避中)
    };

    const UILayoutConfig = {
        // 🎯 1. 中央土地盤面エリア (画面の真中央へ100%完全自動固定)
        boardContainer: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justify-content: "center",
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
            justify-content: "center",
            marginTop: "auto",
            marginBottom: "auto"
        },

        // ✨ 3. モジュール化バフ表示コンテナ (盤面直上の絶対配置)
        buffPanel: {
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "520px",
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
            zIndex: 850,
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

        const offeringSec = document.querySelector(".offering-section");
        if (offeringSec) {
            Object.assign(offeringSec.style, this.offeringCardArea);
        }

        const footerControls = document.querySelector(".footer-controls-partition");
        if (footerControls) {
            Object.assign(footerControls.style, this.rightBottomControls);
        }

        // 🎯 左下カードエリアのマウスオーバー時「盤面微細ボカシフォーカス」イベント設定
        this.initBottomFocusEvents();
    };

    /**
     * 左下カードエリアのマウス進入・離脱に応じた盤面フォーカス制御
     */
    UILayoutConfig.initBottomFocusEvents = function() {
        const offeringSec = document.querySelector(".offering-section");
        const boardContainer = document.querySelector(".board-container");

        if (!offeringSec || !boardContainer) return;

        // 重複登録防止
        if (offeringSec._hasFocusEvents) return;
        offeringSec._hasFocusEvents = true;

        offeringSec.addEventListener("mouseenter", () => {
            if (exports.UI_FEATURE_FLAGS && exports.UI_FEATURE_FLAGS.enableBottomFocusBlur) {
                boardContainer.classList.add("board-blur-focus");
                offeringSec.classList.add("card-container-active-focus");
            }
        });

        offeringSec.addEventListener("mouseleave", () => {
            boardContainer.classList.remove("board-blur-focus");
            offeringSec.classList.remove("card-container-active-focus");
        });
    };

    exports.UILayoutConfig = UILayoutConfig;
})(window);
