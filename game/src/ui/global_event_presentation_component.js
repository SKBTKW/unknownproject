import { UILayoutConfig } from "./layout_config.js";

function translated(i18n, key, fallback = "") {
    if (!key) return fallback;
    const value = i18n?.t?.(key);
    return value && value !== key ? value : fallback || key;
}

function applyLayout(element, config = null) {
    if (!element || !config) return;
    Object.assign(element.style, config);
}

export class GlobalEventPresentationComponent {
    constructor({
        i18n = null,
        onAction = null
    } = {}) {
        this.i18n = i18n;
        this.onAction = typeof onAction === "function" ? onAction : null;
        this.root = null;
        this.shell = null;
        this.presentation = null;
        this.interactionLocked = false;
        this.keydownHandler = event => {
            if (!this.root || this.root.hidden) return;
            if (event.key === "Tab") return;
            event.stopPropagation();
        };
    }

    mount(container = typeof document !== "undefined" ? document.body : null) {
        if (typeof document === "undefined" || !container || this.root) return false;

        const root = document.createElement("div");
        root.className = "ge-presentation-overlay";
        root.hidden = true;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        // Keep the native hidden attribute effective until a presentation is shown.
        // An inline display:flex overrides the [hidden] CSS rule.
        const { display: visibleDisplay, ...overlayLayout } = UILayoutConfig.globalEventPresentation?.overlay || {};
        applyLayout(root, overlayLayout);

        const shell = document.createElement("section");
        shell.className = "ge-presentation-shell";
        applyLayout(shell, UILayoutConfig.globalEventPresentation?.shell);
        root.appendChild(shell);

        root.addEventListener("click", event => event.stopPropagation());
        root.addEventListener("pointerdown", event => event.stopPropagation());
        root.addEventListener("contextmenu", event => event.stopPropagation());
        root.addEventListener("keydown", this.keydownHandler);

        container.appendChild(root);
        this.root = root;
        this.shell = shell;
        return true;
    }

    show(presentation) {
        if (!presentation) return false;
        if (!this.root && !this.mount()) return false;
        this.presentation = presentation;
        this.render();
        this.root.hidden = false;
        this.root.style.display = UILayoutConfig.globalEventPresentation?.overlay?.display || "flex";
        document.body?.setAttribute?.("data-global-event-presentation", "open");
        queueMicrotask(() => this.root?.querySelector?.("[data-ge-primary-action]")?.focus?.());
        return true;
    }

    render() {
        if (!this.shell || !this.presentation) return false;
        const p = this.presentation;
        this.shell.replaceChildren();

        const title = document.createElement("h2");
        title.className = "ge-presentation-title ge-presentation-copy";
        title.textContent = p.title ?? translated(this.i18n, p.titleKey, p.eventId || "");
        this.shell.appendChild(title);

        const imageSlot = document.createElement("div");
        imageSlot.className = "ge-presentation-image-slot";
        applyLayout(imageSlot, UILayoutConfig.globalEventPresentation?.imageSlot);
        imageSlot.dataset.stillId = p.stillId || "";
        if (p.assetReference) {
            const image = document.createElement("img");
            image.className = "ge-presentation-image";
            image.src = p.assetReference;
            image.alt = title.textContent || p.eventId || "";
            imageSlot.appendChild(image);
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "ge-presentation-image-placeholder";
            placeholder.textContent = p.stillId || "";
            imageSlot.appendChild(placeholder);
        }
        this.shell.appendChild(imageSlot);

        const body = document.createElement("div");
        body.className = "ge-presentation-body ge-presentation-copy";
        body.textContent = p.description ?? translated(this.i18n, p.descriptionKey, "");
        this.shell.appendChild(body);

        if (Array.isArray(p.detailRows) && p.detailRows.length) {
            const details = document.createElement("div");
            details.className = "ge-presentation-details ge-presentation-copy";
            for (const rowText of p.detailRows.filter(Boolean)) {
                const row = document.createElement("div");
                row.className = "ge-presentation-detail-row";
                row.textContent = rowText;
                details.appendChild(row);
            }
            this.shell.appendChild(details);
        }

        if (p.advisorText) {
            const advisor = document.createElement("div");
            advisor.className = "ge-presentation-advisor ge-presentation-copy";
            advisor.textContent = p.advisorText;
            this.shell.appendChild(advisor);
        }

        const actions = document.createElement("div");
        actions.className = "ge-presentation-actions ge-presentation-copy";
        for (const action of p.actions || []) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ge-presentation-action";
            button.dataset.geAction = action.id;
            if (action.primary) button.dataset.gePrimaryAction = "true";
            button.textContent = action.label || translated(this.i18n, action.labelKey, action.id);
            button.disabled = this.interactionLocked;
            button.setAttribute("aria-disabled", this.interactionLocked ? "true" : "false");
            button.addEventListener("click", () => {
                if (this.interactionLocked) return;
                this.onAction?.(action.id, p);
            });
            actions.appendChild(button);
        }
        this.shell.appendChild(actions);
        return true;
    }

    setInteractionLocked(locked) {
        this.interactionLocked = locked === true;
        this.root?.querySelectorAll?.("[data-ge-action]")?.forEach?.(button => {
            button.disabled = this.interactionLocked;
            button.setAttribute("aria-disabled", this.interactionLocked ? "true" : "false");
        });
        if (!this.interactionLocked) {
            queueMicrotask(() => this.root?.querySelector?.("[data-ge-primary-action]")?.focus?.());
        }
        return this.interactionLocked;
    }

    hide() {
        if (!this.root) return false;
        this.root.style.removeProperty("display");
        this.root.hidden = true;
        this.shell?.replaceChildren?.();
        this.presentation = null;
        document.body?.removeAttribute?.("data-global-event-presentation");
        return true;
    }

    destroy() {
        this.root?.removeEventListener?.("keydown", this.keydownHandler);
        this.root?.remove?.();
        this.root = null;
        this.shell = null;
        this.presentation = null;
        if (typeof document !== "undefined") {
            document.body?.removeAttribute?.("data-global-event-presentation");
        }
    }
}

export default GlobalEventPresentationComponent;
