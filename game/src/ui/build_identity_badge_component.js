/* =============================================================
   BuildIdentityBadgeComponent
   開発時はブランチ名、製品版はバージョン名を右下へ表示する
   ============================================================= */

import { I18n } from '../i18n.js';
import { BUILD_IDENTITY_MODES } from '../config/build_identity_config.js';
import { BuildIdentityService } from '../services/build_identity_service.js';
import { UILayoutConfig } from './layout_config.js';

class BuildIdentityBadgeComponent {
    constructor({
        identityService = new BuildIdentityService(),
        documentRef = typeof document !== "undefined" ? document : null,
        windowRef = typeof window !== "undefined" ? window : null,
        i18n = I18n
    } = {}) {
        this.identityService = identityService;
        this.documentRef = documentRef;
        this.windowRef = windowRef;
        this.i18n = i18n;
        this.rootEl = null;
        this.labelEl = null;
        this.valueEl = null;
        this.commitLabelEl = null;
        this.commitValueEl = null;
        this.onResize = () => this.applyLayout();
    }

    async mount(parent = null) {
        if (!this.documentRef) return null;
        this.ensureDOM(parent || this.documentRef.body);
        this.applyLayout();

        if (this.windowRef && typeof this.windowRef.addEventListener === "function") {
            this.windowRef.addEventListener("resize", this.onResize);
        }

        const identity = await this.identityService.resolve();
        this.render(identity);
        return identity;
    }

    ensureDOM(parent) {
        if (this.rootEl || !parent) return;

        const existing = this.documentRef.getElementById("buildIdentityBadge");
        if (existing) {
            this.rootEl = existing;
            this.labelEl = existing.querySelector(".build-identity-badge-label");
            this.valueEl = existing.querySelector(".build-identity-badge-value");
            this.commitLabelEl = existing.querySelector(".build-identity-badge-commit-label");
            this.commitValueEl = existing.querySelector(".build-identity-badge-commit-value");
            return;
        }

        const root = this.documentRef.createElement("aside");
        root.id = "buildIdentityBadge";
        root.className = "build-identity-badge";
        root.hidden = true;
        root.setAttribute("aria-live", "polite");

        const label = this.documentRef.createElement("span");
        label.className = "build-identity-badge-label";

        const value = this.documentRef.createElement("span");
        value.className = "build-identity-badge-value";

        const commitLabel = this.documentRef.createElement("span");
        commitLabel.className = "build-identity-badge-commit-label";

        const commitValue = this.documentRef.createElement("span");
        commitValue.className = "build-identity-badge-commit-value";

        root.appendChild(label);
        root.appendChild(value);
        root.appendChild(commitLabel);
        root.appendChild(commitValue);
        parent.appendChild(root);

        this.rootEl = root;
        this.labelEl = label;
        this.valueEl = value;
        this.commitLabelEl = commitLabel;
        this.commitValueEl = commitValue;
    }

    applyLayout() {
        if (!this.rootEl || !UILayoutConfig.buildIdentityBadge) return;
        const isMobile = this.windowRef && typeof this.windowRef.matchMedia === "function"
            ? this.windowRef.matchMedia("(max-width: 768px)").matches
            : Boolean(this.windowRef && this.windowRef.innerWidth <= 768);
        const config = isMobile
            ? UILayoutConfig.buildIdentityBadge.mobile
            : UILayoutConfig.buildIdentityBadge.desktop;
        Object.assign(this.rootEl.style, config);
    }

    render(identity) {
        if (!this.rootEl || !this.labelEl || !this.valueEl || !identity) return;
        const isDevelopment = identity.mode === BUILD_IDENTITY_MODES.DEVELOPMENT;
        const labelKey = isDevelopment
            ? "UI_BUILD_BADGE_BRANCH"
            : "UI_BUILD_BADGE_VERSION";
        const label = this.i18n && typeof this.i18n.t === "function"
            ? this.i18n.t(labelKey)
            : labelKey;
        const commitLabel = this.i18n && typeof this.i18n.t === "function"
            ? this.i18n.t("UI_BUILD_BADGE_COMMIT")
            : "UI_BUILD_BADGE_COMMIT";
        const hasCommit = isDevelopment && Boolean(identity.commitId);

        this.rootEl.classList.toggle("is-development", isDevelopment);
        this.rootEl.classList.toggle("is-production", !isDevelopment);
        this.rootEl.classList.toggle("has-commit", hasCommit);
        this.rootEl.dataset.mode = identity.mode;
        this.rootEl.setAttribute(
            "aria-label",
            hasCommit
                ? `${label}: ${identity.value}, ${commitLabel}: ${identity.commitId}`
                : `${label}: ${identity.value}`
        );
        this.labelEl.textContent = label;
        this.valueEl.textContent = identity.value;
        if (this.commitLabelEl) {
            this.commitLabelEl.textContent = commitLabel;
            this.commitLabelEl.hidden = !hasCommit;
        }
        if (this.commitValueEl) {
            this.commitValueEl.textContent = hasCommit ? identity.commitId : "";
            this.commitValueEl.hidden = !hasCommit;
        }
        this.rootEl.hidden = false;
    }

    destroy() {
        if (this.windowRef && typeof this.windowRef.removeEventListener === "function") {
            this.windowRef.removeEventListener("resize", this.onResize);
        }
        if (this.rootEl && typeof this.rootEl.remove === "function") {
            this.rootEl.remove();
        }
        this.rootEl = null;
        this.labelEl = null;
        this.valueEl = null;
        this.commitLabelEl = null;
        this.commitValueEl = null;
    }
}

export { BuildIdentityBadgeComponent };
export default BuildIdentityBadgeComponent;
