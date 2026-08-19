/* =============================================================
   v2_ui_renderer.js
   UIプレゼンテーション＆DOMレンダリング専用レンダラーモジュール
   ============================================================= */

window.currentBoardMode = "hover";

function toggleBoardLabelMode(e) {
    if (e) e.stopPropagation();
    const modes = ["hover", "icon", "always"];
    const current = window.currentBoardMode || "hover";
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    window.currentBoardMode = modes[nextIdx];
    
    if (typeof render === "function") render();
}
window.toggleBoardLabelMode = toggleBoardLabelMode;

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function initStaticI18nLabels() {
    const I18n = window.I18n;
    if (!I18n) return;
    document.title = I18n.t("UI_TITLE");
    setElementText("lblAppTitle", I18n.t("UI_TITLE"));
    setElementText("lblRoleAvatar", I18n.t("UI_ROLE_AVATAR"));
    setElementText("lblTurnHeader", I18n.t("UI_TURN_LABEL"));
    setElementText("lblOfferingTitle", I18n.t("UI_OFFERING_TITLE"));
    setElementText("lblReserveTitle", I18n.t("UI_RESERVE_TITLE"));
    setElementText("lblMainBadge", I18n.t("UI_MAIN_AREA_BADGE"));
    setElementText("lblDataPanelTitle", I18n.t("UI_DATA_PANEL_TITLE"));
    setElementText("lblBuffPanelTitle", I18n.t("UI_BUFF_PANEL_TITLE"));
    setElementText("lblFood", I18n.t("UI_FOOD"));
    setElementText("lblWood", I18n.t("UI_WOOD"));
    setElementText("lblDefense", I18n.t("UI_DEFENSE"));
    setElementText("lblMystic", I18n.t("UI_MYSTIC"));
    setElementText("lblLogTitle", I18n.t("UI_LOG_TITLE"));
    setElementText("btnLogToggle", "▼");
    setElementText("btnMulligan", I18n.t("UI_MULLIGAN_BTN"));
    setElementText("btnTurnEnd", I18n.t("UI_TURN_END_BTN"));
    setElementText("lblLogSub", I18n.t("UI_LOG_SUB_HINT"));
}

window.V2UIRenderer = {
    setElementText,
    initStaticI18nLabels
};

function renderDirectiveHeaderBadge() {
    const badgeEl = document.getElementById("directiveHeaderBadge");
    if (!badgeEl || !window.state || !window.state.directiveSystem) return;

    const I18n = window.I18n;
    const sys = window.state.directiveSystem;
    const active = sys.getCurrentDirective();

    const rawName = I18n ? I18n.t(active.nameKey) : active.id;
    const cleanName = rawName.replace(/^[^\w\s\u3000-\u9FAF]+/u, '').trim();

    badgeEl.innerHTML = `
        <div class="directive-pill ${active.badgeClass}" 
             onclick="openDirectiveModal()" 
             onmouseenter="showDirectiveTooltip(event)" 
             onmouseleave="hideDirectiveTooltip()">
            <span class="directive-icon">${active.icon}</span>
            <span class="directive-name">${cleanName}</span>
            <span class="directive-info-icon">ℹ️</span>
        </div>
    `;
}

