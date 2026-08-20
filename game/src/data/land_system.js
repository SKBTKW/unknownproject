const LAND_SYSTEM_DATA = {
  "terrains": {
    "GL0_DESERT": {
      "id": "GL0_DESERT",
      "nameKey": "TERRAIN_DESERT",
      "gl": 0,
      "h": 1,
      "baseYieldsPerTile": { "food": 0, "wood": 0, "defense": 0, "mystic": 2 },
      "category": "BASE"
    },
    "GL1_PLAINS": {
      "id": "GL1_PLAINS",
      "nameKey": "TERRAIN_PLAINS",
      "gl": 1,
      "h": 1,
      "baseYieldsPerTile": { "food": 4, "wood": 0, "defense": 0, "mystic": 0 },
      "category": "BASE"
    },
    "GL2_FOREST": {
      "id": "GL2_FOREST",
      "nameKey": "TERRAIN_FOREST",
      "gl": 2,
      "h": 1,
      "baseYieldsPerTile": { "food": 2, "wood": 2, "defense": 2, "mystic": 0 },
      "category": "BASE"
    },
    "GL3_DEEP_FOREST": {
      "id": "GL3_DEEP_FOREST",
      "nameKey": "TERRAIN_DEEP_FOREST",
      "gl": 3,
      "h": 1,
      "baseYieldsPerTile": { "food": 1, "wood": 3, "defense": 3, "mystic": 1 },
      "category": "BASE"
    },
    "H2_DESERT_HILL": {
      "id": "H2_DESERT_HILL",
      "nameKey": "TERRAIN_DESERT_HILL",
      "gl": 0,
      "h": 2,
      "baseYieldsPerTile": { "food": 0, "wood": 1, "defense": 1, "mystic": 2 },
      "category": "COMPOSITE"
    },
    "H2_HILL": {
      "id": "H2_HILL",
      "nameKey": "TERRAIN_HILL",
      "gl": 1,
      "h": 2,
      "baseYieldsPerTile": { "food": 2, "wood": 1, "defense": 1, "mystic": 0 },
      "category": "BASE"
    },
    "H2_FOREST_HILL": {
      "id": "H2_FOREST_HILL",
      "nameKey": "TERRAIN_FOREST_HILL",
      "gl": 2,
      "h": 2,
      "baseYieldsPerTile": { "food": 1, "wood": 4, "defense": 4, "mystic": 0 },
      "category": "COMPOSITE"
    },
    "H2_DEEP_HILL": {
      "id": "H2_DEEP_HILL",
      "nameKey": "TERRAIN_DEEP_HILL",
      "gl": 3,
      "h": 2,
      "baseYieldsPerTile": { "food": 1, "wood": 5, "defense": 6, "mystic": 1 },
      "category": "COMPOSITE"
    },
    "H3_MOUNTAIN": {
      "id": "H3_MOUNTAIN",
      "nameKey": "TERRAIN_MOUNTAIN",
      "gl": 2,
      "h": 3,
      "baseYieldsPerTile": { "food": 0, "wood": 3, "defense": 5, "mystic": 1 },
      "category": "BASE"
    }
  },
  "sockets": {
    "GL1_PLAINS": [
      { "id": "SOCKET_COW", "nameKey": "SOCKET_COW", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 3, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_SHEEP", "nameKey": "SOCKET_SHEEP", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 2, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_WILD_WHEAT", "nameKey": "SOCKET_WILD_WHEAT", "category": "穀物", "icon": "🍎", "bonusYields": { "food": 3, "wood": 0, "defense": 0, "mystic": 0 } }
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
    "H2_HILL": [
      { "id": "SOCKET_HORSE", "nameKey": "SOCKET_HORSE", "category": "家畜", "icon": "🛡️", "bonusYields": { "food": 0, "wood": 0, "defense": 2, "mystic": 0 } },
      { "id": "SOCKET_GOAT", "nameKey": "SOCKET_GOAT", "category": "家畜", "icon": "🍎", "bonusYields": { "food": 2, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_BARLEY", "nameKey": "SOCKET_BARLEY", "category": "穀物", "icon": "🍎", "bonusYields": { "food": 2, "wood": 0, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_LIMESTONE", "nameKey": "SOCKET_LIMESTONE", "category": "鉱物", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 3, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_HEMATITE", "nameKey": "SOCKET_HEMATITE", "category": "鉱物", "icon": "🛡️", "bonusYields": { "food": 0, "wood": 1, "defense": 2, "mystic": 0 } }
    ],
    "H3_MOUNTAIN": [
      { "id": "SOCKET_GRANITE", "nameKey": "SOCKET_GRANITE", "category": "鉱物", "icon": "🛡️", "bonusYields": { "food": 0, "wood": 0, "defense": 3, "mystic": 0 } },
      { "id": "SOCKET_IRON_DEPOSIT", "nameKey": "SOCKET_IRON_DEPOSIT", "category": "鉱物", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 2, "defense": 0, "mystic": 1 } }
    ],
    "GL0_DESERT": [
      { "id": "SOCKET_CAMEL", "nameKey": "SOCKET_CAMEL", "category": "家畜", "icon": "🐪", "bonusYields": { "food": 1, "wood": 1, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_DATES", "nameKey": "SOCKET_DATES", "category": "果実", "icon": "🍎", "bonusYields": { "food": 1, "wood": 0, "defense": 0, "mystic": 0 } },
      { "id": "SOCKET_NITER", "nameKey": "SOCKET_NITER", "category": "鉱物", "icon": "⛏️", "bonusYields": { "food": 0, "wood": 1, "defense": 0, "mystic": 2 } }
    ]
  },
  "mergeRules": {
    "H1_PLAINS": { "pattern": "2X2_SQUARE", "minTiles": 4, "explorationAllowed": false, "yieldMultiplier": 1.2, "emberReward": 1 },
    "H2_HILL": { "pattern": "4TILE_L_SHAPE", "minTiles": 4, "explorationAllowed": false, "yieldMultiplier": 1.2, "emberReward": 1 },
    "H3_MOUNTAIN": { "pattern": "4TILE_CONVEX_SHAPE", "minTiles": 4, "explorationAllowed": false, "yieldMultiplier": 1.2, "emberReward": 1 }
  }
};

if (typeof window !== "undefined") {
    window.LAND_SYSTEM_DATA = LAND_SYSTEM_DATA;
}
if (typeof globalThis !== "undefined") {
    globalThis.LAND_SYSTEM_DATA = LAND_SYSTEM_DATA;
}

export { LAND_SYSTEM_DATA };
export default LAND_SYSTEM_DATA;



