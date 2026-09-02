// 🗺️ 全地勢パラメータ中央集中マトリクス (Single Source of Truth)
export const TERRAIN_MATRIX = {
  0: { // ─── E0: 低地帯 (現行はGL1湿原のみ自然生成) ───
    1: { id: "E0_WETLAND",      nameKey: "TERRAIN_WETLAND",     gl: 1, e: 0, food: 2, material: 0, wood: 0, defense: 1, mystic: 0, category: "BASE" }
  },
  1: { // ─── E1: 平地帯 ───
    0: { id: "GL0_DESERT",      nameKey: "TERRAIN_DESERT",      gl: 0, e: 1, food: 0, material: 0, wood: 0, defense: 0, mystic: 2, category: "BASE" },
    1: { id: "GL1_PLAINS",      nameKey: "TERRAIN_PLAINS",      gl: 1, e: 1, food: 4, material: 0, wood: 0, defense: 0, mystic: 0, category: "BASE" },
    2: { id: "GL2_FOREST",      nameKey: "TERRAIN_FOREST",      gl: 2, e: 1, food: 2, material: 2, wood: 2, defense: 2, mystic: 0, category: "BASE" },
    3: { id: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, e: 1, food: 1, material: 3, wood: 3, defense: 3, mystic: 1, category: "BASE" }
  },
  2: { // ─── E2: 丘陵帯 ───
    0: { id: "E2_DESERT_HILL",  nameKey: "TERRAIN_DESERT_HILL", gl: 0, e: 2, food: 0, material: 1, wood: 1, defense: 1, mystic: 2, category: "COMPOSITE" },
    1: { id: "E2_HILL",         nameKey: "TERRAIN_HILL",        gl: 1, e: 2, food: 2, material: 1, wood: 1, defense: 1, mystic: 0, category: "BASE" },
    2: { id: "E2_FOREST_HILL",  nameKey: "TERRAIN_FOREST_HILL", gl: 2, e: 2, food: 1, material: 4, wood: 4, defense: 4, mystic: 0, category: "COMPOSITE" },
    3: { id: "E2_DEEP_HILL",    nameKey: "TERRAIN_DEEP_HILL",   gl: 3, e: 2, food: 1, material: 5, wood: 5, defense: 6, mystic: 1, category: "COMPOSITE" }
  },
  3: { // ─── E3: 山岳帯 ───
    0: { id: "E3_MOUNTAIN",     nameKey: "TERRAIN_MOUNTAIN",    gl: 0, e: 3, food: 0, material: 3, wood: 3, defense: 5, mystic: 1, category: "BASE" }
  }
};

// 🧮 2変数合成モデル決定エンジン (E × GL Parameter Derivation Engine)
export class TerrainParameterEngine {
  /**
   * GL (繁茂度) の基礎産出ベクトル B(GL) を取得
   */
  static getBaseVector(gl) {
    const glNum = Number(gl);
    switch (glNum) {
      case 0: return { food: 0, material: 0, wood: 0, defense: 0, mystic: 2 };
      case 1: return { food: 4, material: 0, wood: 0, defense: 0, mystic: 0 };
      case 2: return { food: 2, material: 2, wood: 2, defense: 2, mystic: 0 };
      case 3: return { food: 1, material: 3, wood: 3, defense: 3, mystic: 1 };
      default: return { food: 4, material: 0, wood: 0, defense: 0, mystic: 0 };
    }
  }

  /**
   * (e, gl) の組み合わせから地形定義オブジェクトを取得
   */
  static getTerrain(e, gl) {
    const eNum = Number(e);
    const glNum = Number(gl);
    if (TERRAIN_MATRIX[eNum] && TERRAIN_MATRIX[eNum][glNum]) {
      const t = TERRAIN_MATRIX[eNum][glNum];
      return {
        ...t,
        baseYieldsPerTile: { food: t.food, material: t.material, wood: t.material, defense: t.defense, mystic: t.mystic },
        yields: { food: t.food, material: t.material, wood: t.material, defense: t.defense, mystic: t.mystic }
      };
    }
    // 安全なフォールバック
    if (eNum === 0) return this.getTerrain(0, 1);
    if (eNum === 3) return this.getTerrain(3, 0);
    if (eNum === 2) return this.getTerrain(2, 1);
    return this.getTerrain(1, 1);
  }

