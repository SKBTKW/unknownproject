import { choiceText } from './global_event_choice_i18n.js';

export class GlobalEventChoiceComponent {
    constructor({ i18n, onChoose = null } = {}) {
        this.i18n = i18n;
        this.onChoose = onChoose;
        this.root = null;
        this.presentation = null;
        this.advisorReaction = null;
        this.neutralReaction = null;
    }

    mount(container = document.body) {
        if (typeof document === 'undefined' || this.root) return;
        if (!document.getElementById('ge-choice-style')) {
            const style = document.createElement('style');
            style.id = 'ge-choice-style';
            style.textContent = `.ge-choice-overlay{position:fixed;inset:0;z-index:240000;background:rgba(7,10,14,.82);display:flex;align-items:center;justify-content:center;padding:32px}.ge-choice-overlay[hidden]{display:none}.ge-choice-card{width:min(820px,92vw);max-height:88vh;overflow:auto;background:rgba(20,24,31,.98);border:1px solid rgba(212,188,132,.52);box-shadow:0 24px 70px rgba(0,0,0,.72);padding:28px}.ge-choice-kicker{font-size:12px;letter-spacing:.18em;opacity:.65}.ge-choice-title{font-size:26px;font-weight:800;margin:6px 0 12px}.ge-choice-desc,.ge-choice-result{line-height:1.75;margin-bottom:18px}.ge-choice-context{display:grid;gap:6px;margin:0 0 20px;padding:14px 16px;background:rgba(255,255,255,.045);border-left:2px solid rgba(212,188,132,.55)}.ge-choice-row{font-size:13px;line-height:1.5;opacity:.86}.ge-choice-advisor{margin:0 0 18px;padding:12px 14px;border:1px solid rgba(255,255,255,.11);background:rgba(0,0,0,.18)}.ge-choice-advisor-label{font-size:11px;letter-spacing:.12em;opacity:.58;margin-bottom:6px}.ge-choice-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ge-choice-btn,.ge-choice-close{padding:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;font:inherit;cursor:pointer}.ge-choice-close{display:block;margin-left:auto;padding:9px 18px}.ge-choice-btn:hover,.ge-choice-close:hover{background:rgba(255,255,255,.11)}@media(max-width:760px){.ge-choice-actions{grid-template-columns:1fr}}`;
            document.head.appendChild(style);
        }
        this.root = document.createElement('div');
        this.root.className = 'ge-choice-overlay';
        this.root.hidden = true;
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        container.appendChild(this.root);
    }

    setAdvisorReaction(reaction) {
        this.advisorReaction = reaction || null;
        if (this.presentation && this.root && !this.root.hidden) this.renderPresentation();
        return true;
    }
    setNeutralReaction(reaction) {
        this.neutralReaction = reaction || null;
        if (this.presentation && this.root && !this.root.hidden) this.renderPresentation();
        return true;
    }

    show(presentation) {
        if (!this.root) this.mount();
        this.presentation = presentation;
        this.renderPresentation();
        this.root.hidden = false;
    }

    renderPresentation() {
        const p = this.presentation;
        if (!this.root || !p) return;
        const ctx = p.publicContext || {};
        const rows = [ctx.captureZone, ctx.civilianMood, ...(ctx.visibleFacts || [])]
            .filter(Boolean).map(key => `<div class="ge-choice-row">${choiceText(this.i18n, key)}</div>`).join('');
        const reaction = this.advisorReaction || this.neutralReaction;
        const reactionText = reaction?.lineKey ? this.i18n?.t?.(reaction.lineKey) : '';
        const advisor = reactionText && reactionText !== reaction.lineKey
            ? `<div class="ge-choice-advisor"><div class="ge-choice-advisor-label">${choiceText(this.i18n, 'advisor')}</div><div>${reactionText}</div></div>` : '';
        const actions = (p.choices || []).map(choice => `<button class="ge-choice-btn" data-choice="${choice.id}">${choiceText(this.i18n, choice.id)}</button>`).join('');
        this.root.innerHTML = `<section class="ge-choice-card"><div class="ge-choice-kicker">${choiceText(this.i18n,'decision')}</div><div class="ge-choice-title">${choiceText(this.i18n,'title')}</div><div class="ge-choice-desc">${choiceText(this.i18n,'desc')}</div><div class="ge-choice-context">${rows}</div>${advisor}<div class="ge-choice-actions">${actions}</div></section>`;
        this.root.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = () => this.onChoose?.(btn.dataset.choice));
    }

    showResolution(resolution) {
        if (!this.root) return;
        this.presentation = null;
        const resultKey = `RESULT_${resolution?.choiceId || ''}`;
        const reaction = this.advisorReaction || this.neutralReaction;
        const reactionText = reaction?.lineKey ? this.i18n?.t?.(reaction.lineKey) : '';
        const advisor = reactionText && reactionText !== reaction.lineKey
            ? `<div class="ge-choice-advisor"><div class="ge-choice-advisor-label">${choiceText(this.i18n,'advisor')}</div><div>${reactionText}</div></div>` : '';
        this.root.innerHTML = `<section class="ge-choice-card"><div class="ge-choice-kicker">${choiceText(this.i18n,'result')}</div><div class="ge-choice-title">${choiceText(this.i18n,'title')}</div><div class="ge-choice-result">${choiceText(this.i18n,resultKey)}</div>${advisor}<button class="ge-choice-close">${choiceText(this.i18n,'close')}</button></section>`;
        this.root.querySelector('.ge-choice-close').onclick = () => this.hide();
    }

    hide() {
        if (!this.root) return;
        this.root.hidden = true;
        this.root.innerHTML = '';
        this.presentation = null;
        this.advisorReaction = null;
        this.neutralReaction = null;
    }
}

export default GlobalEventChoiceComponent;
