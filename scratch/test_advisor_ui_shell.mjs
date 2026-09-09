import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    AdvisorDockComponent,
    ADVISOR_VIEW_STATES,
    ADVISOR_EXPANDED_REASONS,
    ADVISOR_UI_TIMING
} from "../game/src/ui/advisor/advisor_dock_component.js";
import { ADVISOR_SECTIONS, ADVISOR_REPORT_DEPTHS } from "../game/src/ui/advisor/advisor_content_controller.js";
import { DEFAULT_ADVISOR_PROFILE } from "../game/src/ui/advisor/advisor_profiles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
function check(condition, message) {
    if (!condition) throw new Error(message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

console.log("\nAdvisor UI shell tests");
const settings = new Map([["advisorEnabled", true], ["advisorHoverExpand", false]]);
let settingsOpenCount = 0;
let nextTimerId = 0;
const timers = new Map();
const dock = new AdvisorDockComponent({
    stateProvider: () => ({ turn: 1 }),
    settingsModal: {
        settings: { get: key => settings.get(key) },
        open: () => { settingsOpenCount += 1; }
    },
    i18n: { t: key => key },
    setTimer: (callback, delay) => { const id = ++nextTimerId; timers.set(id, { callback, delay }); return id; },
    clearTimer: id => timers.delete(id)
});

check(dock.viewState === ADVISOR_VIEW_STATES.COLLAPSED, "初期状態は格納");
check(dock.expandedReason === null && dock.activeSection === null, "初期展開理由とsectionは空");
check(dock.contentController.reportDepth === "medium", "報告レベルの初期値は普通(medium)");
dock.scheduleHoverExpand();
check(timers.size === 0, "hover設定OFFでは展開timerを作らない");

settings.set("advisorHoverExpand", true);
dock.scheduleHoverExpand();
const openTimer = timers.get(dock.hoverOpenTimer);
check(openTimer?.delay === ADVISOR_UI_TIMING.HOVER_OPEN_MS, "hover展開遅延を定数管理する");
openTimer.callback();
check(dock.viewState === ADVISOR_VIEW_STATES.EXPANDED && dock.expandedReason === ADVISOR_EXPANDED_REASONS.HOVER, "hoverで一時展開する");
dock.scheduleHoverCollapse();
const closeTimer = timers.get(dock.hoverCloseTimer);
check(closeTimer?.delay === ADVISOR_UI_TIMING.HOVER_CLOSE_MS, "hover格納遅延を定数管理する");
dock.cancelHoverCollapse();
check(dock.hoverCloseTimer === null, "interactive region再進入で格納をキャンセルする");
dock.scheduleHoverCollapse();
timers.get(dock.hoverCloseTimer).callback();
check(dock.viewState === ADVISOR_VIEW_STATES.COLLAPSED, "hover leave後に格納する");

dock.expand(ADVISOR_EXPANDED_REASONS.CLICK);
dock.handlePortraitClick();
check(dock.viewState === ADVISOR_VIEW_STATES.COLLAPSED, "展開中の顔clickでも格納できる");

dock.handleAction(ADVISOR_SECTIONS.REPORT);
check(dock.activeSection === ADVISOR_SECTIONS.REPORT && dock.reportBubbleOpen === true, "報告buttonで吹き出しを開く");
dock.handleAction(ADVISOR_SECTIONS.REPORT);
check(dock.activeSection === null && dock.reportBubbleOpen === false, "報告button自体を吹き出しtoggleとして使う");
dock.handleAction("settings");
check(settingsOpenCount === 1, "設定は既存SettingsModalの正規入口を使う");
check(ADVISOR_REPORT_DEPTHS.join(",") === "shallow,medium,deep", "報告の浅・普通・深を一元定義する");

const dockSource = fs.readFileSync(path.join(ROOT, "game/src/ui/advisor/advisor_dock_component.js"), "utf8");
const profileSource = fs.readFileSync(path.join(ROOT, "game/src/ui/advisor/advisor_profiles.js"), "utf8");
const contentSource = fs.readFileSync(path.join(ROOT, "game/src/ui/advisor/advisor_content_controller.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "game/css/4_right_sidebar/advisor_ui.css"), "utf8");
const layoutCss = fs.readFileSync(path.join(ROOT, "game/css/0_global_common/base_layout.css"), "utf8");

check(DEFAULT_ADVISOR_PROFILE.portraitCollapsed.endsWith("/assets/advisor/advisor01_small.png"), "格納時portraitはadvisor01_small.pngを参照する");
check(DEFAULT_ADVISOR_PROFILE.portraitExpanded.endsWith("/assets/advisor/advisor01.png"), "展開時portraitはadvisor01.pngを参照する");
check(profileSource.includes("new URL") && !profileSource.includes("base64"), "Advisor画像はasset URL参照でbase64埋め込みしない");
check(dockSource.includes("portraitCollapsed") && dockSource.includes("portraitExpanded"), "view stateに応じてportrait srcを切り替える");
check(dockSource.match(/createElement\(\"nav\", \"advisor-navigation/g)?.length === 1, "Navigation DOMは1つだけ生成する");
check(dockSource.includes("advisor-nav--horizontal") && dockSource.includes("advisor-nav--vertical"), "同一Navigationへ横・縦layout classを付け替える");
check(dockSource.includes("advisor-report-bubble") && dockSource.includes("reportBubbleOpen"), "報告は専用吹き出しtoggleで表示する");
check(contentSource.includes('this.reportDepth = "medium"'), "報告のdefaultをmediumにする");
check(contentSource.includes("resolveAdvisorAdvice") && contentSource.includes('this.reportDepth === "deep"'), "深い報告では助言を追加する");
check(css.includes("position: fixed") && css.includes("height: 100vh") && css.includes("--advisor-edge-trigger-width"), "右端hover triggerを画面全高にする");
check(css.includes(".advisor-navigation.advisor-nav--vertical") && css.includes("position: absolute"), "展開Navigationをportrait枠内overlayにする");
check(css.includes(".advisor-navigation.advisor-nav--horizontal") && css.includes("grid-template-columns: repeat(4, 1fr)"), "格納時Navigationを横4列にする");
check(css.includes(".advisor-navigation.advisor-nav--vertical") && css.includes("flex-direction: column"), "展開時Navigationを縦列にする");
check(css.includes(".advisor-navigation.advisor-nav--horizontal .advisor-nav-label") && css.includes("clip-path: inset(50%)"), "格納時labelを視覚的に隠す");
check(css.includes("--advisor-collapsed-width") && css.includes("--advisor-expanded-width") && css.includes("--advisor-nav-width") && css.includes("--advisor-side-panel-width"), "主要AdvisorサイズをCSS変数化する");
check(css.includes("pointer-events: none") && css.includes("pointer-events: auto"), "透明wrapperは盤面入力を奪わず操作部だけを有効にする");
check(css.includes("object-fit: contain") && css.includes("object-position: center bottom") && css.includes("overflow: hidden"), "portrait viewportで画像サイズ差を吸収する");
check(layoutCss.includes("#layerPlayerTray.layer-player-tray") && layoutCss.includes("justify-content: flex-start"), "手札を左下へ寄せる");
check(layoutCss.includes("#advisorDockContainer") && layoutCss.includes("z-index: 420"), "Advisorを手札より下層にする");
check(layoutCss.includes("#devDiceControlsRoot") && layoutCss.includes("display: none"), "判定テストHUDを機能保持のまま非表示にする");
check(!css.includes("rotation") && !css.includes("rotate(") && !css.includes("bounce"), "開閉animationにrotation/bounceを使わない");
check(!css.includes("!important"), "Advisor CSSへ!importantを追加しない");

console.log(`Advisor UI shell: ${passed}/${passed} PASS`);
