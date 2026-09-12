import { isDevelopmentMode } from '../config/dev_mode.js';
import { I18n } from '../i18n.js';
import { UILayoutConfig } from './layout_config.js';
import { ChronicleRestoreController } from './chronicle_restore_controller.js';
import { describeChronicleVerse } from './chronicle_verse_entries.js';

/** Separate, dev-only Chronicle listing; does not repurpose the hidden operation log. */
export class DevChronicleRestoreComponent {
    constructor(ui, { devModeResolver = isDevelopmentMode, confirm, i18n = I18n } = {}) {
        this.ui = ui;
        this.devModeResolver = devModeResolver;
        this.i18n = i18n;
        this.root = null;
        this.list = null;
        this.status = null;
        this.open = false;
        this.selectedVerse = null;
        this.controller = new ChronicleRestoreController(ui, {
            confirm,
            i18n,
            onError: message => this.setStatus(message),
            onResult: result => this.setStatus(this.i18n.t('DEV_CHRONICLE_RESTORED', {
                requested: result.requestedVerse, restored: result.restoredVerse
            }))
        });
    }

    mount(container) {
        if (!container || this.root || !this.devModeResolver()) return;
        const root = document.createElement('section');
        root.id = 'devChronicleRestore';
        root.className = 'dev-chronicle-restore';
        Object.assign(root.style, UILayoutConfig.devChronicleRestore);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'dev-chronicle-toggle';
        toggle.textContent = this.i18n.t('DEV_CHRONICLE_TITLE');
        toggle.onclick = () => { this.open = !this.open; this.render(); };
        const list = document.createElement('div');
        list.className = 'dev-chronicle-entries';
        const status = document.createElement('p');
        status.className = 'dev-chronicle-status';
        status.setAttribute('role', 'status');
        root.appendChild(toggle);
        root.appendChild(list);
        root.appendChild(status);
        container.appendChild(root);
        this.root = root;
        this.list = list;
        this.status = status;
        this.render();
    }

    setStatus(message) {
        if (this.status) this.status.textContent = message;
    }

    getEntryTitle(verse) {
        const points = this.ui.engine.historySnapshotService?.getAllRestorePoints?.() || [];
        const index = points.findIndex(point => point.verse === verse);
        return index < 0 ? null : describeChronicleVerse(points[index], points[index - 1], this.i18n).title;
    }

    render() {
        if (!this.root) return;
        this.list.hidden = !this.open;
        this.list.replaceChildren();
        if (!this.open) return;
        const points = this.ui.engine.historySnapshotService?.getAllRestorePoints?.() || [];
        if (!points.some(point => point.verse === this.selectedVerse)) this.selectedVerse = null;
        for (let index = 0; index < points.length; index++) {
            const point = points[index];
            const entry = describeChronicleVerse(point, points[index - 1], this.i18n);
            const row = document.createElement('div');
            row.className = 'dev-chronicle-entry';
            row.dataset.verse = String(point.verse);
            row.dataset.importance = entry.importance;
            const label = document.createElement('button');
            label.type = 'button';
            label.className = 'dev-chronicle-view';
            label.textContent = this.i18n.t('DEV_CHRONICLE_VERSE', { verse: point.verse });
            label.setAttribute('aria-expanded', String(this.selectedVerse === point.verse));
            label.onclick = () => { this.selectedVerse = this.selectedVerse === point.verse ? null : point.verse; this.render(); };
            const detail = document.createElement('div');
            detail.className = 'dev-chronicle-detail';
            detail.textContent = entry.title;
            const restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'dev-chronicle-action';
            restore.textContent = this.i18n.t('DEV_CHRONICLE_RESTORE');
            restore.onclick = () => this.controller.requestRestore(point.verse);
            row.appendChild(label);
            row.appendChild(detail);
            row.appendChild(restore);
            this.list.appendChild(row);
            if (this.selectedVerse === point.verse) {
                const expanded = document.createElement('div');
                expanded.className = 'dev-chronicle-expanded';
                expanded.textContent = entry.events.length
                    ? entry.events.map(event => this.i18n.t(event.nameKey || event.id)).join(' · ')
                    : this.i18n.t('DEV_CHRONICLE_NO_EVENTS');
                this.list.appendChild(expanded);
            }
        }
    }
}

export default DevChronicleRestoreComponent;
