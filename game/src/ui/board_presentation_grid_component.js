import { BoardGridComponent as LegacyBoardGridComponent } from './board_grid_component.js';
import { BOARD_CONTEXT_MODES } from '../presentation/board_presentation_state.js';
import { resolveTrialBattleMarkerState } from '../presentation/trial_board_semantic_data.js';
import { resolveTrialTacticalEffectGlyph } from '../presentation/trial_tactical_effect_semantic.js';
import { applyBoardGroupJoinClasses } from './board_presentation_2d_edge_adapter.js';
import { BOARD_INPUT_COMMANDS } from '../presentation/board_input_contract.js';
import {
    BOARD_POINTER_ACTIONS,
    resolveBoardPointerCommand
} from '../presentation/board_input_semantic_resolver.js';

export const TRIAL_VISUAL_CLASSES = Object.freeze([
    'trial-route-cell',
    'trial-route-entry',
    'trial-route-end',
    'trial-interception-candidate',
    'trial-interception-selected',
    'trial-interception-planned',
    'trial-interception-planned-active',
    'trial-interception-planned-other',
    'trial-interception-block-used',
    'trial-battle-pending',
    'trial-battle-active',
    'trial-battle-resolved',
    'trial-battle-current'
]);

export function resolveTrialTacticalEffectBadges(effects = []) {
    const seen = new Set();
    const badges = [];
    for (const effect of effects || []) {
        if (!effect?.effectId || seen.has(effect.effectId)) continue;
        seen.add(effect.effectId);
        badges.push(Object.freeze({
            effectId: effect.effectId,
            glyph: resolveTrialTacticalEffectGlyph(effect.effectId),
            phase: effect.phase || 'AVAILABLE',
            polarity: effect.polarity || 'NEUTRAL'
        }));
        if (badges.length >= 2) break;
    }
    return Object.freeze(badges);
}

export function resolveTrialDefenseAllocationBadge(trial) {
    const source = trial?.battleMarker || trial?.plannedIntercept || null;
    if (!source) return null;
    const amount = Number(source.defenseAllocation);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return Object.freeze({
        amount: Math.trunc(amount),
        source: trial?.battleMarker ? 'BATTLE' : 'PLANNED'
    });
}

export function resolveBoardDamageMarker(history) {
    const damage = history?.damage || null;
    if (!damage?.any) return null;
    return Object.freeze({
        land: Boolean(damage.land),
        specialBlock: Boolean(damage.specialBlock),
        count: Array.isArray(damage.records) ? damage.records.length : 0
    });
}

export function resolveBattleSiteMarker(history) {
    const sites = Array.isArray(history?.battleSites) ? history.battleSites : [];
    if (!history?.battleSite || sites.length === 0) return null;
    const latest = [...sites].sort((a, b) => {
        const turnDelta = (b?.settledTurn ?? -1) - (a?.settledTurn ?? -1);
        if (turnDelta !== 0) return turnDelta;
        return (b?.trialIndex ?? -1) - (a?.trialIndex ?? -1);
    })[0] || null;
    return Object.freeze({
        count: sites.length,
        trialIndex: Number.isInteger(latest?.trialIndex) ? latest.trialIndex : null,
        outcome: latest?.outcome || null
    });
}

export function resolveBoardRoadDirections(edges = []) {
    const directions = [];
    const seen = new Set();
    for (const edge of edges || []) {
        const direction = String(edge?.direction || '').toUpperCase();
        if (!edge?.road || !edge?.neighbor || !['NORTH', 'EAST', 'SOUTH', 'WEST'].includes(direction)) continue;
        if (seen.has(direction)) continue;
        seen.add(direction);
        directions.push(direction);
    }
    return Object.freeze(directions);
}

export class BoardPresentationGridComponent extends LegacyBoardGridComponent {
    render(I18n) {
        super.render(I18n);
        this.bindBoardInput();
        this.applyBoardPresentation();
    }

