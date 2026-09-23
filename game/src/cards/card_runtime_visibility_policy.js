/* =============================================================
   game/src/cards/card_runtime_visibility_policy.js

   Live Offering catalog visibility policy.
   Compatibility-only generated definitions may remain loadable/executable,
   but they must not silently re-enter the authored live Offering catalog.
   ============================================================= */

import { isLegacyOnlyCommandExecution } from './legacy_command_execution_inventory.js';

function evaluateCardRuntimeVisibility(cardDefinition) {
    if (!cardDefinition || typeof cardDefinition !== 'object') {
        return Object.freeze({ visible: false, reason: 'CARD_DEFINITION_REQUIRED' });
    }
    if (isLegacyOnlyCommandExecution(cardDefinition.id)) {
        return Object.freeze({ visible: false, reason: 'LEGACY_ONLY_CARD' });
    }
    return Object.freeze({ visible: true, reason: null });
}

function isCardRuntimeVisible(cardDefinition) {
    return evaluateCardRuntimeVisibility(cardDefinition).visible === true;
}

export {
    evaluateCardRuntimeVisibility,
    isCardRuntimeVisible
};

export default evaluateCardRuntimeVisibility;
