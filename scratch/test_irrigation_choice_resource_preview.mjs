import assert from "node:assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { UIController } from "../game/src/ui/ui_controller.js";
import { ModalSystem } from "../game/src/ui/modal_system.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { I18n } from "../game/src/i18n.js";

const card = COMMAND_CARDS_MASTER.find(c => c.id === "CMD_WETLAND_RECLAMATION");
assert.ok(card);
globalThis.I18n = I18n;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalShow = ModalSystem.showChoiceDialog;
const originalInit = ModalSystem.init;
const originalLanguage = I18n.getLanguage();
try {
    let request;
    globalThis.window = { ModalSystem };
    ModalSystem.showChoiceDialog = options => { request = options; };
    const engine = GameEngine.createGame({ firstRun: true, runSeed: 20261003 });
    const ui = Object.assign(Object.create(UIController.prototype), { engine, state: engine.state });
    let selection;
    ui.beginTargetedCommandSelection = (...args) => { selection = args; };
    for (const language of ["ja", "en"]) {
        I18n.setLanguage(language);
        for (const stock of [0, 30, 80, 110]) {
            engine.state.wood = stock;
            engine.state.material = stock;
            const before = [engine.state.food, engine.state.wood, engine.state.mystic, engine.state.ember];
            ui.triggerCommandCardPlay(card, 2, -1);
            assert.equal(request.currentText, I18n.t("UI_CARD_CURRENT_RESOURCES", { resources: `🧱${stock}` }));
            assert.deepEqual(request.choices.map(c => c.disabled), [30, 70, 110].map(cost => stock < cost));
            for (const [index, cost] of [30, 70, 110].entries()) {
                const choice = request.choices[index];
                assert.equal(choice.costText, I18n.t("UI_CARD_COST_PREFIX", { cost: `🧱${cost}` }));
                assert.equal(choice.afterText, stock >= cost
                    ? I18n.t("UI_CARD_AFTER_PAYMENT", { resources: `🧱${stock - cost}` })
                    : I18n.t("UI_CARD_PAYMENT_UNAVAILABLE"));
            }
            assert.deepEqual([engine.state.food, engine.state.wood, engine.state.mystic, engine.state.ember], before,
                "opening and forecasting the production choice must not spend resources");
        }
    }
    request.onSelect(request.choices[1]);
    assert.equal(selection[0].selectedExecutionVariantId, "IRRIGATION_WORKS");
    assert.equal(selection[1], 2);
    assert.equal(engine.state.wood, 110, "choosing a plan still waits for its board target");

    // Exercise the real shared modal renderer with the production request.
    ModalSystem.showChoiceDialog = originalShow;
    ModalSystem.init = () => {};
    const classes = new Set();
    const overlay = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } };
    const buttons = request.choices.map((_, index) => ({ dataset: { choiceIndex: String(index) } }));
    const content = { innerHTML: "", querySelectorAll: () => buttons };
    const cancel = {};
    globalThis.document = { getElementById: id => ({ modalSystemOverlay: overlay, modalSystemContent: content, modalSysBtnCancel: cancel })[id] };
    let selected;
    ModalSystem.showChoiceDialog({ ...request, onSelect: c => { selected = c; } });
    const html = content.innerHTML;
    assert.ok(html.indexOf(request.currentText) < html.indexOf(request.choices[0].costText));
    assert.ok(html.indexOf(request.choices[0].costText) < html.indexOf(request.choices[0].afterText));
    assert.ok(html.includes("After payment: 🧱0"), "zero post-payment resources remain visible");
    assert.ok(classes.has("active"));
    buttons[1].onclick();
    assert.equal(selected.id, "IRRIGATION_WORKS");
    assert.ok(!classes.has("active"));
    console.log("PASS: irrigation current resources, per-plan cost/forecast, zero/shortfall, JP/EN, pure preview and target handoff");
} finally {
    ModalSystem.showChoiceDialog = originalShow;
    ModalSystem.init = originalInit;
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    I18n.setLanguage(originalLanguage);
}
