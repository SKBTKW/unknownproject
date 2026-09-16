/* =============================================================
   game/src/data/card_database.js
   カードマスターデータ一元管理モジュール
   ============================================================= */

(function(window) {
    'use strict';

    const TERRAIN_DEFINITIONS = {
        PLAINS: {
            id: "PLAINS",
            terrainId: "PLAINS",
            nameKey: "TERRAIN_PLAINS",
            category: "LAND",
            rarity: "C",
            shape: [[1]],
            yields: { food: 4, wood: 0, defense: 0, mystic: 0 }
        },
        FOREST: {
            id: "FOREST",
            terrainId: "FOREST",
            nameKey: "TERRAIN_FOREST",
            category: "LAND",
            rarity: "C",
            shape: [[1]],
            yields: { food: 2, wood: 2, defense: 0, mystic: 0 }
        },
        HILL: {
            id: "HILL",
            terrainId: "HILL",
            nameKey: "TERRAIN_HILL",
            category: "LAND",
            rarity: "C",
            shape: [[1]],
            yields: { food: 2, wood: 1, defense: 1, mystic: 0 }
        },
        MOUNTAIN: {
            id: "MOUNTAIN",
            terrainId: "MOUNTAIN",
            nameKey: "TERRAIN_MOUNTAIN",
            category: "LAND",
            rarity: "UC",
            shape: [[1]],
            yields: { food: 0, wood: 1, defense: 3, mystic: 0 }
        },
        DESERT: {
            id: "DESERT",
            terrainId: "DESERT",
            nameKey: "TERRAIN_DESERT",
            category: "LAND",
            rarity: "UC",
            shape: [[1]],
            yields: { food: 1, wood: 0, defense: 0, mystic: 2 }
        },
        DEEP_FOREST: {
            id: "DEEP_FOREST",
            terrainId: "DEEP_FOREST",
            nameKey: "TERRAIN_DEEP_FOREST",
            category: "LAND",
            rarity: "R",
            shape: [[1, 1]],
            yields: { food: 1, wood: 3, defense: 1, mystic: 0 }
        }
    };

    class CardDatabase {
        constructor() {
            this.terrains = TERRAIN_DEFINITIONS;
        }

        getTerrain(key) {
            if (!key) return null;
            const upperKey = String(key).toUpperCase();
            return this.terrains[upperKey] || null;
        }

        getAllTerrains() {
            return Object.values(this.terrains);
        }
    }

    window.CardDatabase = new CardDatabase();
})(window);
