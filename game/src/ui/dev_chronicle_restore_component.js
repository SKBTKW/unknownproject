import { isDevelopmentMode } from '../config/dev_mode.js';
import { I18n } from '../i18n.js';
import { UILayoutConfig } from './layout_config.js';
import { ChronicleRestoreController } from './chronicle_restore_controller.js';

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

    render() {
        if (!this.root) return;
        this.list.hidden = !this.open;
        this.list.replaceChildren();
        if (!this.open) return;
        const events = this.ui.engine.chronicleSystem?.getAllEvents?.() || [];
        const points = this.ui.engine.historySnapshotService?.getAllRestorePoints?.() || [];
        for (const point of points) {
            const row = document.createElement('div');
            row.className = 'dev-chronicle-entry';
            row.dataset.verse = String(point.verse);
            const entry = events.find(event => event.id === `VERSE_COMMITTED_${point.sourceCompletedTurn}`);
            const label = document.createElement('span');
            label.textContent = this.i18n.t('DEV_CHRONICLE_VERSE', { verse: point.verse });
            const detail = document.createElement('span');
            detail.className = 'dev-chronicle-detail';
            detail.textContent = entry ? this.i18n.t('DEV_CHRONICLE_COMMITTED', { verse: entry.turn }) : '';
            const restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'dev-chronicle-action';
            restore.textContent = this.i18n.t('DEV_CHRONICLE_RESTORE');
            restore.onclick = () => this.controller.requestRestore(point.verse);
            row.appendChild(label);
            row.appendChild(detail);
            row.appendChild(restore);
            this.list.appendChild(row);
        }
    }
}

export default DevChronicleRestoreComponent;
