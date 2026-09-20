/* =============================================================
   game/src/presentation/land_card_presentation.js
   LAND card presentation helpers.
   Multi-Attribute blocks keep block identity at card level while rendering
   each active shape cell with its own terrain color.
   ============================================================= */

function getLandCardDefinition(card) {
    return card?.terrain || card || null;
}

function getLandCardAttributeCells(card) {
    const definition = getLandCardDefinition(card);
    const source = card?.currentCells || definition?.currentCells || definition?.cells;
    return Array.isArray(source) && source.length > 0 ? source : null;
}

function isMultiAttributeLandCard(card) {
    const definition = getLandCardDefinition(card);
    return Boolean(
        definition
        && (definition.category || "LAND") === "LAND"
        && getLandCardAttributeCells(card)
    );
}

function getAttributeCellCoordinates(cell) {
    if (!cell || typeof cell !== "object") return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.dr;
    const c = Number.isInteger(cell.c) ? cell.c : cell.dc;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { r, c };
}

function getAttributeTerrainId(cell) {
    return cell?.terrain?.terrainId
        || cell?.terrain?.id
        || cell?.terrainId
        || cell?.id
        || null;
}

function getAttributeNameKey(cell) {
    return cell?.terrain?.nameKey || cell?.nameKey || null;
}

function resolveRepresentativeAttributeCell(card) {
    const definition = getLandCardDefinition(card);
    const cells = getLandCardAttributeCells(card);
    if (!definition || !cells) return null;

    const representativeTerrainId = definition.representativeTerrainId || null;
    if (representativeTerrainId) {
        const explicit = cells.find(cell => getAttributeTerrainId(cell) === representativeTerrainId);
        if (explicit) return explicit;
    }

    const shape = card?.currentShape || definition.shape || [[1]];
    const anchor = card?.currentAnchor || definition.anchor || { r: 0, c: 0 };
    const anchorCell = cells.find(cell => {
        const coords = getAttributeCellCoordinates(cell);
        return coords && coords.r === anchor.r && coords.c === anchor.c;
    });
    if (anchorCell) return anchorCell;

    return cells[0] || null;
}

function resolveLandCardDisplayName(card, I18n) {
    const definition = getLandCardDefinition(card);
    if (!definition) return "Card";

    if (!isMultiAttributeLandCard(card)) {
        return definition.nameKey
            ? I18n.t(definition.nameKey)
            : (definition.name || definition.id || "Card");
    }

    const representative = resolveRepresentativeAttributeCell(card);
    const representativeNameKey = getAttributeNameKey(representative) || definition.nameKey || null;
    const baseName = representativeNameKey
        ? I18n.t(representativeNameKey)
        : (definition.name || definition.representativeTerrainId || definition.id || "Card");
    const suffixKey = "CARD_MULTI_ATTRIBUTE_SUFFIX";
    const translatedSuffix = I18n.t(suffixKey);
    const suffix = translatedSuffix && translatedSuffix !== suffixKey
        ? translatedSuffix
        : "（複数）";
    return `${baseName}${suffix}`;
}

function resolveLandCardCellTerrainId(card, r, c) {
    const definition = getLandCardDefinition(card);
    const cells = getLandCardAttributeCells(card);
    if (cells) {
        const matched = cells.find(cell => {
            const coords = getAttributeCellCoordinates(cell);
            return coords && coords.r === r && coords.c === c;
        });
        const matchedTerrainId = getAttributeTerrainId(matched);
        if (matchedTerrainId) return matchedTerrainId;
    }
    return definition?.terrainId || definition?.id || "";
}

function resolveLandCardRarity(card) {
    const definition = getLandCardDefinition(card);
    if (isMultiAttributeLandCard(card)) return "R";
    return definition?.rarity || "C";
}

export {
    getLandCardAttributeCells,
    getLandCardDefinition,
    isMultiAttributeLandCard,
    resolveLandCardCellTerrainId,
    resolveLandCardDisplayName,
    resolveLandCardRarity,
    resolveRepresentativeAttributeCell
};
