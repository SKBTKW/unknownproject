import { TrialActionTrayComponent } from "./trial_action_tray_component.js";
import { attachTrialRouteBoardSelection } from "./trial_route_board_selection_bridge.js";

const RERENDER_AFTER_METHODS = Object.freeze([
    "selectTrialInterceptionCell",
    "selectTrialRoute",
    "setTrialDefenseAllocation"
]);

/**
 * Bootstrap compatibility bridge for the Trial Action Tray.
 *
 * UIController now owns the canonical Player Tray presentation. The wrapper path
 * remains for older controller fixtures, while route-board input is attached in
 * both cases. No Trial domain/state ownership moves into this bridge.
 */
export function attachTrialActionTray(uiController) {
    if (!uiController || typeof document === "undefined") return null;
    if (uiController.trialActionTrayComponent) {
        attachTrialRouteBoardSelection(uiController);
        uiController.trialActionTrayComponent.render?.();
        return uiController.trialActionTrayComponent;
    }

    const component = new TrialActionTrayComponent(uiController);
    uiController.trialActionTrayComponent = component;

    if (typeof uiController.render === "function") {
        const baseRender = uiController.render.bind(uiController);
        uiController.render = (...args) => {
            const result = baseRender(...args);
            component.render();
            return result;
        };
    }

    RERENDER_AFTER_METHODS.forEach(methodName => {
        const method = uiController[methodName];
        if (typeof method !== "function") return;
        const baseMethod = method.bind(uiController);
        uiController[methodName] = (...args) => {
            const result = baseMethod(...args);
            component.render();
            return result;
        };
    });

    attachTrialRouteBoardSelection(uiController);
    component.render();
    return component;
}

export default attachTrialActionTray;
