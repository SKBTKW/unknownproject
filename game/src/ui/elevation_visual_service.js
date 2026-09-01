/**
 * 🏔️ ElevationVisualService (土地高度オーバーレイ描画サービス - Phase 1)
 * 
 * 責務:
 * 1. 土地の高度 E (E0: 低地, E1: 平坦地, E2: 丘陵, E3: 山岳) に応じた視覚オーバーレイHTMLを生成する。
 * 2. ゲームロジックは一切持たず、純粋な View レイヤーとして機能する。
 * 3. セル全面の GL 表層ベース色の上に重ねる軽量な inline SVG / CSS を提供する。
 */

export class ElevationVisualService {
    /**
     * E高度に対応する CSS クラス名を取得
     * @param {number} e - 標高 (0, 1, 2, 3)
     * @returns {string} e-0, e-1, e-2, e-3
     */
    static getElevationClass(e) {
        const safeE = Number.isInteger(e) ? Math.max(0, Math.min(3, e)) : 1;
        return `e-${safeE}`;
    }

    /**
     * GL地勢に対応する CSS クラス名を取得 (E3山岳の場合は空文字)
     * @param {number} gl - 地勢 (0, 1, 2, 3)
     * @param {number} e - 標高
     * @returns {string} gl-0, gl-1, gl-2, gl-3 (E3山岳時は "")
     */
    static getGlClass(gl, e) {
        if (e === 3) return ""; // E3山岳はGLを持たない特例
        const safeGL = Number.isInteger(gl) ? Math.max(0, Math.min(3, gl)) : 1;
        return `gl-${safeGL}`;
    }

    /**
     * 🎨 高度オーバーレイの DOM 文字列を生成
     * @param {number} e - 標高 (0, 1, 2, 3)
     * @returns {string} <div class="elevation-overlay ...">...</div>
     */
    static createElevationOverlay(e) {
        const safeE = Number.isInteger(e) ? e : 1;

        if (safeE === 1) {
            // E1 平坦地: 高度オーバーレイなし (GLベースのみ)
            return "";
        }

        if (safeE === 0) {
            // E0 低地・湿原: 水平な水面線、微細な波紋、沈み込みの陰影
            return `<div class="elevation-overlay e-overlay-0">
                <svg class="e-svg e-svg-wetland" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <!-- 低地の沈み込み内側陰影 -->
                    <rect x="0" y="0" width="100" height="100" fill="url(#e0-vignette)" opacity="0.45" />
                    <!-- 水平水面線 & 微細な水たまり波紋 -->
                    <path d="M 10 38 Q 30 35, 50 38 T 90 38" stroke="rgba(20, 184, 166, 0.45)" stroke-width="1.5" fill="none" stroke-linecap="round" />
                    <path d="M 5 62 Q 25 59, 50 62 T 95 62" stroke="rgba(20, 184, 166, 0.55)" stroke-width="2" fill="none" stroke-linecap="round" />
                    <path d="M 20 80 Q 45 77, 75 80" stroke="rgba(20, 184, 166, 0.35)" stroke-width="1.5" fill="none" stroke-linecap="round" />
                    <!-- 水面の微かな光沢だまり -->
                    <ellipse cx="52" cy="66" rx="28" ry="4" fill="rgba(45, 212, 191, 0.18)" />
                    <ellipse cx="32" cy="42" rx="16" ry="2.5" fill="rgba(45, 212, 191, 0.14)" />
                    <defs>
                        <radialGradient id="e0-vignette" cx="50%" cy="50%" r="50%">
                            <stop offset="60%" stop-color="#000000" stop-opacity="0" />
                            <stop offset="100%" stop-color="#041f1e" stop-opacity="0.6" />
                        </radialGradient>
                    </defs>
                </svg>
            </div>`;
        }

        if (safeE === 2) {
            // E2 丘陵: 柔らかい曲線・なだらかな起伏・等高線風ライン (控えめな不透明度でGL色を活かす)
            return `<div class="elevation-overlay e-overlay-2">
                <svg class="e-svg e-svg-hill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <!-- なだらかな背後の主稜線 -->
                    <path d="M 0 68 Q 32 36, 68 52 T 100 60 L 100 100 L 0 100 Z" fill="rgba(255, 255, 255, 0.05)" />
                    <path d="M 0 68 Q 32 36, 68 52 T 100 60" stroke="rgba(255, 255, 255, 0.32)" stroke-width="2" fill="none" stroke-linecap="round" />
                    <!-- 手前の柔らかな小丘・等高線 -->
                    <path d="M 15 82 Q 55 58, 100 74 L 100 100 L 15 100 Z" fill="rgba(0, 0, 0, 0.12)" />
                    <path d="M 15 82 Q 55 58, 100 74" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1.8" fill="none" stroke-linecap="round" />
                    <!-- 緩斜面の等高線アクセント -->
                    <path d="M 0 88 Q 35 78, 70 90" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.2" fill="none" stroke-dasharray="2 3" />
                </svg>
            </div>`;
        }

        if (safeE === 3) {
            // E3 山岳: 鋭角・峰・尾根・岩稜・立体陰影 (線密度と鋭さでE2と明確に識別)
            return `<div class="elevation-overlay e-overlay-3">
                <svg class="e-svg e-svg-mountain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <!-- 鋭角な主峰 (左側・日陰面) -->
                    <polygon points="50,15 12,88 50,88" fill="rgba(15, 23, 42, 0.42)" />
                    <!-- 鋭角な主峰 (右側・照光面) -->
                    <polygon points="50,15 50,88 88,88" fill="rgba(255, 255, 255, 0.12)" />
                    <!-- 主峰の鋭い中央尾根ライン -->
                    <polyline points="50,15 48,45 52,65 50,88" stroke="rgba(255, 255, 255, 0.65)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                    <!-- 左側の急峻な稜線 (峰の輪郭) -->
                    <line x1="50" y1="15" x2="12" y2="88" stroke="rgba(255, 255, 255, 0.45)" stroke-width="2" stroke-linecap="round" />
                    <!-- 右側の急峻な稜線 (峰の輪郭) -->
                    <line x1="50" y1="15" x2="88" y2="88" stroke="rgba(255, 255, 255, 0.35)" stroke-width="2" stroke-linecap="round" />
                    <!-- 岩稜のシャープな斜面ひだ (鋭角リッジ) -->
                    <polyline points="48,45 28,68 18,88" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1.4" fill="none" />
                    <polyline points="52,65 72,82" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.4" fill="none" />
                    <!-- 山頂の冠雪・鋭峰ハイライト -->
                    <polygon points="50,15 43,30 50,27 57,30" fill="rgba(255, 255, 255, 0.75)" />
                </svg>
            </div>`;
        }

        return "";
    }
}

if (typeof window !== "undefined") {
    window.ElevationVisualService = ElevationVisualService;
}
if (typeof globalThis !== "undefined") {
    globalThis.ElevationVisualService = ElevationVisualService;
}