function showDirectiveTooltip(e) {
    let tt = document.getElementById("directiveTooltip");
    if (!tt) {
        tt = document.createElement("div");
        tt.id = "directiveTooltip";
        tt.className = "large-directive-tooltip";
        document.body.appendChild(tt);
    }

    if (!window.state || !window.state.directiveSystem) return;
    const I18n = window.I18n;
    const sys = window.state.directiveSystem;
    const active = sys.getCurrentDirective();

    const rawName = I18n ? I18n.t(active.nameKey) : active.id;
    const desc = I18n ? I18n.t(active.descKey) : "";

    let lockText = "";
    if (sys.lockTurnsRemaining > 0) {
        lockText = `<div style="color:#e74c3c; font-size:13px; font-weight:bold; margin-top:6px;">🔒 発令後ロック中 (残り ${sys.lockTurnsRemaining} ターン変更不可)</div>`;
    }

    tt.innerHTML = `
        <div style="font-size:18px; font-weight:900; color:#1abc9c; margin-bottom:8px; border-bottom:1.5px solid #2a2e3d; padding-bottom:6px; display:flex; align-items:center; gap:8px;">
            <span>${active.icon}</span> ${rawName} <span style="font-size:12px; color:#2ecc71; background:rgba(46,204,113,0.15); padding:2px 8px; border-radius:10px;">発動中</span>
        </div>
        <div style="font-size:16px; color:#ffffff; line-height:1.5; font-weight:bold; margin-bottom:10px;">
            ${desc}
        </div>
        ${lockText}
        <div style="font-size:12px; color:#f39c12; margin-top:8px; border-top:1px dashed #34495e; padding-top:6px; font-weight:bold;">
            💡 クリックで方針変更メニューを開く
        </div>
    `;

    const rect = e.currentTarget.getBoundingClientRect();
    tt.style.position = "fixed";
    tt.style.top = `${rect.bottom + 8}px`;
    tt.style.right = `${window.innerWidth - rect.right}px`;
    tt.style.display = "block";
}

function hideDirectiveTooltip() {
    const tt = document.getElementById("directiveTooltip");
    if (tt) tt.style.display = "none";
}

function openDirectiveModal() {
    const modal = document.getElementById("directiveModal");
    if (!modal || !window.state || !window.state.directiveSystem) return;

    const I18n = window.I18n;
    const sys = window.state.directiveSystem;
    const listEl = document.getElementById("directiveOptionsList");
    const costCostVal = sys.getChangeCost();
    const costText = costCostVal === 0 ? "無料" : `🔥 -${costCostVal}`;

    document.getElementById("directiveChangeCostVal").innerText = costText;

    if (listEl) {
        listEl.innerHTML = "";
        const allKeys = Object.keys(window.DIRECTIVES || {});
        allKeys.forEach(key => {
            const d = window.DIRECTIVES[key];
            const isCurrent = (key === sys.currentDirectiveId);
            const rawName = I18n ? I18n.t(d.nameKey) : d.id;
            const cleanName = rawName.replace(/^[^\w\s\u3000-\u9FAF]+/u, '').trim();
            const desc = I18n ? I18n.t(d.descKey) : "";
            const check = sys.canChangeDirective(key);

            const cardDiv = document.createElement("div");
            cardDiv.className = `directive-option-card ${isCurrent ? 'active' : ''} ${!check.possible && !isCurrent ? 'disabled' : ''}`;
            
            let statusBtnHtml = `<button class="directive-select-btn" onclick="selectDirective('${key}')">発令する (${costText})</button>`;
            if (isCurrent) {
                statusBtnHtml = `<span class="directive-active-badge">✓ 発動中</span>`;
            } else if (!check.possible) {
                if (check.reason === "NOT_UNLOCKED") statusBtnHtml = `<span class="directive-locked-badge">🔒 未解放 (スキルツリー要解放)</span>`;
                else if (check.reason === "LOCKED") statusBtnHtml = `<span class="directive-locked-badge">🔒 変更ロック中 (${check.turns}T)</span>`;
                else if (check.reason === "INSUFFICIENT_EMBER") statusBtnHtml = `<span class="directive-locked-badge">💀 残り火不足 (要 🔥-${check.cost})</span>`;
            }

            cardDiv.innerHTML = `
                <div class="directive-card-header">
                    <span class="directive-card-icon">${d.icon}</span>
                    <span class="directive-card-title">${cleanName}</span>
                </div>
                <div class="directive-card-desc">${desc}</div>
                <div class="directive-card-footer">${statusBtnHtml}</div>
            `;
            listEl.appendChild(cardDiv);
        });
    }

    modal.style.display = "flex";
}

