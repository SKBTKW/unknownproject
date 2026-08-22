const LAND_SYSTEM_DATA = {
  "terrains": {
    "GL0_DESERT": {
      "id": "GL0_DESERT",
      "nameKey": "TERRAIN_DESERT",
      "gl": 0,
      "e": 1,
      "baseYieldsPerTile": { "food": 0, "wood": 0, "defense": 0, "mystic": 2 },
      "category": "BASE"
    },
    "GL1_PLAINS": {
      "id": "GL1_PLAINS",
      "nameKey": "TERRAIN_PLAINS",
      "gl": 1,
      "e": 1,
      "baseYieldsPerTile": { "food": 4, "wood": 0, "defense": 0, "mystic": 0 },
      "category": "BASE"
    },
    "GL2_FOREST": {
      "id": "GL2_FOREST",
      "nameKey": "TERRAIN_FOREST",
      "gl": 2,
      "e": 1,
      "baseYieldsPerTile": { "food": 2, "wood": 2, "defense": 2, "mystic": 0 },
      "category": "BASE"
    },
    "GL3_DEEP_FOREST": {
      "id": "GL3_DEEP_FOREST",
      "nameKey": "TERRAIN_DEEP_FOREST",
      "gl": 3,
      "e": 1,
      "baseYieldsPerTile": { "food": 1, "wood": 3, "defense": 3, "mystic": 1 },
      "category": "BASE"
    },
    "E2_DESERT_HILL": {
      "id": "E2_DESERT_HILL",
      "nameKey": "TERRAIN_DESERT_HILL",
      "gl": 0,
      "e": 2,
      "baseYieldsPerTile": { "food": 0, "wood": 1, "defense": 1, "mystic": 2 },
      "category": "COMPOSITE"
    },
    "E2_HILL": {
      "id": "E2_HILL",
      "nameKey": "TERRAIN_HILL",
      "gl": 1,
      "e": 2,
      "baseYieldsPerTile": { "food": 2, "wood": 1, "defense": 1, "mystic": 0 },
      "category": "BASE"
    },
    "E2_FOREST_HILL": {
      "id": "E2_FOREST_HILL",
      "nameKey": "TERRAIN_FOREST_HILL",
      "gl": 2,
      "e": 2,
      "baseYieldsPerTile": { "food": 1, "wood": 4, "defense": 4, "mystic": 0 },
      "category": "COMPOSITE"
    },
    "E2_DEEP_HILL": {
      "id": "E2_DEEP_HILL",
      "nameKey": "TERRAIN_DEEP_HILL",
      "gl": 3,
      "e": 2,
      "baseYieldsPerTile": { "food": 1, "wood": 5, "defense": 6, "mystic": 1 },
      "category": "COMPOSITE"
    },
    "E3_MOUNTAIN": {
      "id": "E3_MOUNTAIN",
      "nameKey": "TERRAIN_MOUNTAIN",
      "gl": 0,
      "e": 3,
      "baseYieldsPerTile": { "food": 0, "wood": 3, "defense": 5, "mystic": 1 },
      "category": "BASE"
    }
  },
  "sockets": {
    "GL1_PLAINS": [
      { "id": "SOCKET_COW", "nameKey": "SOCKET_COW", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 3, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_SHEEP", "nameKey": "SOCKET_SHEEP", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 2, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_WILD_WHEAT", "nameKey": "SOCKET_WILD_WHEAT", "category": "穀物", "icon": "🍎", "bonusYields": { "food": 3, "wood": 0, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_LAKE", "nameKey": "SOCKET_LAKE", "category": "水脈", "icon": "💧", "bonusYields": { "food": 2, "wood": 0, "defense": 0, "mystic": 0 } }
    ],
    "GL2_FOREST": [
      { "id": "SOCKET_DEER", "nameKey": "SOCKET_DEER", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 2, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_APPLES", "nameKey": "SOCKET_APPLES", "category": "果実", "icon": "🍎", "bonusYields": { "food": 3, "wood": 0, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_CEDAR", "nameKey": "SOCKET_CEDAR", "category": "木材", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 3, "defense": 0, "mystic": 0 } }
    ],
    "GL3_DEEP_FOREST": [
      { "id": "SOCKET_GREAT_TREE", "nameKey": "SOCKET_GREAT_TREE", "category": "木材", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 2, "defense": 0, "mystic": 1 } },
      { "id": "SOCKET_APPLES", "nameKey": "SOCKET_APPLES", "category": "果実", "icon": "🍎", "bonusYields": { "food": 3, "wood": 0, "defense": 0, "mystic": 0 } }
    ],
    "E2_HILL": [
      { "id": "SOCKET_HORSE", "nameKey": "SOCKET_HORSE", "category": "家畜", "icon": "🛡️", "bonusYields": { "food": 0, "wood": 0, "defense": 2, "mystic": 0 } },
      { "id": "SOCKET_GOAT", "nameKey": "SOCKET_GOAT", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 2, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_BARLEY", "nameKey": "SOCKET_BARLEY", "category": "穀物", "icon": "🍎", "bonusYields": { "food": 2, "wood": 0, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_LIMESTONE", "nameKey": "SOCKET_LIMESTONE", "category": "鉱物", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 3, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_HEMATITE", "nameKey": "SOCKET_HEMATITE", "category": "鉱物", "icon": "🛡️", "bonusYields": { "food": 0, "wood": 1, "defense": 2, "mystic": 0 } }
    ],
    "E3_MOUNTAIN": [
      { "id": "SOCKET_GRANITE", "nameKey": "SOCKET_GRANITE", "category": "鉱物", "icon": "🛡️", "bonusYields": { "food": 0, "wood": 0, "defense": 3, "mystic": 0 } },
      { "id": "SOCKET_IRON_DEPOSIT", "nameKey": "SOCKET_IRON_DEPOSIT", "category": "鉱物", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 2, "defense": 0, "mystic": 1 } }
    ],
    "GL0_DESERT": [
      { "id": "SOCKET_CAMEL", "nameKey": "SOCKET_CAMEL", "category": "家畜", "icon": "🐪", "bonusYields": { "food": 1, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_DATES", "nameKey": "SOCKET_DATES", "category": "果実", "icon": "🍎", "bonusYields": { "food": 1, "wood": 0, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_NITER", "nameKey": "SOCKET_NITER", "category": "鉱物", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 1, "defense": 0, "mystic": 2 } },
      { "id": "SOCKET_OASIS", "nameKey": "SOCKET_OASIS", "category": "水脈", "icon": "🌴", "bonusYields": { "food": 1, "wood": 0, "defense": 0, "mystic": 0 } }
    ]
  },
  "mergeRules": {
    "E1_PLAINS": { "pattern": "2X2_SQUARE", "minTiles": 4, "explorationAllowed": false, "yieldMultiplier": 1.2, "emberReward": 1 },
    "E2_HILL": { "pattern": "4TILE_L_SHAPE", "minTiles": 4, "explorationAllowed": false, "yieldMultiplier": 1.2, "emberReward": 1 },
    "E3_MOUNTAIN": { "pattern": "4TILE_CONVEX_SHAPE", "minTiles": 4, "explorationAllowed": false, "yieldMultiplier": 1.2, "emberReward": 1 }
  }
};

