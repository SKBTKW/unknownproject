import { boardCameraSystem } from './board_camera_system.js';

/**
 * 🗺️ BoardGridComponent (盤面グリッド ＆ セル描画・配置プレビュー・マージ演出専門コンポーネント)
 * 
 * 責務:
 * 1. 5×5 / 7×7 / 9×9 盤面ヘッダー（A-E, 1-5）およびセル要素の構築・レンダリング
 * 2. 各セル（本部HQ、配置済み地形、マージ結合、ソケット★、Undoバッジ）のスタイル描画
 * 3. 🖱️ セルホバー時の配置プレビューおよび配置可能マスハイライト
 * 4. 🎯 盤面へのコマンドカードドロップ受け入れ（上フリック / 盤面ドロップ発動）
 */
export class BoardGridComponent {
    constructor(uiController) {
        this.ui = uiController;
    }

    get state() {
        return this.ui.state;
    }

    get engine() {
        return this.ui.engine;
    }

    /**
     * 🗺️ 盤面グリッド全体のレンダリング
     * @param {Object} I18n 多言語辞書オブジェクト
     */
    render(I18n) {
        const boardEl = document.getElementById("gridBoard");
        if (!boardEl || !this.state || !this.state.grid) return;
        boardEl.innerHTML = "";

        // 🏷️ 左上角: 表示モード切替ボタン
        const cornerCell = document.createElement("div");
        cornerCell.className = "header-cell corner-toggle-cell";
        cornerCell.style.display = "flex";
        cornerCell.style.alignItems = "center";
        cornerCell.style.justifyContent = "center";

        const currentMode = (typeof window !== "undefined" && window.currentBoardMode) || 'hover';
        let modeIcon = "🏷️";
        if (currentMode === 'icon') modeIcon = "🌾";
        else if (currentMode === 'always') modeIcon = "👁️";

        cornerCell.innerHTML = `<button onclick="toggleBoardLabelMode(event)" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:4px; padding:2px 4px; font-size:12px; cursor:pointer;" data-tooltip="TOOLTIP_BOARD_LABEL_TOGGLE">${modeIcon}</button>`;
        boardEl.appendChild(cornerCell);

        const size = this.state.grid.length;
        const cellSize = (size >= 9) ? '70px' : '80px';
        const headerSize = (size >= 9) ? '35px' : '40px';

        boardEl.style.gridTemplateColumns = `${headerSize} repeat(${size}, ${cellSize})`;
        boardEl.style.gridTemplateRows = `${headerSize} repeat(${size}, ${cellSize})`;
        boardEl.style.setProperty('--board-size', size);
        boardEl.style.setProperty('--cell-size', cellSize);
        boardEl.style.setProperty('--header-size', headerSize);

        // 🔤 横ヘッダー (A, B, C, D, E...)
        for (let c = 0; c < size; c++) {
            const hCell = document.createElement("div");
            hCell.className = "header-cell";
            hCell.innerText = String.fromCharCode(65 + c);
            boardEl.appendChild(hCell);
        }

        // 🔢 縦ヘッダー (1-5...) ＆ 各マス目セル
        for (let r = 0; r < size; r++) {
            const vCell = document.createElement("div");
            vCell.className = "header-cell";
            vCell.innerText = r + 1;
            boardEl.appendChild(vCell);

            for (let c = 0; c < size; c++) {
                const cellData = this.state.grid[r][c];
                const cellEl = document.createElement("div");
                cellEl.className = "cell";
                cellEl.setAttribute("data-r", r);
                cellEl.setAttribute("data-c", c);

                const isHQVic = (typeof this.state.isHQVicinity === "function") ? this.state.isHQVicinity(r, c) : false;

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
                            if (tid.includes("PLAINS")) cellEl.classList.add("merged-plains");
                            else if (tid.includes("DEEP_FOREST") || tid.includes("DEEP_HILL")) cellEl.classList.add("merged-deep-forest");
                            else if (tid.includes("FOREST")) cellEl.classList.add("merged-forest");
                            else if (tid.includes("HILL")) cellEl.classList.add("merged-hill");
                            else if (tid.includes("MOUNTAIN")) cellEl.classList.add("merged-mountain");
                            else if (tid.includes("DESERT")) cellEl.classList.add("merged-desert");

                            cellEl.style.borderColor = "rgba(241, 196, 15, 0.4)";
                            cellEl.style.borderStyle = "dashed";
                        } else if (placeId) {
                            const topSame = (r > 0 && this.state.grid[r-1][c].placementGroupId === placeId);
                            const rightSame = (c < size - 1 && this.state.grid[r][c+1].placementGroupId === placeId);
                            const bottomSame = (r < size - 1 && this.state.grid[r+1][c].placementGroupId === placeId);
                            const leftSame = (c > 0 && this.state.grid[r][c-1].placementGroupId === placeId);

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

                        const topGroupSame = (r > 0 && (this.state.grid[r-1][c].mergeGroupId === activeGroupId || this.state.grid[r-1][c].placementGroupId === activeGroupId));
                        const leftGroupSame = (c > 0 && (this.state.grid[r][c-1].mergeGroupId === activeGroupId || this.state.grid[r][c-1].placementGroupId === activeGroupId));

                        if (!topGroupSame && !leftGroupSame) {
                            const socketText = cellData.socketResource ? `<br><small style="color:#f1c40f;">★${I18n.t(cellData.socketResource.nameKey)}</small>` : "";
                            if (cellData.merged) {
                                let mergeLabel = I18n.t("UI_MERGE_2X2_LABEL", { name: tName });
                                if (cellData.mergeType === "L_SHAPE") mergeLabel = `🟨 ${tName} (L字)`;
                                else if (cellData.mergeType === "T_SHAPE") mergeLabel = `🛡️ ${tName} (凸字)`;
                                cellEl.innerHTML = `<span style="font-size:12px; color:#f1c40f; font-weight:bold; white-space:nowrap; z-index:5; text-shadow:0 0 6px rgba(0,0,0,0.9);">${mergeLabel}${socketText}</span>`;
                            } else {
                                const hasRight = (c < 4 && this.state.grid[r][c+1].placementGroupId === placeId);
                                const hasBottom = (r < 4 && this.state.grid[r+1][c].placementGroupId === placeId);
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
                    }
                }

                // ↩️ 当ターン配置マスの場合: キャンセルガイドバッジ (Undo Badge) を付与
                const undoSys = this.ui.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
                if (undoSys && typeof undoSys.isCellPlacedThisTurn === "function" && undoSys.isCellPlacedThisTurn(r, c)) {
                    cellEl.classList.add("cell-placed-this-turn");
                    const undoBadge = document.createElement("div");
                    undoBadge.className = "undo-badge";
                    undoBadge.title = "↩ クリックで配置を取り消す";
                    undoBadge.innerHTML = "↩";
                    cellEl.appendChild(undoBadge);
                }

                // 🖱️ セルイベントハンドラー
                cellEl.onmouseenter = (e) => this.ui.onCellMouseEnter(e, r, c);
                cellEl.onmousemove = (e) => this.ui.onCellMouseMove(e, r, c);
                cellEl.onmouseleave = () => this.ui.clearCellPreviews();
                cellEl.onclick = () => this.ui.onCellClick(r, c);
                cellEl.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (this.ui.selectedCard) {
                        const activeIdx = this.ui.selectedCardIdx !== -1 ? this.ui.selectedCardIdx : 0;
                        this.ui.rotateSelectedCard(e, activeIdx);
                    }
                };

                boardEl.appendChild(cellEl);
            }
        }