  /**
   * 2変数合成モデル T_E(B(GL), GL) に基づいて 1マス基礎産出を取得
   */
  static getYields(e, gl) {
    const eNum = Number(e);
    const glNum = Number(gl);

    // E3: 山岳 Override
    if (eNum === 3) {
      return { food: 0, material: 3, wood: 3, defense: 5, mystic: 1 };
    }

    const B = this.getBaseVector(glNum);

    // E0: 低湿地変換 (GL1)
    if (eNum === 0) {
      return {
        food: Math.floor(B.food * 0.5),
        material: B.material,
        wood: B.material,
        defense: B.defense + 1,
        mystic: B.mystic
      };
    }

    // E1: 基準面
    if (eNum === 1) {
      return {
        food: B.food,
        material: B.material,
        wood: B.material,
        defense: B.defense,
        mystic: B.mystic
      };
    }

    // E2: 丘陵変換
    if (eNum === 2) {
      const food = (glNum === 0) ? 0 : Math.max(1, Math.floor(B.food * 0.5));
      const material = B.material + 1 + Math.floor(glNum / 2);
      const defense = B.defense + Math.max(1, glNum);
      const mystic = B.mystic;
      return { food, material, wood: material, defense, mystic };
    }

    return { food: B.food, material: B.material, wood: B.material, defense: B.defense, mystic: B.mystic };
  }

  /**
   * 地形IDから (e, gl) を逆引き
   */
  static getCoordsById(terrainId) {
    if (terrainId === "E1_RECLAIMED_LAND") return { e: 1, gl: 1 };
    for (const e in TERRAIN_MATRIX) {
      for (const gl in TERRAIN_MATRIX[e]) {
        if (TERRAIN_MATRIX[e][gl].id === terrainId) {
          return { e: Number(e), gl: Number(gl) };
        }
      }
    }
    return { e: 1, gl: 1 };
  }
}

export const TerrainRegistry = TerrainParameterEngine;