    bindBoardInput() {
        if (typeof document === 'undefined') return;
        const runtime = this.ui?.boardPresentationRuntimeBridge;
        if (!runtime || typeof runtime.dispatchInput !== 'function') return;
        const boardEl = document.getElementById('gridBoard');
        if (!boardEl) return;

        boardEl.querySelectorAll('.cell').forEach(cellEl => {
            const r = Number(cellEl.getAttribute('data-r'));
            const c = Number(cellEl.getAttribute('data-c'));
            if (!Number.isInteger(r) || !Number.isInteger(c)) return;

            const legacyEnter = cellEl.onmouseenter;
            const legacyLeave = cellEl.onmouseleave;

            cellEl.onclick = () => {
                const command = resolveBoardPointerCommand(
                    BOARD_POINTER_ACTIONS.CLICK,
                    {
                        readModel: this.ui.getBoardPresentationData?.() || null,
                        cell: { r, c }
                    }
                );
                if (!command) return null;
                const result = runtime.dispatchInput(command);
                this.applyBoardPresentation();
                return result;
            };

            cellEl.onmouseenter = event => {
                const command = resolveBoardPointerCommand(
                    BOARD_POINTER_ACTIONS.HOVER,
                    {
                        readModel: this.ui.getBoardPresentationData?.() || null,
                        cell: { r, c }
                    }
                );
                if (!command) return null;
                const result = runtime.dispatchInput(command);
                if (result?.success !== false
                    && command.type === BOARD_INPUT_COMMANDS.HOVER_CELL
                    && typeof legacyEnter === 'function') {
                    legacyEnter(event);
                }
                this.applyBoardPresentation();
                return result;
            };

            cellEl.onmouseleave = event => {
                const command = resolveBoardPointerCommand(
                    BOARD_POINTER_ACTIONS.LEAVE,
                    { readModel: this.ui.getBoardPresentationData?.() || null }
                );
                const result = runtime.dispatchInput(command);
                if (result?.success !== false
                    && command.type === BOARD_INPUT_COMMANDS.CLEAR_HOVER
                    && typeof legacyLeave === 'function') {
                    legacyLeave(event);
                }
                this.applyBoardPresentation();
                return result;
            };
        });
    }

