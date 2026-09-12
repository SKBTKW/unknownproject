import { TrialActionTrayComponent } from "./trial_action_tray_component.js";

const RERENDER_AFTER_METHODS = Object.freeze([
    "selectTrialInterceptionCell",
    "selectTrialRoute",
    "setTrialDefenseAllocation"
]);

/**
 * Migration bridge for the Trial Action Tray.
 *
 * The tray intentionally lives in the Player Tray host while Trial domain/state
 * remains owned by UIController / TrialController. Until the legacy right-side
 * Trial console is decomposed, this bridge keeps the new presentation in sync
 * without moving or duplicating domain logic.
 */
export function attachTrialActionTray(uiController) {
    if (!uiController || typeof document === "undefined") return null;
    if (uiController.trialActionTrayComponent) return uiController.trialActionTrayComponent;

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

    component.render();
    return component;
}

export default attachTrialActionTray;
