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
        const cellSize = (size >= 9) ? '80px' : '104px'; // 🛡️ 隙間がなくなる直前までマス目を拡大 (104px)
        const headerSize = (size >= 9) ? '38px' : '44px';

        boardEl.style.gridTemplateColumns = `${headerSize} repeat(${size}, ${cellSize})`;
        boardEl.style.gridTemplateRows = `${headerSize} repeat(${size}, ${cellSize}) ${headerSize}`;
        boardEl.style.setProperty('--board-size', size);
        boardEl.style.setProperty('--cell-size', cellSize);
        boardEl.style.setProperty('--header-size', headerSize);

        // 🌊 開花した清湖・オアシスの座標リストを事前収集 (周囲8マスのティール水脈エフェクト用)
        const lakeCoords = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.state.grid[r][c];
                if (cell && cell.placed && cell.socketResource) {
                    const sid = cell.socketResource.id || cell.socketResource.nameKey || "";
                    if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                        lakeCoords.push({ r, c });
                    }
                }
            }
        }

        // 🔤 横ヘッダー (A, B, C, D, E...)
        for (let c = 0; c < size; c++) {
            const hCell = document.createElement("div");
            hCell.className = "header-cell";
            hCell.innerText = String.fromCharCode(65 + c);
            hCell.setAttribute("data-tooltip", "TOOLTIP_BOARD_CAMERA_BODY");
            hCell.setAttribute("data-tooltip-title", "TOOLTIP_BOARD_CAMERA_TITLE");
            boardEl.appendChild(hCell);
        }

        // 🔢 縦ヘッダー (1-5...) ＆ 各マス目セル
        for (let r = 0; r < size; r++) {
            const vCell = document.createElement("div");
            vCell.className = "header-cell";
            vCell.innerText = r + 1;
            vCell.setAttribute("data-tooltip", "TOOLTIP_BOARD_CAMERA_BODY");
            vCell.setAttribute("data-tooltip-title", "TOOLTIP_BOARD_CAMERA_TITLE");
            boardEl.appendChild(vCell);

            for (let c = 0; c < size; c++) {
                const cellData = this.state.grid[r][c];
                const cellEl = document.createElement("div");
                cellEl.className = "cell";
                cellEl.setAttribute("data-r", r);
                cellEl.setAttribute("data-c", c);

                const isHQVic = (typeof this.state.isHQVicinity === "function") ? this.state.isHQVicinity(r, c) : false;
                const lakeDirClass = this.getLakeDirectionClass(r, c, lakeCoords);
                const isLakeVic = !!lakeDirClass;

                let topGroupSame = false;
                let leftGroupSame = false;

                if (cellData.isHQ) {
                    if (this.ui && this.ui.hqComponent && typeof this.ui.hqComponent.renderCell === "function") {
                        this.ui.hqComponent.renderCell(cellEl, this.state, I18n);
                    } else {
                        cellEl.id = "hqEmberCellAnchor";
                        cellEl.classList.add("hq");
                        cellEl.innerHTML = `<img src="assets/campfire_background.png" class="hq-bg-img" alt="${I18n.t("TERRAIN_HQ")}" /><div class="hq-campfire-sprite"></div><span id="hqEmberValBadge" class="hq-ember-val-badge">${this.state.ember}</span>`;
                    }
                } else if (cellData.placed && cellData.terrain) {
                    cellEl.classList.add("placed");

                    const tid = cellData.terrain ? (cellData.terrain.terrainId || cellData.terrain.id || "") : "";
                    if (tid.includes("WETLAND")) cellEl.classList.add("terrain-wetland");
                    else if (tid.includes("PLAINS")) cellEl.classList.add("terrain-plains");
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
                        }

                        // 🚫 内側境界線の完全打消し（マージ大土地・複数マスブロックの完全単一化）
                        const topSame = (r > 0 && (this.state.grid[r-1][c].mergeGroupId === activeGroupId || this.state.grid[r-1][c].placementGroupId === activeGroupId));
                        const rightSame = (c < size - 1 && (this.state.grid[r][c+1].mergeGroupId === activeGroupId || this.state.grid[r][c+1].placementGroupId === activeGroupId));
                        const bottomSame = (r < size - 1 && (this.state.grid[r+1][c].mergeGroupId === activeGroupId || this.state.grid[r+1][c].placementGroupId === activeGroupId));
                        const leftSame = (c > 0 && (this.state.grid[r][c-1].mergeGroupId === activeGroupId || this.state.grid[r][c-1].placementGroupId === activeGroupId));

                        if (topSame) cellEl.classList.add("no-border-top", "no-radius-tl", "no-radius-tr");
                        if (rightSame) cellEl.classList.add("no-border-right", "no-radius-tr", "no-radius-br");
                        if (bottomSame) cellEl.classList.add("no-border-bottom", "no-radius-bl", "no-radius-br");
                        if (leftSame) cellEl.classList.add("no-border-left", "no-radius-tl", "no-radius-bl");

                        topGroupSame = (r > 0 && (this.state.grid[r-1][c].mergeGroupId === activeGroupId || this.state.grid[r-1][c].placementGroupId === activeGroupId));
                        leftGroupSame = (c > 0 && (this.state.grid[r][c-1].mergeGroupId === activeGroupId || this.state.grid[r][c-1].placementGroupId === activeGroupId));

                        const yieldInfo = this.getPrimaryYieldInfo(cellData, isHQVic);
                        if (yieldInfo && yieldInfo.val > 0) cellEl.classList.add("has-resource-yield");

                        // 🎯 スマート役割判定（資源マス優先 ＆ 土地属性の空きマススライド配置）
                        const role = this.getGroupCellRole(r, c, activeGroupId, cellData);

                        if (role === "SOCKET") {
                            // 🌟 資源マス: 没入感最優先で「上段: 資源名」「下段: 最大産出」
                            const s = cellData.socketResource;
                            const sName = I18n.t(s.nameKey || "SOCKET_RESOURCE");
                            const sYield = this.getSocketPrimaryYieldInfo(s);
                            const sYieldHtml = sYield ? `<div class="tile-yield-line"><span class="yield-icon">${sYield.icon}</span><span class="yield-colon"> : </span><span class="yield-val">${sYield.val}</span></div>` : "";
                            cellEl.innerHTML = `<div class="tile-content-box"><div class="tile-title-line">${sName}</div>${sYieldHtml}</div>`;
                        } else if (role === "LAND_PRIMARY") {
                            // 🌟 土地名 ＆ 総産出（最初の空きマスへスマート配置）
                            const yieldHtml = yieldInfo ? `<div class="tile-yield-line"><span class="yield-icon">${yieldInfo.icon}</span><span class="yield-colon"> : </span><span class="yield-val">${yieldInfo.val}</span></div>` : "";
                            cellEl.innerHTML = `<div class="tile-content-box"><div class="tile-title-line">${tName}</div>${yieldHtml}</div>`;
                        } else {
                            // 🌟 後続のクリーン背景
                            cellEl.innerHTML = "";
                        }
                    } else {
                        const yieldInfo = this.getPrimaryYieldInfo(cellData, isHQVic);
                        if (yieldInfo && yieldInfo.val > 0) cellEl.classList.add("has-resource-yield");

                        const yieldHtml = yieldInfo ? `<div class="tile-yield-line"><span class="yield-icon">${yieldInfo.icon}</span><span class="yield-colon"> : </span><span class="yield-val">${yieldInfo.val}</span></div>` : "";
                        const searchedBadge = cellData.searched ? `<span class="searched-badge">${I18n.t("UI_SEARCHED_BADGE")}</span>` : "";
                        cellEl.innerHTML = `<div class="tile-content-box"><div class="tile-title-line">${tName}</div>${yieldHtml}${searchedBadge}</div>`;
                    }
                } else if (cellData.hasSocket) {
                    cellEl.classList.add("socket-unopened");
                    if (isHQVic) {
                        cellEl.classList.add("hq-vicinity-unplaced");
                        const dirClass = this.getHQDirectionClass(r, c);
                        if (dirClass) cellEl.classList.add(dirClass);
                    }
                    if (isLakeVic) {
                        cellEl.classList.add("lake-vicinity-unplaced");
                        cellEl.classList.add(lakeDirClass);
                    }
                    cellEl.innerHTML = `<span class="socket-star-icon">★</span>`;
                } else {
                    if (isHQVic) {
                        cellEl.classList.add("hq-vicinity-unplaced");
                        const dirClass = this.getHQDirectionClass(r, c);
                        if (dirClass) cellEl.classList.add(dirClass);
                    }
                    if (isLakeVic) {
                        cellEl.classList.add("lake-vicinity-unplaced");
                        cellEl.classList.add(lakeDirClass);
                    }
                }

                // ↩️ 当ターン配置マスの場合: キャンセルガイドバッジ (Undo Badge) を付与（先頭マスのみに1個表示）
                const undoSys = this.ui.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
                if (undoSys && typeof undoSys.isCellPlacedThisTurn === "function" && undoSys.isCellPlacedThisTurn(r, c)) {
                    cellEl.classList.add("cell-placed-this-turn");
                    const activeGroupId = cellData.mergeGroupId || cellData.placementGroupId;
                    const isHeadCell = !activeGroupId || (!topGroupSame && !leftGroupSame);
                    if (isHeadCell) {
                        const undoBadge = document.createElement("div");
                        undoBadge.className = "undo-badge";
                        undoBadge.title = I18n.t("UI_UNDO_BADGE_TOOLTIP") || "↩ Click to undo";
                        undoBadge.innerHTML = "↩";
                        cellEl.appendChild(undoBadge);
                    }
                }

                // 🖱️ セルイベントハンドラー
                cellEl.onmouseenter = (e) => this.ui.onCellMouseEnter(e, r, c);
                cellEl.onmousemove = (e) => this.ui.onCellMouseMove(e, r, c);
                cellEl.onmouseleave = () => this.ui.clearCellPreviews();
                cellEl.onclick = () => this.ui.onCellClick(r, c);
                cellEl.ondragover = (e) => {
                    if (this.state.hasPickedThisTurn) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    this.ui.onCellMouseEnter(e, r, c);
                };
                cellEl.ondrop = (e) => {
                    if (this.state.hasPickedThisTurn) return;
                    e.preventDefault();
                    const cat = e.dataTransfer.getData("application/card-category");
                    const rawIdx = e.dataTransfer.getData("text/plain");
                    if (cat === "LAND") {
                        const droppedIdx = parseInt(rawIdx, 10);
                        if (!isNaN(droppedIdx)) {
                            this.ui.selectCard(droppedIdx);
                            this.ui.onCellClick(r, c);
                        }
                    } else {
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
                cellEl.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (this.ui.selectedCard) {
                        const tObj = this.ui.selectedCard.terrain || this.ui.selectedCard;
                        const category = this.ui.selectedCard.category || tObj.category || "LAND";
                        if (category === "LAND") {
                            if (this.ui.selectedReserveIdx !== -1) {
                                this.ui.rotateReserveCard(e, this.ui.selectedReserveIdx);
                            } else if (this.ui.selectedCardIdx !== -1) {
                                this.ui.rotateSelectedCard(e, this.ui.selectedCardIdx);
                            }
                            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                                window.BlockPlacementSystem.updateHoverPreview(e, r, c, this.ui.selectedCard, this.state);
                            }
                        } else {
                            // 📜 コマンドカード選択時は、盤面上の右クリックで即座に選択解除（キャンセル）
                            this.ui.deselectCard();
                        }
                    }
                };

                boardEl.appendChild(cellEl);
            }
        }

        // 🏁 底部フッター行 (全幅結合セル: 左端に占領率バッジ ✕ 右端にTURN ENDボタン)
        const footerBar = document.createElement("div");
        footerBar.className = "header-cell footer-cell footer-bar-cell";
        footerBar.style.gridColumn = `1 / span ${size + 1}`;
        footerBar.setAttribute("data-tooltip", "TOOLTIP_BOARD_CAMERA_BODY");
        footerBar.setAttribute("data-tooltip-title", "TOOLTIP_BOARD_CAMERA_TITLE");

        // 左端スロット: 占領率バッジ
        const badgeSlot = document.createElement("div");
        badgeSlot.id = "territoryBadgeFooterSlot";
        badgeSlot.className = "footer-left-slot";
        footerBar.appendChild(badgeSlot);

        // 中央余白 (D&Dグラブ領域)
        const centerSpacer = document.createElement("div");
        centerSpacer.className = "footer-center-spacer";
        footerBar.appendChild(centerSpacer);

        // 右端スロット: ターンエンドボタン
        const turnEndSlot = document.createElement("div");
        turnEndSlot.className = "footer-right-slot";

        const btnTurnEnd = document.createElement("button");
        btnTurnEnd.className = "btn-turn-end footer-btn-turn-end";
        btnTurnEnd.id = "btnTurnEnd";
        btnTurnEnd.setAttribute("data-tooltip", "TOOLTIP_TURN_END");
        btnTurnEnd.innerHTML = `<span>TURN END</span> <span class="arrow-icon">➔</span>`;
        btnTurnEnd.onclick = () => {
            if (typeof window.nextTurn === "function") {
                window.nextTurn();
            } else if (this.ui && typeof this.ui.onTurnEndClick === "function") {
                this.ui.onTurnEndClick();
            }
        };
        turnEndSlot.appendChild(btnTurnEnd);
        footerBar.appendChild(turnEndSlot);

        boardEl.appendChild(footerBar);

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

        // 🏷️ 土地グリッド描画完了後、バッジを底部左端スロットにマウント
        const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) ? TerritoryBadgeComponent : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);
        if (badgeComp) {
            const badgeSlot = document.getElementById("territoryBadgeFooterSlot");
            if (badgeSlot && typeof badgeComp.mount === "function") {
                badgeComp.mount(badgeSlot);
            }
            if (typeof badgeComp.update === "function") {
                const placedCount = (typeof this.state.countPlacedTiles === "function") ? this.state.countPlacedTiles() : 1;
                badgeComp.update(placedCount, this.state);
            }
        }

        // 🔥 本営マス(C3)への残り火詳細ステータスコンポーネント連携
        const emberComp = (this.ui && this.ui.emberStatusComponent) ? this.ui.emberStatusComponent : (typeof window !== "undefined" && window.uiController ? window.uiController.emberStatusComponent : null);
        if (emberComp && typeof emberComp.bindToAnchor === "function") {
            const hqEl = document.getElementById("hqEmberCellAnchor") || document.querySelector(".cell.hq");
            if (hqEl) {
                emberComp.bindToAnchor(hqEl);
                emberComp.update(this.state);
            }
        }

        // 📷 盤面カメラ連携
        if (typeof boardCameraSystem !== "undefined" && boardCameraSystem && typeof boardCameraSystem.init === "function") {
            boardCameraSystem.init();
        }
    }

    /**
     * 🔥 C3マス（本営）での残り火増減フロートポップアップ演出 (HqComponent への委譲)
     * @param {number} delta - 残り火の増減差分 (+X または -X)
     */
    showHqEmberDeltaPopup(delta) {
        if (this.ui && this.ui.hqComponent && typeof this.ui.hqComponent.showDeltaPopup === "function") {
            this.ui.hqComponent.showDeltaPopup(delta);
        }
    }

    /**
     * 🌾 最大産出リソースの特定 ＆ 画像フォーマット用データ生成
     * （同率タイの場合は各土地の主軸優先: 平地=🌾, 森=🧱, 山岳/丘陵=🛡️, 砂漠/遺跡=✨）
     * （マージブロックの場合はブロック全体の総産出を集約）
     */
    getPrimaryYieldInfo(cellData, isHQVic) {
        if (!cellData || !cellData.terrain) return null;

        const t = cellData.terrain;
        const tid = (t.terrainId || t.id || "").toUpperCase();

        let f = 0, w = 0, d = 0, m = 0;

        const activeGroupId = cellData.mergeGroupId || cellData.placementGroupId;

        const isNearLake = (r, c) => {
            if (!this.state || !this.state.grid) return false;
            const size = this.state.grid.length;
            for (let lr = 0; lr < size; lr++) {
                for (let lc = 0; lc < size; lc++) {
                    const lcCell = this.state.grid[lr][lc];
                    if (lcCell && lcCell.placed && lcCell.socketResource) {
                        const sid = lcCell.socketResource.id || lcCell.socketResource.nameKey || "";
                        if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                            if (Math.abs(lr - r) <= 1 && Math.abs(lc - c) <= 1 && !(lr === r && lc === c)) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        };

        // 🧩 複数マスブロック（マージ大土地 または 1x2/1x3等の同一配置ブロック）の場合は土地総産出を集約
        if (activeGroupId && this.state && this.state.grid) {
            const isMerged = !!cellData.merged;
            let multiplier = 1.0;
            if (isMerged && this.state.mergedBlocks && this.state.mergedBlocks[cellData.mergeGroupId]) {
                multiplier = this.state.mergedBlocks[cellData.mergeGroupId].yieldMultiplier || 1.20;
            }

            const size = this.state.grid.length;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = this.state.grid[r][c];
                    if (cell && cell.placed && (cell.mergeGroupId === activeGroupId || cell.placementGroupId === activeGroupId) && cell.terrain) {
                        const ct = cell.terrain;
                        let cf = (ct.food !== undefined) ? ct.food : ((ct.baseYieldsPerTile && ct.baseYieldsPerTile.food) || (ct.yields && ct.yields.food) || 0);
                        let cw = (ct.material !== undefined) ? ct.material : ((ct.wood !== undefined) ? ct.wood : ((ct.baseYieldsPerTile && (ct.baseYieldsPerTile.material || ct.baseYieldsPerTile.wood)) || (ct.yields && (ct.yields.material || ct.yields.wood)) || 0));
                        let cd = (ct.defense !== undefined) ? ct.defense : ((ct.baseYieldsPerTile && ct.baseYieldsPerTile.defense) || (ct.yields && ct.yields.defense) || 0);
                        let cm = (ct.mystic !== undefined) ? ct.mystic : ((ct.baseYieldsPerTile && ct.baseYieldsPerTile.mystic) || (ct.yields && ct.yields.mystic) || 0);

                        // ⚠️ 資源ボーナスは資源マス（SOCKET）自体の表示に切り離すため、土地総産出には含めない（完全分離）

                        // 本営近郊加算
                        if (typeof this.state.isHQVicinity === "function" && this.state.isHQVicinity(r, c)) {
                            if (cf > 0) cf += 1;
                            if (cw > 0) cw += 1;
                            if (cd > 0) cd += 1;
                            if (cm > 0) cm += 1;
                        }

                        // 🌊 清湖 (Lake) 周囲8マスの灌漑バフ (+50% 食料産出ブースト)
                        if (isNearLake(r, c) && cf > 0) {
                            cf += Math.max(1, Math.floor(cf * 0.5));
                        }

                        if (this.state && this.state.permanentPlainsFoodBonus && (ct.terrainId || ct.id || "").toUpperCase().includes("PLAINS")) {
                            cf += this.state.permanentPlainsFoodBonus;
                        }

                        f += cf;
                        w += cw;
                        d += cd;
                        m += cm;
                    }
                }
            }

            f = Math.floor(f * multiplier);
            w = Math.floor(w * multiplier);
            d = Math.floor(d * multiplier);
            m = Math.floor(m * multiplier);
        } else {
            // 単マス（1x1 配置）
            f = (t.food !== undefined) ? t.food : ((t.baseYieldsPerTile && t.baseYieldsPerTile.food) || (t.yields && t.yields.food) || 0);
            w = (t.material !== undefined) ? t.material : ((t.wood !== undefined) ? t.wood : ((t.baseYieldsPerTile && (t.baseYieldsPerTile.material || t.baseYieldsPerTile.wood)) || (t.yields && (t.yields.material || t.yields.wood)) || 0));
            d = (t.defense !== undefined) ? t.defense : ((t.baseYieldsPerTile && t.baseYieldsPerTile.defense) || (t.yields && t.yields.defense) || 0);
            m = (t.mystic !== undefined) ? t.mystic : ((t.baseYieldsPerTile && t.baseYieldsPerTile.mystic) || (t.yields && t.yields.mystic) || 0);

            if (isHQVic) {
                if (f > 0) f += 1;
                if (w > 0) w += 1;
                if (d > 0) d += 1;
                if (m > 0) m += 1;
            }

            if (isNearLake(cellData.r !== undefined ? cellData.r : 0, cellData.c !== undefined ? cellData.c : 0) && f > 0) {
                f += Math.max(1, Math.floor(f * 0.5));
            }

            if (this.state && this.state.permanentPlainsFoodBonus && tid.includes("PLAINS")) {
                f += this.state.permanentPlainsFoodBonus;
            }
        }

        const maxVal = Math.max(f, w, d, m);
        if (maxVal <= 0) return null;

        // 🏆 同率タイ判定（案 1: 主軸プライオリティ）
        if (tid.includes("PLAINS")) {
            if (f === maxVal) return { icon: "🌾", val: f };
            if (w === maxVal) return { icon: "🧱", val: w };
            if (d === maxVal) return { icon: "🛡️", val: d };
            return { icon: "✨", val: m };
        } else if (tid.includes("FOREST") || tid.includes("DEEP_FOREST")) {
            if (w === maxVal) return { icon: "🧱", val: w };
            if (f === maxVal) return { icon: "🌾", val: f };
            if (d === maxVal) return { icon: "🛡️", val: d };
            return { icon: "✨", val: m };
        } else if (tid.includes("HILL") || tid.includes("MOUNTAIN")) {
            if (d === maxVal) return { icon: "🛡️", val: d };
            if (w === maxVal) return { icon: "🧱", val: w };
            if (f === maxVal) return { icon: "🌾", val: f };
            return { icon: "✨", val: m };
        } else {
            if (m === maxVal) return { icon: "✨", val: m };
            if (f === maxVal) return { icon: "🌾", val: f };
            if (w === maxVal) return { icon: "🧱", val: w };
            return { icon: "🛡️", val: d };
        }
    }

    /**
     * 💎 資源ソケット単体の最大産出リソース判定（画像フォーマット準拠）
     */
    getSocketPrimaryYieldInfo(socket) {
        if (!socket) return null;
        const f = socket.bonusFood || 0;
        const w = socket.bonusWood || socket.bonusMaterial || 0;
        const d = socket.bonusDefense || 0;
        const m = socket.bonusMystic || 0;

        const maxVal = Math.max(f, w, d, m);
        if (maxVal <= 0) return null;

        // 同率時は資源の特性（名前キーなど）や汎用優先順位で決定
        const sk = (socket.nameKey || socket.id || "").toUpperCase();
        if (sk.includes("MINE") || sk.includes("ORE") || sk.includes("IRON") || sk.includes("HIDDEN")) {
            if (w === maxVal) return { icon: "🧱", val: w };
            if (d === maxVal) return { icon: "🛡️", val: d };
            if (m === maxVal) return { icon: "✨", val: m };
            return { icon: "🌾", val: f };
        } else if (sk.includes("FORT") || sk.includes("PEAK") || sk.includes("GUARD")) {
            if (d === maxVal) return { icon: "🛡️", val: d };
            if (m === maxVal) return { icon: "✨", val: m };
            if (w === maxVal) return { icon: "🧱", val: w };
            return { icon: "🌾", val: f };
        } else if (sk.includes("LAKE") || sk.includes("WHEAT") || sk.includes("CLEAR") || sk.includes("WILD")) {
            if (f === maxVal) return { icon: "🌾", val: f };
            if (w === maxVal) return { icon: "🧱", val: w };
            if (d === maxVal) return { icon: "🛡️", val: d };
            return { icon: "✨", val: m };
        } else {
            if (m === maxVal) return { icon: "✨", val: m };
            if (w === maxVal) return { icon: "🧱", val: w };
            if (d === maxVal) return { icon: "🛡️", val: d };
            return { icon: "🌾", val: f };
        }
    }

    /**
     * 🧩 ブロック内における各セルの描画役割（Role）を判定（純粋な読み取り専用）
     * - "SOCKET": 資源ソケットマス ➔ 資源名 ＆ 資源産出を描画
     * - "LAND_PRIMARY": 土地名 ＆ 総産出を描画する代表マス（最初の空きマス、または先頭マス）
     * - "CLEAN": クリーンな背景（余計なテキストなし）
     */
    getGroupCellRole(r, c, activeGroupId, cellData) {
        if (!activeGroupId || !cellData) return "LAND_PRIMARY";

        // 1. そのセル自体に資源ソケットがある場合 ➔ 没入感最優先で資源マス表示
        if (cellData.socketResource) {
            return "SOCKET";
        }

        // 2. このグループに属する全マスを走査（左上から順）
        const size = (this.state && this.state.grid) ? this.state.grid.length : 5;
        const freeCells = [];
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const cell = this.state.grid[row][col];
                if (cell) {
                    const gId = cell.mergeGroupId || cell.placementGroupId;
                    if (gId === activeGroupId) {
                        if (!cell.socketResource) {
                            freeCells.push({ r: row, c: col });
                        }
                    }
                }
            }
        }

        // 3. 最初の空きマス（freeCells[0]）であれば、土地名＆総産出を描画
        if (freeCells.length > 0 && freeCells[0].r === r && freeCells[0].c === c) {
            return "LAND_PRIMARY";
        }

        // 4. それ以外の後続空きマスはクリーン背景
        return "CLEAN";
    }

    /**
     * 🧭 本営（HQ）から見た周囲8マスの相対方位クラスを取得
     * @param {number} r - 行
     * @param {number} c - 列
     * @returns {string} 方位クラス名 ("hq-dir-n", "hq-dir-ne", etc.)
     */
    getHQDirectionClass(r, c) {
        let hqR = 2;
        let hqC = 2;
        if (this.state && this.state.grid) {
            for (let row = 0; row < this.state.grid.length; row++) {
                for (let col = 0; col < this.state.grid[row].length; col++) {
                    if (this.state.grid[row][col] && this.state.grid[row][col].isHQ) {
                        hqR = row;
                        hqC = col;
                        break;
                    }
                }
            }
        }
        const dr = r - hqR;
        const dc = c - hqC;

        if (dr === -1 && dc === 0) return "hq-dir-n";
        if (dr === -1 && dc === 1) return "hq-dir-ne";
        if (dr === 0 && dc === 1) return "hq-dir-e";
        if (dr === 1 && dc === 1) return "hq-dir-se";
        if (dr === 1 && dc === 0) return "hq-dir-s";
        if (dr === 1 && dc === -1) return "hq-dir-sw";
        if (dr === 0 && dc === -1) return "hq-dir-w";
        if (dr === -1 && dc === -1) return "hq-dir-nw";
        return "";
    }

    /**
     * 🌊 湖(Lake)の中心からの8方位クラス名の算出
     * @param {number} r - 行
     * @param {number} c - 列
     * @param {Array<Object>} lakeCoords - 盤面上の湖座標リスト
     * @returns {string} 方位クラス名 ("lake-dir-n", "lake-dir-ne", etc.)
     */
    getLakeDirectionClass(r, c, lakeCoords) {
        if (!Array.isArray(lakeCoords) || lakeCoords.length === 0) return "";
        for (let lake of lakeCoords) {
            const dr = r - lake.r;
            const dc = c - lake.c;
            if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && !(dr === 0 && dc === 0)) {
                if (dr === -1 && dc === 0) return "lake-dir-n";
                if (dr === -1 && dc === 1) return "lake-dir-ne";
                if (dr === 0 && dc === 1) return "lake-dir-e";
                if (dr === 1 && dc === 1) return "lake-dir-se";
                if (dr === 1 && dc === 0) return "lake-dir-s";
                if (dr === 1 && dc === -1) return "lake-dir-sw";
                if (dr === 0 && dc === -1) return "lake-dir-w";
                if (dr === -1 && dc === -1) return "lake-dir-nw";
            }
        }
        return "";
    }
}