function closeDirectiveModal() {
    const modal = document.getElementById("directiveModal");
    if (modal) modal.style.display = "none";
}

function selectDirective(key) {
    if (!window.state || !window.state.directiveSystem) return;
    const res = window.state.directiveSystem.changeDirective(key);
    if (res.possible) {
        closeDirectiveModal();
        if (typeof render === "function") render();
    } else {
        alert("変更できません: " + res.reason);
    }
}

window.renderDirectiveHeaderBadge = renderDirectiveHeaderBadge;
window.openDirectiveModal = openDirectiveModal;
window.closeDirectiveModal = closeDirectiveModal;
window.selectDirective = selectDirective;

function clearCellPreviews() {
    const cells = document.querySelectorAll(".cell");
    cells.forEach(c => {
        c.classList.remove("preview-valid", "preview-invalid", "merge-hover-highlight");
    });
    hideTileTooltip();
}

function showTileTooltip(e, r, c, cell) {
    const tt = document.getElementById("tileTooltip");
    const I18n = window.I18n;
    if (!tt || !cell || !I18n || !window.state) return;

    const pos = `(${String.fromCharCode(65+c)}${r+1})`;
    const isHQVic = window.state.isHQVicinity(r, c);

    if (cell.isHQ) {
        tt.innerHTML = `<strong>${I18n.t("TOOLTIP_HQ_TITLE", { pos })}</strong><br>${I18n.t("TOOLTIP_HQ_DESC")}`;
    } else if (cell.placed && cell.terrain) {
        const tName = I18n.t(cell.terrain.nameKey);
        const sName = cell.socketResource ? I18n.t(cell.socketResource.nameKey) : "";
        const mergeText = cell.merged ? `<br><span style="color:#f1c40f;font-weight:bold;">${I18n.t("UI_MERGE_2X2_LABEL", { name: tName })}</span>` : "";
        const socketText = cell.socketResource ? `<br><span style="color:#f1c40f;font-weight:bold;">★ ${sName} (${I18n.t("UI_SOCKET_BLOOMING")})</span>` : (cell.hasSocket ? `<br><span style="color:#f39c12;font-weight:bold;">${I18n.t("UI_UNOPENED_SOCKET_LABEL")}</span>` : "");
        const searchText = cell.searched ? `<br><span style="color:#2ecc71;">${I18n.t("UI_SEARCHED_BADGE")}</span>` : (cell.merged ? `<br><span style="color:#7f8c8d;">${I18n.t("UI_MERGED_SEARCH_DISABLED")}</span>` : "");
        tt.innerHTML = `<strong>${tName} ${pos}</strong>${mergeText}<br>🛡️${cell.terrain.defense} | 🌾+${cell.terrain.food||0} 🧱+${cell.terrain.wood||0}${isHQVic?' (+1)':''}${socketText}${searchText}`;
    } else if (cell.hasSocket) {
        tt.innerHTML = `<strong>${I18n.t("TOOLTIP_SOCKET_UNOPENED", { pos })}</strong>`;
    } else {
        tt.innerHTML = `<strong>${I18n.t("TOOLTIP_UNPLACED", { pos })}</strong>${isHQVic?`<br><small style="color:#1abc9c;">${I18n.t("TOOLTIP_HQ_VICINITY_BUFF")}</small>`:''}`;
    }

    tt.style.left = (e.clientX + 15) + "px";
    tt.style.top = (e.clientY + 15) + "px";
    tt.style.display = "block";
}

function hideTileTooltip() {
    const tt = document.getElementById("tileTooltip");
    if (tt) tt.style.display = "none";
}

