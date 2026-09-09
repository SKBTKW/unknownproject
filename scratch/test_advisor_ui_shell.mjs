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

dock.expand(ADVISOR_EXPANDED_REASONS.HOVER);
dock.handlePortraitClick();
check(dock.expandedReason === ADVISOR_EXPANDED_REASONS.CLICK, "hover展開中の顔clickで固定展開へ昇格する");
dock.scheduleHoverCollapse();
check(dock.hoverCloseTimer === null, "click固定展開はmouse leaveで格納しない");
dock.collapse();
check(dock.viewState === ADVISOR_VIEW_STATES.COLLAPSED, "明示的な格納操作でcollapsedへ戻る");

dock.handleAction(ADVISOR_SECTIONS.REPORT);
check(dock.activeSection === ADVISOR_SECTIONS.REPORT, "格納中の報告操作を共通sectionへ渡す");
dock.handleAction("settings");
check(settingsOpenCount === 1, "設定は既存SettingsModalの正規入口を使う");
check(ADVISOR_REPORT_DEPTHS.join(",") === "shallow,medium,deep", "報告の浅・中・深を一元定義する");

const dockSource = fs.readFileSync(path.join(ROOT, "game/src/ui/advisor/advisor_dock_component.js"), "utf8");
const contentSource = fs.readFileSync(path.join(ROOT, "game/src/ui/advisor/advisor_content_controller.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "game/css/4_right_sidebar/advisor_ui.css"), "utf8");
check(!dockSource.includes("advisor-turn"), "Advisorへ既存TURN表示を統合しない");
check(contentSource.includes("render(host, section)"), "SidePanelとModalが同じContent Controllerを使う");
check(css.includes(".advisor-dock.is-collapsed") && css.includes(".advisor-dock.is-expanded"), "格納・展開を排他的CSS stateで表現する");
check(css.includes("grid-template-columns: repeat(4, 1fr)") && css.includes("grid-template-columns: 1fr"), "Navigationを格納時は横、展開時は縦にする");
check(!css.includes("!important"), "Advisor CSSへ新規!importantを追加しない");
check(css.includes("pointer-events: none") && css.includes("pointer-events: auto"), "透明領域は盤面入力を奪わず操作部だけを有効にする");

console.log(`Advisor UI shell: ${passed}/${passed} PASS`);
