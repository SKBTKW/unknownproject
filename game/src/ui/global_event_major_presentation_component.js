export class GlobalEventMajorPresentationComponent {
    constructor({ i18n, onClose = null } = {}) {
        this.i18n = i18n;
        this.onClose = onClose;
        this.root = null;
        this.presentation = null;
    }

    mount(container = document.body) {
        if (typeof document === "undefined" || this.root) return;
        if (!document.getElementById("ge-major-presentation-style")) {
            const style = document.createElement("style");
            style.id = "ge-major-presentation-style";
            style.textContent = ".ge-major-overlay{position:fixed;inset:0;z-index:239000;background:rgba(5,8,12,.86);display:flex;align-items:center;justify-content:center;padding:28px}.ge-major-overlay[hidden]{display:none}.ge-major-card{width:min(760px,92vw);max-height:88vh;overflow:auto;background:rgba(18,22,29,.98);border:1px solid rgba(212,188,132,.52);box-shadow:0 24px 70px rgba(0,0,0,.72);padding:28px}.ge-major-still{min-height:220px;margin:0 0 20px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));display:flex;align-items:end;padding:14px;font-size:12px;letter-spacing:.12em;opacity:.7}.ge-major-title{font-size:28px;font-weight:800;margin:0 0 14px}.ge-major-desc{line-height:1.85;margin:0 0 24px;white-space:pre-line}.ge-major-close{display:block;margin-left:auto;padding:10px 20px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;font:inherit;cursor:pointer}.ge-major-close:hover{background:rgba(255,255,255,.11)}";
            document.head.appendChild(style);
        }
        this.root = document.createElement("div");
        this.root.className = "ge-major-overlay";
        this.root.hidden = true;
        this.root.setAttribute("role", "dialog");
        this.root.setAttribute("aria-modal", "true");
        container.appendChild(this.root);
    }

    show(presentation) {
        if (!presentation) return false;
        if (!this.root) this.mount();
        if (!this.root) return false;

        this.presentation = presentation;
        const title = this.i18n?.t?.(presentation.titleKey) ?? presentation.titleKey;
        const description = this.i18n?.t?.(presentation.descriptionKey) ?? presentation.descriptionKey;
        const closeText = this.i18n?.t?.("UI_GLOBAL_EVENT_CLOSE") ?? "UI_GLOBAL_EVENT_CLOSE";
        const stillLabel = presentation.stillId || "";

        this.root.dataset.eventId = presentation.eventId || "";
        this.root.dataset.stillId = stillLabel;
        this.root.innerHTML = `<section class="ge-major-card"><div class="ge-major-still" data-still-id="${stillLabel}">${stillLabel}</div><h2 class="ge-major-title">${title}</h2><div class="ge-major-desc">${description}</div><button class="ge-major-close">${closeText}</button></section>`;
        this.root.querySelector(".ge-major-close").onclick = () => this.hide();
        this.root.hidden = false;
        return true;
    }

    hide() {
        if (!this.root) return false;
        this.root.hidden = true;
        this.root.innerHTML = "";
        const closed = this.presentation;
        this.presentation = null;
        this.onClose?.(closed);
        return true;
    }
}

export default GlobalEventMajorPresentationComponent;