        // 🎯 盤面エリアへのドラッグオーバー ＆ コマンドカードドロップ受付
        boardEl.ondragover = (e) => {
            if (this.state.hasPickedThisTurn) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        };
        boardEl.ondrop = (e) => {
            if (this.state.hasPickedThisTurn) return;
            e.preventDefault();
            const cat = e.dataTransfer.getData("application/card-category");
            const rawIdx = e.dataTransfer.getData("text/plain");
            if (cat !== "LAND") {
                if (rawIdx === "reserve_0") {
                    const resCard = this.state.reserveSlots ? this.state.reserveSlots[0] : null;
                    if (resCard) this.ui.triggerCommandCardPlay(resCard, -1, 0);
                } else {
                    const droppedIdx = parseInt(rawIdx, 10);
                    if (!isNaN(droppedIdx) && droppedIdx >= 0 && droppedIdx < this.state.handOffering.length) {
                        const cCard = this.state.handOffering[droppedIdx];
                        if (cCard) this.ui.triggerCommandCardPlay(cCard, droppedIdx, -1);
                    }
                }
            }
        };

        if (this.ui.selectedCard) {
            this.ui.highlightPlaceableCells();
        }

        // 🏷️ 土地グリッド描画完了後、バッジが親アンカーに存在することを保証
        const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) ? TerritoryBadgeComponent : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);
        if (badgeComp) {
            if (!document.getElementById("mainTerritoryBadge") && typeof badgeComp.mount === "function") {
                badgeComp.mount();
            }
            if (typeof badgeComp.update === "function") {
                const placedCount = (typeof this.state.countPlacedTiles === "function") ? this.state.countPlacedTiles() : 1;
                badgeComp.update(placedCount, this.state.stage ? this.state.stage.maxTiles : 24, this.state.stage ? this.state.stage.id : 1);
            }
        }

        // 📷 盤面カメラ連携
        if (typeof boardCameraSystem !== "undefined" && boardCameraSystem && typeof boardCameraSystem.init === "function") {
            boardCameraSystem.init();
        }
    }
}