// 📦 互換データマスター
const LAND_SYSTEM_DATA = {
  "terrains": {
    "E0_WETLAND":      { id: "E0_WETLAND",      nameKey: "TERRAIN_WETLAND",     gl: 1, e: 0, baseYieldsPerTile: { food: 2, material: 0, wood: 0, defense: 1, mystic: 0 }, category: "BASE" },
    "GL0_DESERT":      { id: "GL0_DESERT",      nameKey: "TERRAIN_DESERT",      gl: 0, e: 1, baseYieldsPerTile: { food: 0, material: 0, wood: 0, defense: 0, mystic: 2 }, category: "BASE" },
    "GL1_PLAINS":      { id: "GL1_PLAINS",      nameKey: "TERRAIN_PLAINS",      gl: 1, e: 1, baseYieldsPerTile: { food: 4, material: 0, wood: 0, defense: 0, mystic: 0 }, category: "BASE" },
    "E1_RECLAIMED_LAND": { id: "E1_RECLAIMED_LAND", terrainId: "E1_RECLAIMED_LAND", nameKey: "TERRAIN_RECLAIMED_LAND", gl: 1, e: 1, baseYieldsPerTile: { food: 4, material: 1, wood: 1, defense: 0, mystic: 0 }, food: 4, material: 1, wood: 1, defense: 0, mystic: 0, category: "BASE", isSpecialBlock: true, isArtificialTerrain: true },
    "GL2_FOREST":      { id: "GL2_FOREST",      nameKey: "TERRAIN_FOREST",      gl: 2, e: 1, baseYieldsPerTile: { food: 2, material: 2, wood: 2, defense: 2, mystic: 0 }, category: "BASE" },
    "GL3_DEEP_FOREST": { id: "GL3_DEEP_FOREST", nameKey: "TERRAIN_DEEP_FOREST", gl: 3, e: 1, baseYieldsPerTile: { food: 1, material: 3, wood: 3, defense: 3, mystic: 1 }, category: "BASE" },
    "E2_DESERT_HILL":  { id: "E2_DESERT_HILL",  nameKey: "TERRAIN_DESERT_HILL", gl: 0, e: 2, baseYieldsPerTile: { food: 0, material: 1, wood: 1, defense: 1, mystic: 2 }, category: "COMPOSITE" },
    "E2_HILL":         { id: "E2_HILL",         nameKey: "TERRAIN_HILL",        gl: 1, e: 2, baseYieldsPerTile: { food: 2, material: 1, wood: 1, defense: 1, mystic: 0 }, category: "BASE" },
    "E2_FOREST_HILL":  { id: "E2_FOREST_HILL",  nameKey: "TERRAIN_FOREST_HILL", gl: 2, e: 2, baseYieldsPerTile: { food: 1, material: 4, wood: 4, defense: 4, mystic: 0 }, category: "COMPOSITE" },
    "E2_DEEP_HILL":    { id: "E2_DEEP_HILL",    nameKey: "TERRAIN_DEEP_HILL",   gl: 3, e: 2, baseYieldsPerTile: { food: 1, material: 5, wood: 5, defense: 6, mystic: 1 }, category: "COMPOSITE" },
    "E3_MOUNTAIN":     { id: "E3_MOUNTAIN",     nameKey: "TERRAIN_MOUNTAIN",    gl: 0, e: 3, baseYieldsPerTile: { food: 0, material: 3, wood: 3, defense: 5, mystic: 1 }, category: "BASE" }
  },
  "sockets": {
    "E0_WETLAND": [
      { id: "SOCKET_WILD_RICE", nameKey: "SOCKET_WILD_RICE", category: "CAT_GRAIN", icon: "🌾", weight: 100, bonusYields: { food: 3, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_WATER_DROPWORT", nameKey: "SOCKET_WATER_DROPWORT", category: "CAT_GATHERING", icon: "🍎", weight: 80, bonusYields: { food: 1, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_HERB", nameKey: "SOCKET_HERB", category: "CAT_USEFUL_PLANT", icon: "🌿", weight: 55, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 1 } },
      { id: "SOCKET_LAKE", nameKey: "SOCKET_LAKE", category: "CAT_WATER", icon: "💧", weight: 0, isSpecialWater: true, lakeRate: 0.60, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_SALT", nameKey: "SOCKET_SALT", category: "CAT_SALT", icon: "🧂", weight: 20, bonusYields: { food: 1, material: 1, wood: 1, defense: 0, mystic: 0 } }
    ],
    "GL0_DESERT": [
      { id: "SOCKET_CAMEL", nameKey: "SOCKET_CAMEL", category: "CAT_LIVESTOCK", icon: "🐄", weight: 70, bonusYields: { food: 1, material: 1, wood: 1, defense: 0, mystic: 0 } },
      { id: "SOCKET_DATES", nameKey: "SOCKET_DATES", category: "CAT_GATHERING", icon: "🍎", weight: 90, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_SALT", nameKey: "SOCKET_SALT", category: "CAT_SALT", icon: "🧂", weight: 80, bonusYields: { food: 1, material: 1, wood: 1, defense: 0, mystic: 0 } },
      { id: "SOCKET_NITER", nameKey: "SOCKET_NITER", category: "CAT_STRATEGIC_MINERAL", icon: "⛏️", weight: 35, bonusYields: { food: 0, material: 1, wood: 1, defense: 1, mystic: 0 } },
      { id: "SOCKET_OASIS", nameKey: "SOCKET_OASIS", category: "CAT_WATER", icon: "💧", weight: 0, isSpecialWater: true, oasisRate: 0.25, bonusYields: { food: 1, material: 0, wood: 0, defense: 0, mystic: 0 } }
    ],
    "GL1_PLAINS": [
      { id: "SOCKET_COW", nameKey: "SOCKET_COW", category: "CAT_LIVESTOCK", icon: "🐄", weight: 70, bonusYields: { food: 3, material: 1, wood: 1, defense: 0, mystic: 0 } },
      { id: "SOCKET_SHEEP", nameKey: "SOCKET_SHEEP", category: "CAT_LIVESTOCK", icon: "🐄", weight: 90, bonusYields: { food: 2, material: 1, wood: 1, defense: 0, mystic: 0 } },
      { id: "SOCKET_WILD_WHEAT", nameKey: "SOCKET_WILD_WHEAT", category: "CAT_GRAIN", icon: "🌾", weight: 100, bonusYields: { food: 3, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_WILD_GRAPE", nameKey: "SOCKET_WILD_GRAPE", category: "CAT_GATHERING", icon: "🍎", weight: 60, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_HERB", nameKey: "SOCKET_HERB", category: "CAT_USEFUL_PLANT", icon: "🌿", weight: 50, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 1 } },
      { id: "SOCKET_LAKE", nameKey: "SOCKET_LAKE", category: "CAT_WATER", icon: "💧", weight: 0, isSpecialWater: true, lakeRate: 0.25, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } }
    ],
    "GL2_FOREST": [
      { id: "SOCKET_DEER", nameKey: "SOCKET_DEER", category: "CAT_HUNTING", icon: "🐾", weight: 90, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_BOAR", nameKey: "SOCKET_BOAR", category: "CAT_HUNTING", icon: "🐾", weight: 70, bonusYields: { food: 2, material: 1, wood: 1, defense: 0, mystic: 0 } },
      { id: "SOCKET_APPLES", nameKey: "SOCKET_APPLES", category: "CAT_GATHERING", icon: "🍎", weight: 70, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_WILD_BERRIES", nameKey: "SOCKET_WILD_BERRIES", category: "CAT_GATHERING", icon: "🍎", weight: 100, bonusYields: { food: 1, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_CEDAR", nameKey: "SOCKET_CEDAR", category: "CAT_WOOD", icon: "🌳", weight: 70, bonusYields: { food: 0, material: 3, wood: 3, defense: 0, mystic: 0 } },
      { id: "SOCKET_OAK", nameKey: "SOCKET_OAK", category: "CAT_WOOD", icon: "🌳", weight: 70, bonusYields: { food: 1, material: 2, wood: 2, defense: 0, mystic: 0 } }
    ],
    "GL3_DEEP_FOREST": [
      { id: "SOCKET_GREAT_TREE", nameKey: "SOCKET_GREAT_TREE", category: "CAT_WOOD", icon: "🌳", weight: 55, bonusYields: { food: 0, material: 2, wood: 2, defense: 0, mystic: 1 } },
      { id: "SOCKET_TREE_NUTS", nameKey: "SOCKET_TREE_NUTS", category: "CAT_GATHERING", icon: "🍎", weight: 100, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_MEDICINAL_MUSHROOM", nameKey: "SOCKET_MEDICINAL_MUSHROOM", category: "CAT_FUNGI", icon: "🍄", weight: 65, bonusYields: { food: 1, material: 0, wood: 0, defense: 0, mystic: 1 } },
      { id: "SOCKET_ELK", nameKey: "SOCKET_ELK", category: "CAT_HUNTING", icon: "🐾", weight: 50, bonusYields: { food: 2, material: 0, wood: 0, defense: 1, mystic: 0 } },
      { id: "SOCKET_SACRED_TREE", nameKey: "SOCKET_SACRED_TREE", category: "CAT_SPECIAL_NATURE", icon: "💎", weight: 25, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 2 } }
    ],
    "E2_WASTELAND": [
      { id: "SOCKET_LIMESTONE", nameKey: "SOCKET_LIMESTONE", category: "CAT_STONE", icon: "🪨", weight: 100, bonusYields: { food: 0, material: 3, wood: 3, defense: 0, mystic: 0 } },
      { id: "SOCKET_HEMATITE", nameKey: "SOCKET_HEMATITE", category: "CAT_STRATEGIC_MINERAL", icon: "⛏️", weight: 55, bonusYields: { food: 0, material: 1, wood: 1, defense: 2, mystic: 0 } },
      { id: "SOCKET_SLATE", nameKey: "SOCKET_SLATE", category: "CAT_STONE", icon: "🪨", weight: 80, bonusYields: { food: 0, material: 2, wood: 2, defense: 0, mystic: 0 } },
      { id: "SOCKET_SULFUR", nameKey: "SOCKET_SULFUR", category: "CAT_STRATEGIC_MINERAL", icon: "⛏️", weight: 40, bonusYields: { food: 0, material: 1, wood: 1, defense: 1, mystic: 0 } },
      { id: "SOCKET_DRIED_HERB", nameKey: "SOCKET_DRIED_HERB", category: "CAT_USEFUL_PLANT", icon: "🌿", weight: 55, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 1 } }
    ],
    "E2_HILL": [
      { id: "SOCKET_HORSE", nameKey: "SOCKET_HORSE", category: "CAT_STRATEGIC_LIVESTOCK", icon: "🐎", weight: 40, bonusYields: { food: 0, material: 0, wood: 0, defense: 2, mystic: 0 } },
      { id: "SOCKET_GOAT", nameKey: "SOCKET_GOAT", category: "CAT_LIVESTOCK", icon: "🐄", weight: 90, bonusYields: { food: 2, material: 1, wood: 1, defense: 0, mystic: 0 } },
      { id: "SOCKET_BARLEY", nameKey: "SOCKET_BARLEY", category: "CAT_GRAIN", icon: "🌾", weight: 100, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_RYE", nameKey: "SOCKET_RYE", category: "CAT_GRAIN", icon: "🌾", weight: 80, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_GRAPE", nameKey: "SOCKET_GRAPE", category: "CAT_GATHERING", icon: "🍎", weight: 60, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_SANDSTONE", nameKey: "SOCKET_SANDSTONE", category: "CAT_STONE", icon: "🪨", weight: 70, bonusYields: { food: 0, material: 2, wood: 2, defense: 0, mystic: 0 } }
    ],
    "E2_FOREST_HILL": [
      { id: "SOCKET_BEECH", nameKey: "SOCKET_BEECH", category: "CAT_WOOD", icon: "🌳", weight: 90, bonusYields: { food: 0, material: 3, wood: 3, defense: 0, mystic: 0 } },
      { id: "SOCKET_CHESTNUT", nameKey: "SOCKET_CHESTNUT", category: "CAT_WOOD", icon: "🌳", weight: 80, bonusYields: { food: 1, material: 2, wood: 2, defense: 0, mystic: 0 } },
      { id: "SOCKET_SEROW", nameKey: "SOCKET_SEROW", category: "CAT_HUNTING", icon: "🐾", weight: 55, bonusYields: { food: 2, material: 0, wood: 0, defense: 1, mystic: 0 } },
      { id: "SOCKET_WILD_VEGETABLES", nameKey: "SOCKET_WILD_VEGETABLES", category: "CAT_GATHERING", icon: "🍎", weight: 100, bonusYields: { food: 2, material: 0, wood: 0, defense: 0, mystic: 0 } },
      { id: "SOCKET_COPPER_VEIN", nameKey: "SOCKET_COPPER_VEIN", category: "CAT_STRATEGIC_MINERAL", icon: "⛏️", weight: 50, bonusYields: { food: 0, material: 1, wood: 1, defense: 1, mystic: 0 } },
      { id: "SOCKET_MOUNTAIN_HERB", nameKey: "SOCKET_MOUNTAIN_HERB", category: "CAT_USEFUL_PLANT", icon: "🌿", weight: 65, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 1 } }
    ],
    "E2_DEEP_FOREST_HILL": [
      { id: "SOCKET_FIR", nameKey: "SOCKET_FIR", category: "CAT_WOOD", icon: "🌳", weight: 90, bonusYields: { food: 0, material: 3, wood: 3, defense: 0, mystic: 0 } },
      { id: "SOCKET_HARDWOOD", nameKey: "SOCKET_HARDWOOD", category: "CAT_WOOD", icon: "🌳", weight: 55, bonusYields: { food: 0, material: 2, wood: 2, defense: 0, mystic: 1 } },
      { id: "SOCKET_BEAR", nameKey: "SOCKET_BEAR", category: "CAT_HUNTING", icon: "🐾", weight: 50, bonusYields: { food: 2, material: 0, wood: 0, defense: 1, mystic: 0 } },
      { id: "SOCKET_SPIRIT_MUSHROOM", nameKey: "SOCKET_SPIRIT_MUSHROOM", category: "CAT_FUNGI", icon: "🍄", weight: 40, bonusYields: { food: 1, material: 0, wood: 0, defense: 0, mystic: 1 } },
      { id: "SOCKET_SPIRIT_TREE", nameKey: "SOCKET_SPIRIT_TREE", category: "CAT_SPECIAL_NATURE", icon: "💎", weight: 30, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 2 } },
      { id: "SOCKET_SILVER_VEIN", nameKey: "SOCKET_SILVER_VEIN", category: "CAT_PRECIOUS_METAL", icon: "🪙", weight: 25, bonusYields: { food: 0, material: 1, wood: 1, defense: 0, mystic: 2 } }
    ],
    "E3_MOUNTAIN": [
      { id: "SOCKET_GRANITE", nameKey: "SOCKET_GRANITE", category: "CAT_STONE", icon: "🪨", weight: 100, bonusYields: { food: 0, material: 3, wood: 3, defense: 1, mystic: 0 } },
      { id: "SOCKET_IRON_VEIN", nameKey: "SOCKET_IRON_VEIN", category: "CAT_STRATEGIC_MINERAL", icon: "⛏️", weight: 75, bonusYields: { food: 0, material: 1, wood: 1, defense: 2, mystic: 0 } },
      { id: "SOCKET_GOLD_VEIN", nameKey: "SOCKET_GOLD_VEIN", category: "CAT_PRECIOUS_METAL", icon: "🪙", weight: 20, bonusYields: { food: 0, material: 2, wood: 2, defense: 0, mystic: 2 } },
      { id: "SOCKET_CRYSTAL", nameKey: "SOCKET_CRYSTAL", category: "CAT_SPECIAL_MINERAL", icon: "💎", weight: 35, bonusYields: { food: 0, material: 0, wood: 0, defense: 0, mystic: 3 } },
      { id: "SOCKET_OBSIDIAN", nameKey: "SOCKET_OBSIDIAN", category: "CAT_SPECIAL_MINERAL", icon: "💎", weight: 45, bonusYields: { food: 0, material: 0, wood: 0, defense: 2, mystic: 1 } },
      { id: "SOCKET_ALPINE_FLOWER", nameKey: "SOCKET_ALPINE_FLOWER", category: "CAT_USEFUL_PLANT", icon: "🌿", weight: 60, bonusYields: { food: 1, material: 0, wood: 0, defense: 0, mystic: 1 } }
    ]
  },
  "mergeRules": {
    "E1_PLAINS": { pattern: "2X2_SQUARE", minTiles: 4, explorationAllowed: false, yieldMultiplier: 1.2, emberReward: 1 },
    "E2_HILL": { pattern: "4TILE_L_SHAPE", minTiles: 4, explorationAllowed: false, yieldMultiplier: 1.2, emberReward: 1 },
    "E3_MOUNTAIN": { pattern: "4TILE_CONVEX_SHAPE", minTiles: 4, explorationAllowed: false, yieldMultiplier: 1.2, emberReward: 1 }
  }
};

if (typeof window !== "undefined") {
  window.LAND_SYSTEM_DATA = LAND_SYSTEM_DATA;
  window.TERRAIN_MATRIX = TERRAIN_MATRIX;
  window.TerrainParameterEngine = TerrainParameterEngine;
  window.TerrainRegistry = TerrainParameterEngine;
}
if (typeof globalThis !== "undefined") {
  globalThis.LAND_SYSTEM_DATA = LAND_SYSTEM_DATA;
  globalThis.TERRAIN_MATRIX = TERRAIN_MATRIX;
  globalThis.TerrainParameterEngine = TerrainParameterEngine;
  globalThis.TerrainRegistry = TerrainParameterEngine;
}

export { LAND_SYSTEM_DATA };
export default LAND_SYSTEM_DATA;