    applyBoardPresentation() {
        if (typeof document === 'undefined') return;
        if (!this.ui || typeof this.ui.getBoardPresentationData !== 'function') return;
        const boardEl = document.getElementById('gridBoard');
        if (!boardEl) return;
        const presentation = this.ui.getBoardPresentationData();
        const state = presentation?.presentation || null;
        const cells = presentation?.cells || [];
        if (state) {
            boardEl.setAttribute('data-board-view-mode', state.viewMode);
            boardEl.setAttribute('data-board-context-mode', state.contextMode);
        }
        const profile = presentation?.profile || {};
        const visibilityAttributes = [
            ['yields', 'data-board-yields-visibility'],
            ['sockets', 'data-board-sockets-visibility'],
            ['roads', 'data-board-roads-visibility'],
            ['trialRoutes', 'data-board-trial-routes-visibility'],
            ['invasionEntry', 'data-board-invasion-entry-visibility'],
            ['interception', 'data-board-interception-visibility'],
            ['defenseAllocation', 'data-board-defense-allocation-visibility'],
            ['battleMarkers', 'data-board-battle-markers-visibility'],
            ['tacticalEffects', 'data-board-tactical-effects-visibility']
        ];
        for (const [key, attribute] of visibilityAttributes) {
            if (profile[key]) boardEl.setAttribute(attribute, profile[key]);
            else boardEl.removeAttribute(attribute);
        }
        const isTrialContext = state?.contextMode === BOARD_CONTEXT_MODES.TRIAL;
        boardEl.querySelectorAll('.cell').forEach(cellEl => {
            const r = Number(cellEl.getAttribute('data-r'));
            const c = Number(cellEl.getAttribute('data-c'));
            if (!Number.isInteger(r) || !Number.isInteger(c)) return;
            const cell = cells?.[r]?.[c] || null;
            const interaction = cell?.interaction || null;
            const trial = cell?.trial || null;
            cellEl.querySelector?.('.trial-defense-allocation-badge')?.remove?.();
            cellEl.querySelector?.('.trial-tactical-effect-stack')?.remove?.();
            cellEl.querySelector?.('.board-road-segments')?.remove?.();
            cellEl.querySelector?.('.battle-site-history-marker')?.remove?.();
            cellEl.querySelector?.('.board-damage-marker-stack')?.remove?.();
            applyBoardGroupJoinClasses(cellEl, cell?.edges);
            cellEl.classList.toggle('board-logical-hover', !isTrialContext && Boolean(interaction?.hovered));
            cellEl.classList.toggle('board-logical-focus', !isTrialContext && Boolean(interaction?.focused));
            cellEl.classList.toggle('board-logical-selected', !isTrialContext && Boolean(interaction?.selected));
            cellEl.classList.toggle('cell-placed-this-turn', Boolean(interaction?.placedThisTurn));

            const damageMarker = resolveBoardDamageMarker(cell?.history);
            cellEl.classList.toggle('has-board-damage', Boolean(damageMarker));
            cellEl.classList.toggle('has-land-damage', Boolean(damageMarker?.land));
            cellEl.classList.toggle('has-special-block-damage', Boolean(damageMarker?.specialBlock));
            if (damageMarker) {
                const damageStack = document.createElement('span');
                damageStack.className = 'board-damage-marker-stack';
                damageStack.setAttribute('aria-hidden', 'true');
                damageStack.setAttribute('data-damage-count', String(damageMarker.count));

                if (damageMarker.land) {
                    const landDamageEl = document.createElement('span');
                    landDamageEl.className = 'board-damage-marker is-land';
                    landDamageEl.textContent = '✦';
                    damageStack.appendChild(landDamageEl);
                }
                if (damageMarker.specialBlock) {
                    const specialDamageEl = document.createElement('span');
                    specialDamageEl.className = 'board-damage-marker is-special-block';
                    specialDamageEl.textContent = '!';
                    damageStack.appendChild(specialDamageEl);
                }
                cellEl.appendChild(damageStack);
            }

            const battleSiteMarker = resolveBattleSiteMarker(cell?.history);
            cellEl.classList.toggle('has-battle-site-history', Boolean(battleSiteMarker));
            if (battleSiteMarker) {
                const historyEl = document.createElement('span');
                historyEl.className = 'battle-site-history-marker';
                historyEl.textContent = '⚔';
                historyEl.setAttribute('aria-hidden', 'true');
                historyEl.setAttribute('data-battle-site-count', String(battleSiteMarker.count));
                if (battleSiteMarker.trialIndex !== null) {
                    historyEl.setAttribute('data-trial-index', String(battleSiteMarker.trialIndex));
                }
                if (battleSiteMarker.outcome) {
                    historyEl.setAttribute('data-battle-outcome', String(battleSiteMarker.outcome));
                }
                cellEl.appendChild(historyEl);
            }

            const roadDirections = resolveBoardRoadDirections(cell?.edges);
            if (roadDirections.length > 0) {
                const roadEl = document.createElement('span');
                roadEl.className = 'board-road-segments';
                roadEl.setAttribute('aria-hidden', 'true');
                for (const direction of roadDirections) {
                    const segmentEl = document.createElement('span');
                    segmentEl.className = `board-road-segment is-${direction.toLowerCase()}`;
                    roadEl.appendChild(segmentEl);
                }
                cellEl.appendChild(roadEl);
            }

            if (!isTrialContext) {
                TRIAL_VISUAL_CLASSES.forEach(cls => cellEl.classList.remove(cls));
                cellEl.removeAttribute('data-trial-direction');
                return;
            }
            cellEl.classList.toggle('trial-route-cell', Boolean(trial?.onRoute));
            cellEl.classList.toggle('trial-route-entry', Boolean(trial?.route?.isRouteEntry));
            cellEl.classList.toggle('trial-route-end', Boolean(trial?.route?.isRouteEnd));
            cellEl.classList.toggle('trial-interception-candidate', Boolean(trial?.interceptionCandidate?.canIntercept));
            cellEl.classList.toggle('trial-interception-selected', Boolean(trial?.interceptionSelected));
            cellEl.classList.toggle('trial-interception-planned', Boolean(trial?.plannedIntercept));
            cellEl.classList.toggle('trial-interception-planned-active', Boolean(trial?.plannedIntercept && trial.plannedIntercept.routeId === presentation?.trial?.activeRouteId));
            cellEl.classList.toggle('trial-interception-planned-other', Boolean(trial?.plannedIntercept && trial.plannedIntercept.routeId !== presentation?.trial?.activeRouteId));
            cellEl.classList.toggle('trial-interception-block-used', Boolean(trial?.interceptionCandidate?.isBlockPlannedByOther));
            const battleState = resolveTrialBattleMarkerState(trial?.battleMarker);
            cellEl.classList.toggle('trial-battle-pending', Boolean(battleState?.isPending));
            cellEl.classList.toggle('trial-battle-active', Boolean(battleState?.isActive));
            cellEl.classList.toggle('trial-battle-resolved', Boolean(battleState?.isResolved));
            cellEl.classList.toggle('trial-battle-current', Boolean(battleState?.isCurrent));

            const defenseBadge = resolveTrialDefenseAllocationBadge(trial);
            if (defenseBadge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = `trial-defense-allocation-badge is-${defenseBadge.source.toLowerCase()}`;
                badgeEl.textContent = `🛡️${defenseBadge.amount}`;
                badgeEl.setAttribute('aria-hidden', 'true');
                cellEl.appendChild(badgeEl);
            }

            const tacticalBadges = resolveTrialTacticalEffectBadges(trial?.tacticalEffects);
            if (tacticalBadges.length > 0) {
                const stackEl = document.createElement('span');
                stackEl.className = 'trial-tactical-effect-stack';
                stackEl.setAttribute('aria-hidden', 'true');
                for (const badge of tacticalBadges) {
                    const effectEl = document.createElement('span');
                    effectEl.className = [
                        'trial-tactical-effect-badge',
                        `is-${String(badge.phase).toLowerCase()}`,
                        `is-${String(badge.polarity).toLowerCase()}`
                    ].join(' ');
                    effectEl.textContent = badge.glyph;
                    stackEl.appendChild(effectEl);
                }
                cellEl.appendChild(stackEl);
            }

            if (trial?.route?.routeDirection) cellEl.setAttribute('data-trial-direction', trial.route.routeDirection);
            else cellEl.removeAttribute('data-trial-direction');
        });
    }
}

export default BoardPresentationGridComponent;
