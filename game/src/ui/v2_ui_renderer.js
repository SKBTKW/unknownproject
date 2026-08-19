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

function renderGridBoard(boardEl, state, callbacks) {
    if (!boardEl || !state) return;
    const I18n = window.I18n || { t: k => k };
    boardEl.innerHTML = "";

    const cornerCell = document.createElement("div");
    cornerCell.className = "header-cell corner-toggle-cell";
    cornerCell.style.display = "flex";
    cornerCell.style.alignItems = "center";
    cornerCell.style.justifyContent = "center";

    const currentMode = window.currentBoardMode || 'hover';
    let modeIcon = "🏷️";
    if (currentMode === 'icon') modeIcon = "🌾";
    else if (currentMode === 'always') modeIcon = "👁️";

    cornerCell.title = "土地表示モード切替";
    cornerCell.innerHTML = `<button onclick="toggleBoardLabelMode(event)" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:4px; padding:2px 4px; font-size:12px; cursor:pointer;" title="土地表示モード切替">${modeIcon}</button>`;
    boardEl.appendChild(cornerCell);

    for (let c = 0; c < 5; c++) {
        const hCell = document.createElement("div");
        hCell.className = "header-cell";
        hCell.innerText = String.fromCharCode(65 + c);
        boardEl.appendChild(hCell);
    }

    for (let r = 0; r < 5; r++) {
        const vCell = document.createElement("div");
        vCell.className = "header-cell";
        vCell.innerText = r + 1;
        boardEl.appendChild(vCell);

        for (let c = 0; c < 5; c++) {
            const cellData = state.grid[r][c];
            const cellEl = document.createElement("div");
            cellEl.className = "cell";
            cellEl.setAttribute("data-r", r);
            cellEl.setAttribute("data-c", c);

            const isHQVic = state.isHQVicinity(r, c);

            if (cellData.isHQ) {
                cellEl.classList.add("hq");
                cellEl.innerHTML = I18n.t("TERRAIN_HQ");
            } else if (cellData.placed && cellData.terrain) {
                cellEl.classList.add("placed");

                const tid = cellData.terrain ? (cellData.terrain.terrainId || cellData.terrain.id || "") : "";
                if (tid.includes("PLAINS")) cellEl.classList.add("terrain-plains");
                else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) cellEl.classList.add("terrain-deep-forest");
                else if (tid.includes("FOREST")) cellEl.classList.add("terrain-forest");
                else if (tid.includes("HILL")) cellEl.classList.add("terrain-hill");
                else if (tid.includes("MOUNTAIN")) cellEl.classList.add("terrain-mountain");
                else if (tid.includes("DESERT")) cellEl.classList.add("terrain-desert");

                const tName = I18n.t(cellData.terrain.nameKey);
                const mergeId = cellData.mergeGroupId;
                const placeId = cellData.placementGroupId;
                const activeGroupId = mergeId || placeId;

                if (activeGroupId) {
                    cellEl.setAttribute("data-group-id", activeGroupId);
                    if (cellData.merged) {
                        cellEl.classList.add("merged");
                        const tid = cellData.terrain ? (cellData.terrain.terrainId || cellData.terrain.id) : "";
                        if (tid.includes("PLAINS")) cellEl.classList.add("merged-plains");
                        else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) cellEl.classList.add("merged-deep-forest");
                        else if (tid.includes("FOREST")) cellEl.classList.add("merged-forest");
                        else if (tid.includes("HILL")) cellEl.classList.add("merged-hill");
                        else if (tid.includes("MOUNTAIN")) cellEl.classList.add("merged-mountain");
                        else if (tid.includes("DESERT")) cellEl.classList.add("merged-desert");

                        cellEl.style.borderColor = "rgba(241, 196, 15, 0.4)";
                        cellEl.style.borderStyle = "dashed";
                    } else if (placeId) {
                        const topSame = (r > 0 && state.grid[r-1][c].placementGroupId === placeId);
                        const rightSame = (c < 4 && state.grid[r][c+1].placementGroupId === placeId);
                        const bottomSame = (r < 4 && state.grid[r+1][c].placementGroupId === placeId);
                        const leftSame = (c > 0 && state.grid[r][c-1].placementGroupId === placeId);

                        if (topSame) {
                            cellEl.classList.add("no-border-top", "no-radius-tl", "no-radius-tr");
                            cellEl.style.setProperty("border-top", "none", "important");
                            cellEl.style.marginTop = "-4px";
                            cellEl.style.height = "calc(100% + 4px)";
                        }
                        if (rightSame) {
                            cellEl.classList.add("no-border-right", "no-radius-tr", "no-radius-br");
                            cellEl.style.setProperty("border-right", "none", "important");
                            cellEl.style.width = "calc(100% + 4px)";
                            cellEl.style.zIndex = "2";
                        }
                        if (bottomSame) {
                            cellEl.classList.add("no-border-bottom", "no-radius-bl", "no-radius-br");
                            cellEl.style.setProperty("border-bottom", "none", "important");
                            cellEl.style.height = "calc(100% + 4px)";
                            cellEl.style.zIndex = "2";
                        }
                        if (leftSame) {
                            cellEl.classList.add("no-border-left", "no-radius-tl", "no-radius-bl");
                            cellEl.style.setProperty("border-left", "none", "important");
                            cellEl.style.marginLeft = "-4px";
                            cellEl.style.width = "calc(100% + 4px)";
                        }
                    }

                    const topGroupSame = (r > 0 && (state.grid[r-1][c].mergeGroupId === activeGroupId || state.grid[r-1][c].placementGroupId === activeGroupId));
                    const leftGroupSame = (c > 0 && (state.grid[r][c-1].mergeGroupId === activeGroupId || state.grid[r][c-1].placementGroupId === activeGroupId));

                    if (!topGroupSame && !leftGroupSame) {
                        const socketText = cellData.socketResource ? `<br><small style="color:#f1c40f;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                        if (cellData.merged && cellData.mergeType === "2x2") {
                            cellEl.innerHTML = `<span style="font-size:12px; color:#f1c40f; font-weight:bold; white-space:nowrap; z-index:5; text-shadow:0 0 6px rgba(0,0,0,0.9);">${I18n.t("UI_MERGE_2X2_LABEL", { name: tName })}${socketText}</span>`;
                        } else {
                            const hasRight = (c < 4 && state.grid[r][c+1].placementGroupId === placeId);
                            const hasBottom = (r < 4 && state.grid[r+1][c].placementGroupId === placeId);
                            let spanStyle = "font-size:13px; color:#fff; font-weight:bold; z-index:5; text-shadow:0 2px 4px rgba(0,0,0,0.8); pointer-events:none;";
                            if (hasRight && !hasBottom) {
                                spanStyle += " position:absolute; left:0; width:200%; text-align:center;";
                            } else if (hasBottom && !hasRight) {
                                spanStyle += " position:absolute; top:0; left:0; width:100%; height:200%; display:flex; align-items:center; justify-content:center;";
                            }
                            cellEl.innerHTML = `<span style="${spanStyle}">${tName}${socketText}</span>`;
                        }
                    } else {
                        const socketBadge = cellData.socketResource ? `<small style="color:#f1c40f; font-size:10px;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                        cellEl.innerHTML = socketBadge;
                    }
                } else {
                    const socketBadge = cellData.socketResource ? `<br><small style="color:#f1c40f; font-size:10px;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                    const searchedBadge = cellData.searched ? `<span class="searched-badge">${I18n.t("UI_SEARCHED_BADGE")}</span>` : "";
                    cellEl.innerHTML = `${tName}${socketBadge}${searchedBadge}`;
                }
            } else if (cellData.hasSocket) {
                cellEl.classList.add("socket-unopened");
                if (isHQVic) cellEl.classList.add("hq-vicinity-unplaced");
                cellEl.innerHTML = `<span style="color:#f39c12;font-size:22px;filter:drop-shadow(0 0 4px #f39c12);">★</span>`;
            } else {
                if (isHQVic) {
                    cellEl.classList.add("hq-vicinity-unplaced");
                    cellEl.innerHTML = `<span style="font-size:12px; color:#1abc9c; opacity:0.8;">✨+1</span>`;
                }
            }

            if (callbacks) {
                if (callbacks.onmouseenter) cellEl.onmouseenter = (e) => callbacks.onmouseenter(e, r, c);
                if (callbacks.onmousemove) cellEl.onmousemove = (e) => callbacks.onmousemove(e, r, c);
                if (callbacks.onmouseleave) cellEl.onmouseleave = callbacks.onmouseleave;
                if (callbacks.onclick) cellEl.onclick = () => callbacks.onclick(r, c);
                if (callbacks.oncontextmenu) cellEl.oncontextmenu = (e) => callbacks.oncontextmenu(e, r, c);
            }
            boardEl.appendChild(cellEl);
        }
    }
}

window.V2UIRenderer = {
    setElementText,
    initStaticI18nLabels,
    renderGridBoard
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