/**
 * 🗺️ (E, GL) 2次元標高・気候パラメータ一元解決レジストリ
 * E: 標高 (1=低地, 2=丘陵, 3=山岳)
 * GL: 気候・植生 (0=乾燥/砂漠, 1=平地/草原, 2=森林/温帯, 3=密林/深緑)
 */
class TerrainRegistry {
    /**
     * (e, gl) の組み合わせから地形定義を一意に取得
     */
    static getTerrain(e, gl) {
        const eNum = Number(e);
        const glNum = Number(gl);

        // 9パターン確定マトリクス lookup
        const terrains = LAND_SYSTEM_DATA.terrains;
        for (const tid in terrains) {
            const t = terrains[tid];
            if (t.e === eNum && t.gl === glNum) {
                return t;
            }
        }

        // フォールバック: (3, 0) 山岳、(2, 1) 丘陵、(1, 1) 平地
        if (eNum === 3) return terrains["E3_MOUNTAIN"] || null;
        if (eNum === 2) return terrains["E2_HILL"] || null;
        return terrains["GL1_PLAINS"] || null;
    }

    /**
     * 地形IDから (e, gl) を逆引き
     */
    static getCoordsById(terrainId) {
        const terrains = LAND_SYSTEM_DATA.terrains;
        if (terrains[terrainId]) {
            return { e: terrains[terrainId].e, gl: terrains[terrainId].gl };
        }
        return { e: 1, gl: 1 };
    }
}

if (typeof window !== "undefined") {
    window.LAND_SYSTEM_DATA = LAND_SYSTEM_DATA;
    window.TerrainRegistry = TerrainRegistry;
}
if (typeof globalThis !== "undefined") {
    globalThis.LAND_SYSTEM_DATA = LAND_SYSTEM_DATA;
    globalThis.TerrainRegistry = TerrainRegistry;
}

export { LAND_SYSTEM_DATA, TerrainRegistry };
export default LAND_SYSTEM_DATA;
