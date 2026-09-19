import { POST_TRIAL_INTERLUDE_SCENES } from "../trial/presentation/post_trial_interlude_scene_contract.js";
import { createPostTrialAdvisorSemanticPayload } from "../trial/presentation/post_trial_advisor_semantic_provider.js";

const STYLE_ID = "post-trial-interlude-styles";

function createElement(documentRef, tag, className, text = "") {
    const element = documentRef.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export class PostTrialInterludeComponent {
    constructor({
        progressService,
        readService,
        presentationBridge = null,
        stateProvider = () => ({}),
        advisorEnabledProvider = () => false,
        translate = (key, _params, fallback) => fallback || key,
        onRefresh = null,
        documentRef = typeof document !== "undefined" ? document : null
    } = {}) {
        if (!progressService) throw new TypeError("POST_TRIAL_INTERLUDE_PROGRESS_SERVICE_REQUIRED");
        if (!readService?.read) throw new TypeError("POST_TRIAL_INTERLUDE_READ_SERVICE_REQUIRED");
        this.progressService = progressService;
        this.readService = readService;
        this.presentationBridge = presentationBridge;
        this.stateProvider = stateProvider;
        this.advisorEnabledProvider = advisorEnabledProvider;
        this.translate = translate;
        this.onRefresh = onRefresh;
        this.documentRef = documentRef;
        this.root = null;
        this.lastAdvisorPresentationKey = null;
    }

    mount() {
        if (!this.documentRef || this.root) return this.root;
        this.ensureStyles();

        this.root = createElement(this.documentRef, "section", "post-trial-interlude-layer");
        this.root.hidden = true;
        this.root.setAttribute("aria-live", "polite");

        const panel = createElement(this.documentRef, "div", "post-trial-interlude-panel");
        const eyebrow = createElement(this.documentRef, "div", "post-trial-interlude-eyebrow");
        const title = createElement(this.documentRef, "h2", "post-trial-interlude-title");
        const body = createElement(this.documentRef, "div", "post-trial-interlude-body");
        const facts = createElement(this.documentRef, "div", "post-trial-interlude-facts");
        const status = createElement(this.documentRef, "div", "post-trial-interlude-status");
        const actions = createElement(this.documentRef, "div", "post-trial-interlude-actions");
        const advance = createElement(this.documentRef, "button", "post-trial-interlude-advance");
        advance.type = "button";
        advance.onclick = () => this.advance();

        body.appendChild(facts);
        body.appendChild(status);
        actions.appendChild(advance);
        panel.appendChild(eyebrow);
        panel.appendChild(title);
        panel.appendChild(body);
        panel.appendChild(actions);
        this.root.appendChild(panel);
        this.documentRef.body.appendChild(this.root);
        return this.root;
    }

    ensureStyles() {
        if (!this.documentRef || this.documentRef.getElementById(STYLE_ID)) return;
        const style = this.documentRef.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            body[data-post-trial-interlude="active"] #layerWorldBoard,
            body[data-post-trial-interlude="active"] #layerPlayerTray {
                pointer-events: none;
            }
            .post-trial-interlude-layer {
                position: fixed;
                inset: 0;
                z-index: 850;
                pointer-events: none;
            }
            .post-trial-interlude-panel {
                position: absolute;
                left: 50%;
                bottom: clamp(28px, 5vh, 64px);
                transform: translateX(-50%);
                width: min(680px, calc(100vw - 48px));
                padding: 18px 22px 16px;
                border: 1px solid rgba(206, 184, 128, 0.42);
                background: rgba(12, 15, 20, 0.94);
                box-shadow: 0 20px 54px rgba(0, 0, 0, 0.72);
                border-radius: 10px;
                pointer-events: auto;
            }
            .post-trial-interlude-layer[data-scene="STAGE_REVEAL"] .post-trial-interlude-panel {
                width: min(420px, calc(100vw - 48px));
                bottom: 30px;
                background: rgba(12, 15, 20, 0.82);
            }
            .post-trial-interlude-eyebrow {
                color: #a9a087;
                font-size: 11px;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                margin-bottom: 5px;
            }
            .post-trial-interlude-title {
                margin: 0;
                color: #f1ead7;
                font-size: 22px;
                font-weight: 650;
                letter-spacing: 0.03em;
            }
            .post-trial-interlude-body {
                margin-top: 12px;
                color: #c9c3b3;
                font-size: 14px;
                line-height: 1.6;
            }
            .post-trial-interlude-facts {
                display: grid;
                gap: 4px;
            }
            .post-trial-interlude-fact {
                display: flex;
                justify-content: space-between;
                gap: 18px;
                padding: 3px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .post-trial-interlude-fact strong {
                color: #f0dfb4;
                font-weight: 650;
            }
            .post-trial-interlude-status {
                min-height: 20px;
                margin-top: 8px;
                color: #8f9aa7;
                font-size: 12px;
            }
            .post-trial-interlude-actions {
                display: flex;
                justify-content: flex-end;
                margin-top: 14px;
            }
            .post-trial-interlude-advance {
                min-width: 132px;
                padding: 9px 16px;
                border: 1px solid rgba(206, 184, 128, 0.48);
                border-radius: 6px;
                background: rgba(206, 184, 128, 0.12);
                color: #f1ead7;
                font: inherit;
                cursor: pointer;
            }
            .post-trial-interlude-advance:disabled {
                opacity: 0.45;
                cursor: default;
            }
        `;
        this.documentRef.head.appendChild(style);
    }

    open() {
        this.mount();
        if (!this.root) return false;
        this.root.hidden = false;
        if (this.documentRef?.body?.dataset) {
            this.documentRef.body.dataset.postTrialInterlude = "active";
        }
        this.render();
        return true;
    }

    close() {
        if (this.root) this.root.hidden = true;
        if (this.documentRef?.body?.dataset) {
            delete this.documentRef.body.dataset.postTrialInterlude;
        }
        this.lastAdvisorPresentationKey = null;
    }

    isOpen() {
        return Boolean(this.root && !this.root.hidden);
    }

    render() {
        if (!this.root) return;
        const presentation = this.progressService.getPresentation();
        const scene = this.progressService.getCurrentScene();
        if (!presentation || presentation.status === "COMPLETED" || !scene) {
            this.close();
            return;
        }

        const readModel = this.readService.read();
        this.root.dataset.scene = scene.id;
        this.root.querySelector(".post-trial-interlude-eyebrow").textContent =
            this.sceneEyebrow(scene, readModel);
        this.root.querySelector(".post-trial-interlude-title").textContent =
            this.sceneTitle(scene, readModel);

        const factsHost = this.root.querySelector(".post-trial-interlude-facts");
        factsHost.replaceChildren();
        this.sceneFacts(scene, readModel).forEach(([label, value]) => {
            const row = createElement(this.documentRef, "div", "post-trial-interlude-fact");
            row.appendChild(createElement(this.documentRef, "span", "", label));
            row.appendChild(createElement(this.documentRef, "strong", "", value));
            factsHost.appendChild(row);
        });

        const blocked = this.isAdvanceBlocked(scene, readModel);
        const status = this.root.querySelector(".post-trial-interlude-status");
        status.textContent = blocked
            ? this.t("UI_POST_TRIAL_WAITING_FOR_STEP", {}, "処理の完了を待っています。")
            : this.sceneStatus(scene, readModel);

        const advance = this.root.querySelector(".post-trial-interlude-advance");
        advance.disabled = blocked;
        advance.textContent = scene.id === POST_TRIAL_INTERLUDE_SCENES.CLOSE
            ? this.t("UI_POST_TRIAL_CLOSE", {}, "盤面へ戻る")
            : this.t("UI_POST_TRIAL_CONTINUE", {}, "続ける");

        this.presentAdvisorScene(scene, readModel);
    }

    presentAdvisorScene(scene, readModel) {
        if (![
            POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
            POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
            POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE,
            POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT
        ].includes(scene.id)) return;

        const presentation = this.progressService.getPresentation();
        const key = `${presentation?.transitionId || ""}:${presentation?.currentSceneIndex}:${scene.id}`;
        if (key === this.lastAdvisorPresentationKey) return;
        this.lastAdvisorPresentationKey = key;

        const state = this.stateProvider?.() || {};
        const payload = createPostTrialAdvisorSemanticPayload({
            sceneId: scene.id,
            readModel,
            knownEnemyState: scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING
                ? state.knownEnemyState || null
                : null,
            postStagePublicState: scene.id === POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT
                ? {
                    stage: state.stage || null,
                    boardSize: Array.isArray(state.grid) ? state.grid.length : null
                }
                : null
        });

        this.presentationBridge?.presentAdvisorScene?.({
            sceneId: scene.id,
            payload
        });
    }

    isAdvanceBlocked(scene, readModel) {
        const pending = new Set(readModel?.pendingStepTypes || []);
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.REWARD) {
            return pending.has("REWARD_SELECTION");
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.UNLOCK) {
            return pending.has("UNLOCK_APPLY");
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.SKILL) {
            return pending.has("SKILL_PROGRESSION");
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.FINAL_RUN_COMPLETION) {
            return pending.has("FINAL_RUN_COMPLETION");
        }
        return false;
    }

    advance() {
        const scene = this.progressService.getCurrentScene();
        if (!scene) return;
        const readModel = this.readService.read();
        if (this.isAdvanceBlocked(scene, readModel)) {
            this.render();
            return;
        }

        const result = this.progressService.completeCurrentScene({
            expectedSceneId: scene.id
        });
        if (!result?.success) {
            const status = this.root?.querySelector(".post-trial-interlude-status");
            if (status) status.textContent = result?.reason || "POST_TRIAL_INTERLUDE_ADVANCE_FAILED";
            return;
        }

        this.lastAdvisorPresentationKey = null;
        if (typeof this.onRefresh === "function") {
            this.onRefresh();
        } else {
            this.render();
        }
    }

    sceneEyebrow(scene, readModel) {
        const index = safeNumber(readModel?.trialIndex);
        return index
            ? this.t("UI_POST_TRIAL_EYEBROW", { index }, `TRIAL ${index} — AFTERMATH`)
            : "AFTERMATH";
    }

    sceneTitle(scene, readModel) {
        const titles = {
            [POST_TRIAL_INTERLUDE_SCENES.AFTERMATH]: "試練の終わり",
            [POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT]: "戦後報告",
            [POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING]: "この試練が残したもの",
            [POST_TRIAL_INTERLUDE_SCENES.REWARD]: "戦果",
            [POST_TRIAL_INTERLUDE_SCENES.UNLOCK]: "新たな可能性",
            [POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE]: "活動圏の拡張",
            [POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL]: "世界が開かれる",
            [POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT]: "新たな地平",
            [POST_TRIAL_INTERLUDE_SCENES.SKILL]: "経験の継承",
            [POST_TRIAL_INTERLUDE_SCENES.FINAL_RUN_COMPLETION]: "三度の試練",
            [POST_TRIAL_INTERLUDE_SCENES.CLOSE]: "次の節へ"
        };
        return titles[scene.id] || scene.id;
    }

    sceneFacts(scene, readModel) {
        const result = readModel?.aftermath?.result || {};
        const stage = readModel?.stageAdvance?.payload || null;
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.AFTERMATH) {
            return [[
                "結果",
                readModel?.aftermath?.outcome === "SURVIVED" ? "生存" : "敗北"
            ]];
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT) {
            const facts = [];
            if (safeNumber(result.emberRemaining) !== null) facts.push(["残火", String(result.emberRemaining)]);
            if (safeNumber(result.totalEmberDamage) !== null) facts.push(["残火損失", String(result.totalEmberDamage)]);
            if (safeNumber(result.battleCount) !== null) facts.push(["戦闘", String(result.battleCount)]);
            if (safeNumber(result.routeEndCount) !== null) facts.push(["本営到達", String(result.routeEndCount)]);
            return facts;
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE && stage) {
            return [
                ["現在", `Stage ${stage.fromStageId ?? "?"}`],
                ["次段階", `Stage ${stage.toStageId ?? "?"}`]
            ];
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL && stage) {
            return [
                ["Stage", String(stage.toStageId ?? "?")],
                ["盤面", stage.size ? `${stage.size}×${stage.size}` : "—"]
            ];
        }
        return [];
    }

    sceneStatus(scene) {
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING
            && !this.advisorEnabledProvider()) {
            return "戦闘記録が整理された。";
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE) {
            return "確定した進行に従い、活動圏を外縁へ広げる。";
        }
        if (scene.id === POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT) {
            return "新たな活動圏が開かれた。";
        }
        return "";
    }

    t(key, params, fallback) {
        const value = this.translate?.(key, params, fallback);
        return !value || value === key ? fallback : value;
    }

    destroy() {
        this.close();
        this.root?.remove();
        this.root = null;
    }
}

export default PostTrialInterludeComponent;
