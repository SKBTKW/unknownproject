/**
 * 🗺️ AreaInfluenceVisualService (範囲効果オーバーレイ専用 View サービス)
 * 
 * 責務:
 * 1. ゲームロジック側（Single Source of Truth）で判定された範囲効果フラグ
 *    (isLakeVic, isHQVic) を受け取り、表示用 CSS クラスおよびオーバーレイ SVG HTML を生成する。
 * 2. ゲームルール（周囲8マス判定等）の再計算・複製は 100% 禁止。
 * 3. 湖（セル内側ティール波紋）と本営近郊（外周四隅アンバーL字枠）の視覚分離。
 */

export class AreaInfluenceVisualService {
    /**
     * 🏷️ セルに付与する範囲効果クラス名の配列を取得
     * @param {Object} params
     * @param {boolean} params.isLakeVic - 水源（湖・オアシス）影響圏フラグ
     * @param {boolean} params.isHQVic - 本営近郊影響圏フラグ
     * @returns {string[]} クラス名配列
     */
    static getInfluenceClasses({ isLakeVic = false, isHQVic = false } = {}) {
        const classes = [];
        if (isLakeVic) classes.push("influence-lake");
        if (isHQVic) classes.push("influence-hq-vicinity");
        return classes;
    }

    /**
     * 🎨 範囲効果オーバーレイ DOM / SVG HTML を生成
     * @param {Object} params
     * @param {boolean} params.isLakeVic - 水源（湖・オアシス）影響圏フラグ
     * @param {boolean} params.isHQVic - 本営近郊影響圏フラグ
     * @returns {string} オーバーレイ用 HTML 文字列
     */
    static createInfluenceOverlayHtml({ isLakeVic = false, isHQVic = false } = {}) {
        if (!isLakeVic && !isHQVic) return "";

        let innerSvgParts = "";

        // 🌊 1. 湖水源バフ: セル内側の同心円水面波紋（中央部は透過し地形GL・文字を阻害しない）
        if (isLakeVic) {
            innerSvgParts += `
                <g class="influence-svg-lake">
                    <circle cx="50" cy="50" r="38" class="lake-ripple-outer" />
                    <circle cx="50" cy="50" r="24" class="lake-ripple-inner" />
                </g>
            `;
        }

        // 🏘️ 2. 本営近郊バフ: セル外周・四隅の薄い区画線 L字マーカー（内側は一切埋めない）
        if (isHQVic) {
            innerSvgParts += `
                <g class="influence-svg-hq">
                    <!-- Top-Left Corner -->
                    <path d="M 6 16 L 6 6 L 16 6" class="hq-corner-marker" />
                    <!-- Top-Right Corner -->
                    <path d="M 84 6 L 94 6 L 94 16" class="hq-corner-marker" />
                    <!-- Bottom-Left Corner -->
                    <path d="M 6 84 L 6 94 L 16 94" class="hq-corner-marker" />
                    <!-- Bottom-Right Corner -->
                    <path d="M 84 94 L 94 94 L 94 84" class="hq-corner-marker" />
                </g>
            `;
        }

        return `<div class="area-influence-overlay"><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="area-influence-svg">${innerSvgParts}</svg></div>`;
    }
}

if (typeof window !== "undefined") {
    window.AreaInfluenceVisualService = AreaInfluenceVisualService;
}
if (typeof globalThis !== "undefined") {
    globalThis.AreaInfluenceVisualService = AreaInfluenceVisualService;
}