function showDataPanelTooltip(e) {
    let tt = document.getElementById("dataPanelTooltipHuge");
    if (!tt) {
        tt = document.createElement("div");
        tt.id = "dataPanelTooltipHuge";
        tt.className = "large-directive-tooltip";
        document.body.appendChild(tt);
    }

    // 旧小型ツールチップを非表示化
    const oldTt = document.getElementById("dataPanelTooltip");
    if (oldTt) oldTt.style.display = "none";

    const state = window.state;
    const foodVal = state ? state.food : 30;
    const foodProd = state ? state.foodProduction : 10;
    const woodVal = state ? state.wood : 30;
    const woodProd = state ? state.woodProduction : 10;
    const defVal = state ? state.defense : 10;
    const mysticVal = state ? state.mystic : 0;
    const mysticProd = state ? state.mysticProduction : 1;

    tt.innerHTML = `
        <div style="font-size:20px; font-weight:900; color:#1abc9c; margin-bottom:12px; border-bottom:1.5px solid #2a2e3d; padding-bottom:8px; display:flex; align-items:center; gap:8px;">
            <span>📊</span> 各資源・産出データブレイクダウン
        </div>

        <div style="background:rgba(24, 34, 50, 0.7); border:1px solid #2c3e50; border-radius:8px; padding:12px 14px; margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:16.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between;">
                <span>🌾 食料 (Food)</span>
                <span style="color:#2ecc71;">${foodVal} (+${foodProd}/T)</span>
            </div>
            <div style="font-size:14.5px; color:#a4b0be; display:flex; justify-content:space-between; padding-left:10px;">
                <span>・ 本営基礎産出</span>
                <span style="color:#2ecc71; font-weight:bold;">+10 / ターン</span>
            </div>
            <div style="font-size:14.5px; color:#a4b0be; display:flex; justify-content:space-between; padding-left:10px;">
                <span>・ 土地・施設算定</span>
                <span style="color:#2ecc71; font-weight:bold;">+0 / ターン</span>
            </div>
        </div>

        <div style="background:rgba(24, 34, 50, 0.7); border:1px solid #2c3e50; border-radius:8px; padding:12px 14px; margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:16.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between;">
                <span>🧱 資材 (Wood)</span>
                <span style="color:#2ecc71;">${woodVal} (+${woodProd}/T)</span>
            </div>
            <div style="font-size:14.5px; color:#a4b0be; display:flex; justify-content:space-between; padding-left:10px;">
                <span>・ 本営基礎産出</span>
                <span style="color:#2ecc71; font-weight:bold;">+10 / ターン</span>
            </div>
        </div>

        <div style="background:rgba(24, 34, 50, 0.7); border:1px solid #2c3e50; border-radius:8px; padding:12px 14px; margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:16.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between;">
                <span>🛡️ 防衛 (Defense)</span>
                <span style="color:#ffffff;">${defVal}</span>
            </div>
            <div style="font-size:14.5px; color:#a4b0be; display:flex; justify-content:space-between; padding-left:10px;">
                <span>・ 本営初期防衛力</span>
                <span style="color:#ffffff;">10</span>
            </div>
        </div>

        <div style="background:rgba(24, 34, 50, 0.7); border:1px solid #2c3e50; border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:16.5px; font-weight:900; color:#ffffff; display:flex; justify-content:space-between;">
                <span>✨ 神秘 (Mystic)</span>
                <span style="color:#2ecc71;">${mysticVal} (+${mysticProd}/T)</span>
            </div>
            <div style="font-size:14.5px; color:#a4b0be; display:flex; justify-content:space-between; padding-left:10px;">
                <span>・ 本営基礎神秘力</span>
                <span style="color:#2ecc71; font-weight:bold;">+1 / ターン</span>
            </div>
        </div>
    `;

    const rect = e.currentTarget.getBoundingClientRect();
    tt.style.position = "fixed";
    tt.style.top = `${rect.bottom + 8}px`;
    tt.style.right = `${window.innerWidth - rect.right}px`;
    tt.style.display = "block";
}

function hideDataPanelTooltip() {
    const tt = document.getElementById("dataPanelTooltipHuge");
    if (tt) tt.style.display = "none";
}

window.showDataPanelTooltip = showDataPanelTooltip;
window.hideDataPanelTooltip = hideDataPanelTooltip;
