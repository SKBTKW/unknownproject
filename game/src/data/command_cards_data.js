// 🛡️ Generated pure data module from JSON assets (SSOT)
// Unity & Mobile Ready: Data and Logic completely separated.

export const ECONOMY_CARDS_MASTER = [
  {
    "id": "CMD_RATIONING",
    "category": "COMMAND",
    "nameKey": "CMD_RATIONING_NAME",
    "descriptionKey": "CMD_RATIONING_DESC",
    "cost": {},
    "tags": [
      "FOOD",
      "EMERGENCY"
    ],
    "reqFoodDeficitOrFallback": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.4,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_WETLAND_RECLAMATION",
    "category": "COMMAND",
    "nameKey": "CMD_WETLAND_RECLAMATION_NAME",
    "descriptionKey": "CMD_WETLAND_RECLAMATION_DESC",
    "cost": {
      "wood": 15,
      "ember": 1
    },
    "tags": [
      "WETLAND",
      "RECLAIMED",
      "FOOD",
      "DEVELOPMENT"
    ],
    "reqWetland": 1,
    "reqWood": 15,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LOGGING_CAMP",
    "category": "COMMAND",
    "nameKey": "CMD_LOGGING_CAMP_NAME",
    "descriptionKey": "CMD_LOGGING_CAMP_DESC",
    "cost": {
      "ember": 1
    },
    "tags": [
      "FOREST",
      "MATERIAL",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqForestNearby": 3,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_GRANARY",
    "category": "COMMAND",
    "nameKey": "CMD_GRANARY_NAME",
    "descriptionKey": "CMD_GRANARY_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "STORAGE",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqPlains": 4,
    "reqWood": 20,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_AGRICULTURAL_REFORM",
    "category": "COMMAND",
    "nameKey": "CMD_AGRICULTURAL_REFORM_NAME",
    "descriptionKey": "CMD_AGRICULTURAL_REFORM_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "AGRICULTURE",
      "DEVELOPMENT"
    ],
    "reqConnectedPlainsOrReclaimed": 3,
    "reqWood": 20,
    "minStage": 1,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_PASTORAL_FARM",
    "category": "COMMAND",
    "nameKey": "CMD_PASTORAL_FARM_NAME",
    "descriptionKey": "CMD_PASTORAL_FARM_DESC",
    "cost": {
      "wood": 15
    },
    "tags": [
      "PLAINS",
      "LIVESTOCK",
      "FOOD",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTag": "LIVESTOCK",
    "reqPlains": 4,
    "reqWood": 15,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_ABANDONED_SETTLEMENT",
    "category": "COMMAND",
    "nameKey": "CMD_ABANDONED_SETTLEMENT_NAME",
    "descriptionKey": "CMD_ABANDONED_SETTLEMENT_DESC",
    "cost": {
      "ember": 1
    },
    "tags": [
      "EXPLORATION",
      "EVENT",
      "RESOURCE"
    ],
    "reqEmptyCells": 8,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_EMERGENCY_LEVY",
    "category": "COMMAND",
    "nameKey": "CMD_EMERGENCY_LEVY_NAME",
    "descriptionKey": "CMD_EMERGENCY_LEVY_DESC",
    "cost": {
      "food": 20
    },
    "tags": [
      "FOOD",
      "MATERIAL",
      "EMERGENCY"
    ],
    "reqWoodDeficit": true,
    "reqFood": 20,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_SAWMILL",
    "category": "COMMAND",
    "nameKey": "CMD_SAWMILL_NAME",
    "descriptionKey": "CMD_SAWMILL_DESC",
    "cost": {
      "wood": 25
    },
    "tags": [
      "FOREST",
      "MATERIAL",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqLoggingCamp": 1,
    "reqWood": 25,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_QUARRY",
    "category": "COMMAND",
    "nameKey": "CMD_QUARRY_NAME",
    "descriptionKey": "CMD_QUARRY_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "HILL",
      "STONE",
      "MATERIAL",
      "EXTRACTION",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTag": "STONE",
    "reqHill": 1,
    "reqWood": 20,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MINE",
    "category": "COMMAND",
    "nameKey": "CMD_MINE_NAME",
    "descriptionKey": "CMD_MINE_DESC",
    "cost": {
      "wood": 25
    },
    "tags": [
      "HILL",
      "MOUNTAIN",
      "ORE",
      "MATERIAL",
      "MYSTIC",
      "EXTRACTION",
      "SPECIAL_BLOCK"
    ],
    "reqOreSocket": true,
    "reqWood": 25,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_STABLE",
    "category": "COMMAND",
    "nameKey": "CMD_STABLE_NAME",
    "descriptionKey": "CMD_STABLE_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "PLAINS",
      "LIVESTOCK",
      "MOBILITY",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTag": "HORSE",
    "reqPlains": 6,
    "reqWood": 20,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LIME_KILN",
    "category": "COMMAND",
    "nameKey": "CMD_LIME_KILN_NAME",
    "descriptionKey": "CMD_LIME_KILN_DESC",
    "cost": {
      "food": 10,
      "wood": 15
    },
    "tags": [
      "STONE",
      "FOREST",
      "MATERIAL",
      "CONSTRUCTION",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTags": [
      "STONE",
      "WOOD"
    ],
    "reqFood": 10,
    "reqWood": 15,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MARKET",
    "category": "COMMAND",
    "nameKey": "CMD_MARKET_NAME",
    "descriptionKey": "CMD_MARKET_DESC",
    "cost": {
      "wood": 25
    },
    "tags": [
      "LINK",
      "RESOURCE",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqMinLinks": 2,
    "reqWood": 25,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_DEPOT",
    "category": "COMMAND",
    "nameKey": "CMD_DEPOT_NAME",
    "descriptionKey": "CMD_DEPOT_DESC",
    "cost": {
      "wood": 30
    },
    "tags": [
      "MATERIAL",
      "STORAGE",
      "LINK",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqIndustrySpecialBlocks": 2,
    "reqWood": 30,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_IRRIGATION",
    "category": "COMMAND",
    "nameKey": "CMD_IRRIGATION_NAME",
    "descriptionKey": "CMD_IRRIGATION_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "WATER",
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "DEVELOPMENT"
    ],
    "reqWaterSource": true,
    "reqPlainsOrReclaimed": 1,
    "reqWood": 20,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_RESETTLEMENT",
    "category": "COMMAND",
    "nameKey": "CMD_RESETTLEMENT_NAME",
    "descriptionKey": "CMD_RESETTLEMENT_DESC",
    "cost": {
      "food": 15,
      "wood": 10
    },
    "tags": [
      "PLAINS",
      "MERGE",
      "FOOD",
      "DEVELOPMENT"
    ],
    "reqPlainsMerge2x2": 1,
    "reqFood": 15,
    "reqWood": 10,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_WORKSHOP",
    "category": "COMMAND",
    "nameKey": "CMD_WORKSHOP_NAME",
    "descriptionKey": "CMD_WORKSHOP_DESC",
    "cost": {
      "wood": 30
    },
    "tags": [
      "MATERIAL",
      "INDUSTRY",
      "CONSTRUCTION",
      "SPECIAL_BLOCK"
    ],
    "reqDistinctPrimaryIndustries": 2,
    "reqWood": 30,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_GRANARY_NETWORK",
    "category": "COMMAND",
    "nameKey": "CMD_GRANARY_NETWORK_NAME",
    "descriptionKey": "CMD_GRANARY_NETWORK_DESC",
    "cost": {
      "wood": 50
    },
    "tags": [
      "FOOD",
      "STORAGE",
      "LINK",
      "PROJECT"
    ],
    "reqGranaries": 2,
    "reqWood": 50,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_INDUSTRIAL_ROAD",
    "category": "COMMAND",
    "nameKey": "CMD_INDUSTRIAL_ROAD_NAME",
    "descriptionKey": "CMD_INDUSTRIAL_ROAD_DESC",
    "cost": {
      "wood": 45
    },
    "tags": [
      "ROAD",
      "LINK",
      "INDUSTRY",
      "PROJECT"
    ],
    "reqIndustrySpecialBlocks": 2,
    "reqWood": 45,
    "minStage": 3,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_IRRIGATION_NETWORK",
    "category": "COMMAND",
    "nameKey": "CMD_IRRIGATION_NETWORK_NAME",
    "descriptionKey": "CMD_IRRIGATION_NETWORK_DESC",
    "cost": {
      "wood": 50
    },
    "tags": [
      "WATER",
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "PROJECT"
    ],
    "reqIrrigationDone": true,
    "reqWaterSource": true,
    "reqWood": 50,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_INDUSTRIAL_CLUSTER",
    "category": "COMMAND",
    "nameKey": "CMD_INDUSTRIAL_CLUSTER_NAME",
    "descriptionKey": "CMD_INDUSTRIAL_CLUSTER_DESC",
    "cost": {
      "wood": 60
    },
    "tags": [
      "INDUSTRY",
      "LINK",
      "PROJECT"
    ],
    "reqLinkedDistinctIndustries": 3,
    "reqWood": 60,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_GREAT_RAMPART_PROJECT",
    "category": "COMMAND",
    "nameKey": "CMD_GREAT_RAMPART_PROJECT_NAME",
    "descriptionKey": "CMD_GREAT_RAMPART_PROJECT_DESC",
    "cost": {
      "wood": 70
    },
    "tags": [
      "CONSTRUCTION",
      "DEFENSE",
      "PROJECT"
    ],
    "reqLargeTerritory": true,
    "reqWood": 70,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  }
];

export const MILITARY_CARDS_MASTER = [
  {
    "id": "CMD_VIGILANCE",
    "category": "COMMAND",
    "nameKey": "CMD_VIGILANCE_NAME",
    "descriptionKey": "CMD_VIGILANCE_DESC",
    "cost": {
      "wood": 15
    },
    "reqTrialOrLowDefense": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MUD_OBSTACLE",
    "category": "COMMAND",
    "nameKey": "CMD_MUD_OBSTACLE_NAME",
    "descriptionKey": "CMD_MUD_OBSTACLE_DESC",
    "cost": {
      "wood": 15
    },
    "reqWetlandOrLake": true,
    "reqTrialNotice": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_HIGH_GROUND_FORMATION",
    "category": "COMMAND",
    "nameKey": "CMD_HIGH_GROUND_FORMATION_NAME",
    "descriptionKey": "CMD_HIGH_GROUND_FORMATION_DESC",
    "cost": {
      "wood": 10
    },
    "reqHillOrMountain": true,
    "reqTrialNotice": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MILITARY_FOCUS",
    "category": "MILITARY",
    "nameKey": "CMD_MILITARY_FOCUS_NAME",
    "descriptionKey": "CMD_MILITARY_FOCUS_DESC",
    "cost": {
      "wood": 20
    },
    "maxDefense": 20,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.3,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_CAVALRY_SCOUTS",
    "category": "COMMAND",
    "nameKey": "CMD_CAVALRY_SCOUTS_NAME",
    "descriptionKey": "CMD_CAVALRY_SCOUTS_DESC",
    "cost": {
      "food": 30,
      "wood": 20
    },
    "reqDiscoveredResourceTag": "HORSE",
    "reqPlains": 6,
    "reqTrialNotice": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_OUTPOST_SIGNAL",
    "category": "COMMAND",
    "nameKey": "CMD_OUTPOST_SIGNAL_NAME",
    "descriptionKey": "CMD_OUTPOST_SIGNAL_DESC",
    "cost": {
      "wood": 15
    },
    "reqOutpostOrHighGround": true,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_IRON_RAMPART",
    "category": "MILITARY",
    "nameKey": "CMD_IRON_RAMPART_NAME",
    "descriptionKey": "CMD_IRON_RAMPART_DESC",
    "cost": {
      "wood": 20
    },
    "reqWood": 20,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.3,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_BALLISTA_SET",
    "category": "MILITARY",
    "nameKey": "CMD_BALLISTA_SET_NAME",
    "descriptionKey": "CMD_BALLISTA_SET_DESC",
    "cost": {
      "wood": 30
    },
    "reqWood": 30,
    "reqHillOrMountain": true,
    "cyclePolicy": "UNIQUE",
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2
  },
  {
    "id": "CMD_GUIDED_DEFENSE",
    "category": "COMMAND",
    "nameKey": "CMD_GUIDED_DEFENSE_NAME",
    "descriptionKey": "CMD_GUIDED_DEFENSE_DESC",
    "cost": {
      "wood": 20
    },
    "reqConnectedHillOrForest": 3,
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_SCOUT_ENEMY",
    "category": "COMMAND",
    "nameKey": "CMD_SCOUT_ENEMY_NAME",
    "descriptionKey": "CMD_SCOUT_ENEMY_DESC",
    "cost": {
      "food": 5
    },
    "reqTrialNotice": true,
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_SCORCHED_RETREAT",
    "category": "COMMAND",
    "nameKey": "CMD_SCORCHED_RETREAT_NAME",
    "descriptionKey": "CMD_SCORCHED_RETREAT_DESC",
    "cost": {
      "food": 20
    },
    "reqTrialWithin": 3,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_CAVALRY_HOST",
    "category": "COMMAND",
    "nameKey": "CMD_CAVALRY_HOST_NAME",
    "descriptionKey": "CMD_CAVALRY_HOST_DESC",
    "cost": {
      "food": 30,
      "wood": 20
    },
    "reqConnectedPlains": 12,
    "reqFood": 40,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LOCAL_IRON_ARMAMENT",
    "category": "COMMAND",
    "nameKey": "CMD_LOCAL_IRON_ARMAMENT_NAME",
    "descriptionKey": "CMD_LOCAL_IRON_ARMAMENT_DESC",
    "cost": {
      "wood": 15
    },
    "reqDiscoveredResourceTag": "IRON",
    "reqTrialWithin": 6,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_STONE_STRONGPOINT",
    "category": "COMMAND",
    "nameKey": "CMD_STONE_STRONGPOINT_NAME",
    "descriptionKey": "CMD_STONE_STRONGPOINT_DESC",
    "cost": {
      "wood": 20
    },
    "reqDiscoveredResourceTag": "STONE",
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  }
];

export const MYSTIC_CARDS_MASTER = [
  {
    "id": "CMD_MEDITATION",
    "category": "COMMAND",
    "nameKey": "CMD_MEDITATION_NAME",
    "descriptionKey": "CMD_MEDITATION_DESC",
    "cost": {},
    "maxMystic": 20,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.3,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_FILL_THE_VOID",
    "category": "COMMAND",
    "nameKey": "CMD_FILL_THE_VOID_NAME",
    "descriptionKey": "CMD_FILL_THE_VOID_DESC",
    "cost": {},
    "reqMystic": 5,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_VOICE_BENEATH_EARTH",
    "category": "COMMAND",
    "nameKey": "CMD_VOICE_BENEATH_EARTH_NAME",
    "descriptionKey": "CMD_VOICE_BENEATH_EARTH_DESC",
    "cost": {
      "mystic": 5
    },
    "reqDiscoveredResourcesCount": 2,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_OMEN_DREAM",
    "category": "COMMAND",
    "nameKey": "CMD_OMEN_DREAM_NAME",
    "descriptionKey": "CMD_OMEN_DREAM_DESC",
    "cost": {
      "mystic": 5
    },
    "reqTrialWithin": 10,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_REKINDLE_EMBER",
    "category": "MYSTIC",
    "nameKey": "CMD_REKINDLE_EMBER_NAME",
    "descriptionKey": "CMD_REKINDLE_EMBER_DESC",
    "cost": {
      "mystic": 10
    },
    "reqMystic": 10,
    "maxEmber": 5,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MYSTIC_FOCUS",
    "category": "MYSTIC",
    "nameKey": "CMD_MYSTIC_FOCUS_NAME",
    "descriptionKey": "CMD_MYSTIC_FOCUS_DESC",
    "cost": {
      "mystic": 10
    },
    "maxMystic": 30,
    "cyclePolicy": "UNIQUE",
    "minStage": 1,
    "rarity": "R",
    "weight": 0.15
  },
  {
    "id": "CMD_MANIFEST_MIRACLE",
    "category": "COMMAND",
    "nameKey": "CMD_MANIFEST_MIRACLE_NAME",
    "descriptionKey": "CMD_MANIFEST_MIRACLE_DESC",
    "cost": {
      "mystic": 10
    },
    "reqMystic": 10,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_TRANSMUTE_GOLDEN",
    "category": "MYSTIC",
    "nameKey": "CMD_TRANSMUTE_GOLDEN_NAME",
    "descriptionKey": "CMD_TRANSMUTE_GOLDEN_DESC",
    "cost": {
      "mystic": 20
    },
    "reqMystic": 20,
    "reqUnmergedDesertOrMountain": true,
    "cyclePolicy": "UNIQUE",
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2
  },
  {
    "id": "CMD_REVELATION_CHOICE",
    "category": "COMMAND",
    "nameKey": "CMD_REVELATION_CHOICE_NAME",
    "descriptionKey": "CMD_REVELATION_CHOICE_DESC",
    "cost": {
      "mystic": 15
    },
    "reqMystic": 15,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LEYLINE_RESONANCE",
    "category": "COMMAND",
    "nameKey": "CMD_LEYLINE_RESONANCE_NAME",
    "descriptionKey": "CMD_LEYLINE_RESONANCE_DESC",
    "cost": {
      "mystic": 8
    },
    "reqDiscoveredMysticResourcesCount": 2,
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_TWO_FUTURES",
    "category": "COMMAND",
    "nameKey": "CMD_TWO_FUTURES_NAME",
    "descriptionKey": "CMD_TWO_FUTURES_DESC",
    "cost": {
      "mystic": 20
    },
    "reqMystic": 25,
    "cyclePolicy": "UNIQUE",
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1
  }
];

export const COMMAND_CARDS_MASTER = [
  {
    "id": "CMD_RATIONING",
    "category": "COMMAND",
    "nameKey": "CMD_RATIONING_NAME",
    "descriptionKey": "CMD_RATIONING_DESC",
    "cost": {},
    "tags": [
      "FOOD",
      "EMERGENCY"
    ],
    "reqFoodDeficitOrFallback": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.4,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_WETLAND_RECLAMATION",
    "category": "COMMAND",
    "nameKey": "CMD_WETLAND_RECLAMATION_NAME",
    "descriptionKey": "CMD_WETLAND_RECLAMATION_DESC",
    "cost": {
      "wood": 15,
      "ember": 1
    },
    "tags": [
      "WETLAND",
      "RECLAIMED",
      "FOOD",
      "DEVELOPMENT"
    ],
    "reqWetland": 1,
    "reqWood": 15,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LOGGING_CAMP",
    "category": "COMMAND",
    "nameKey": "CMD_LOGGING_CAMP_NAME",
    "descriptionKey": "CMD_LOGGING_CAMP_DESC",
    "cost": {
      "ember": 1
    },
    "tags": [
      "FOREST",
      "MATERIAL",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqForestNearby": 3,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_GRANARY",
    "category": "COMMAND",
    "nameKey": "CMD_GRANARY_NAME",
    "descriptionKey": "CMD_GRANARY_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "STORAGE",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqPlains": 4,
    "reqWood": 20,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_AGRICULTURAL_REFORM",
    "category": "COMMAND",
    "nameKey": "CMD_AGRICULTURAL_REFORM_NAME",
    "descriptionKey": "CMD_AGRICULTURAL_REFORM_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "AGRICULTURE",
      "DEVELOPMENT"
    ],
    "reqConnectedPlainsOrReclaimed": 3,
    "reqWood": 20,
    "minStage": 1,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_PASTORAL_FARM",
    "category": "COMMAND",
    "nameKey": "CMD_PASTORAL_FARM_NAME",
    "descriptionKey": "CMD_PASTORAL_FARM_DESC",
    "cost": {
      "wood": 15
    },
    "tags": [
      "PLAINS",
      "LIVESTOCK",
      "FOOD",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTag": "LIVESTOCK",
    "reqPlains": 4,
    "reqWood": 15,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_ABANDONED_SETTLEMENT",
    "category": "COMMAND",
    "nameKey": "CMD_ABANDONED_SETTLEMENT_NAME",
    "descriptionKey": "CMD_ABANDONED_SETTLEMENT_DESC",
    "cost": {
      "ember": 1
    },
    "tags": [
      "EXPLORATION",
      "EVENT",
      "RESOURCE"
    ],
    "reqEmptyCells": 8,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_EMERGENCY_LEVY",
    "category": "COMMAND",
    "nameKey": "CMD_EMERGENCY_LEVY_NAME",
    "descriptionKey": "CMD_EMERGENCY_LEVY_DESC",
    "cost": {
      "food": 20
    },
    "tags": [
      "FOOD",
      "MATERIAL",
      "EMERGENCY"
    ],
    "reqWoodDeficit": true,
    "reqFood": 20,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_SAWMILL",
    "category": "COMMAND",
    "nameKey": "CMD_SAWMILL_NAME",
    "descriptionKey": "CMD_SAWMILL_DESC",
    "cost": {
      "wood": 25
    },
    "tags": [
      "FOREST",
      "MATERIAL",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqLoggingCamp": 1,
    "reqWood": 25,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_QUARRY",
    "category": "COMMAND",
    "nameKey": "CMD_QUARRY_NAME",
    "descriptionKey": "CMD_QUARRY_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "HILL",
      "STONE",
      "MATERIAL",
      "EXTRACTION",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTag": "STONE",
    "reqHill": 1,
    "reqWood": 20,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MINE",
    "category": "COMMAND",
    "nameKey": "CMD_MINE_NAME",
    "descriptionKey": "CMD_MINE_DESC",
    "cost": {
      "wood": 25
    },
    "tags": [
      "HILL",
      "MOUNTAIN",
      "ORE",
      "MATERIAL",
      "MYSTIC",
      "EXTRACTION",
      "SPECIAL_BLOCK"
    ],
    "reqOreSocket": true,
    "reqWood": 25,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_STABLE",
    "category": "COMMAND",
    "nameKey": "CMD_STABLE_NAME",
    "descriptionKey": "CMD_STABLE_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "PLAINS",
      "LIVESTOCK",
      "MOBILITY",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTag": "HORSE",
    "reqPlains": 6,
    "reqWood": 20,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LIME_KILN",
    "category": "COMMAND",
    "nameKey": "CMD_LIME_KILN_NAME",
    "descriptionKey": "CMD_LIME_KILN_DESC",
    "cost": {
      "food": 10,
      "wood": 15
    },
    "tags": [
      "STONE",
      "FOREST",
      "MATERIAL",
      "CONSTRUCTION",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqDiscoveredResourceTags": [
      "STONE",
      "WOOD"
    ],
    "reqFood": 10,
    "reqWood": 15,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MARKET",
    "category": "COMMAND",
    "nameKey": "CMD_MARKET_NAME",
    "descriptionKey": "CMD_MARKET_DESC",
    "cost": {
      "wood": 25
    },
    "tags": [
      "LINK",
      "RESOURCE",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqMinLinks": 2,
    "reqWood": 25,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_DEPOT",
    "category": "COMMAND",
    "nameKey": "CMD_DEPOT_NAME",
    "descriptionKey": "CMD_DEPOT_DESC",
    "cost": {
      "wood": 30
    },
    "tags": [
      "MATERIAL",
      "STORAGE",
      "LINK",
      "INDUSTRY",
      "SPECIAL_BLOCK"
    ],
    "reqIndustrySpecialBlocks": 2,
    "reqWood": 30,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_IRRIGATION",
    "category": "COMMAND",
    "nameKey": "CMD_IRRIGATION_NAME",
    "descriptionKey": "CMD_IRRIGATION_DESC",
    "cost": {
      "wood": 20
    },
    "tags": [
      "WATER",
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "DEVELOPMENT"
    ],
    "reqWaterSource": true,
    "reqPlainsOrReclaimed": 1,
    "reqWood": 20,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_RESETTLEMENT",
    "category": "COMMAND",
    "nameKey": "CMD_RESETTLEMENT_NAME",
    "descriptionKey": "CMD_RESETTLEMENT_DESC",
    "cost": {
      "food": 15,
      "wood": 10
    },
    "tags": [
      "PLAINS",
      "MERGE",
      "FOOD",
      "DEVELOPMENT"
    ],
    "reqPlainsMerge2x2": 1,
    "reqFood": 15,
    "reqWood": 10,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_WORKSHOP",
    "category": "COMMAND",
    "nameKey": "CMD_WORKSHOP_NAME",
    "descriptionKey": "CMD_WORKSHOP_DESC",
    "cost": {
      "wood": 30
    },
    "tags": [
      "MATERIAL",
      "INDUSTRY",
      "CONSTRUCTION",
      "SPECIAL_BLOCK"
    ],
    "reqDistinctPrimaryIndustries": 2,
    "reqWood": 30,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_GRANARY_NETWORK",
    "category": "COMMAND",
    "nameKey": "CMD_GRANARY_NETWORK_NAME",
    "descriptionKey": "CMD_GRANARY_NETWORK_DESC",
    "cost": {
      "wood": 50
    },
    "tags": [
      "FOOD",
      "STORAGE",
      "LINK",
      "PROJECT"
    ],
    "reqGranaries": 2,
    "reqWood": 50,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_INDUSTRIAL_ROAD",
    "category": "COMMAND",
    "nameKey": "CMD_INDUSTRIAL_ROAD_NAME",
    "descriptionKey": "CMD_INDUSTRIAL_ROAD_DESC",
    "cost": {
      "wood": 45
    },
    "tags": [
      "ROAD",
      "LINK",
      "INDUSTRY",
      "PROJECT"
    ],
    "reqIndustrySpecialBlocks": 2,
    "reqWood": 45,
    "minStage": 3,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_IRRIGATION_NETWORK",
    "category": "COMMAND",
    "nameKey": "CMD_IRRIGATION_NETWORK_NAME",
    "descriptionKey": "CMD_IRRIGATION_NETWORK_DESC",
    "cost": {
      "wood": 50
    },
    "tags": [
      "WATER",
      "PLAINS",
      "RECLAIMED",
      "FOOD",
      "PROJECT"
    ],
    "reqIrrigationDone": true,
    "reqWaterSource": true,
    "reqWood": 50,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_INDUSTRIAL_CLUSTER",
    "category": "COMMAND",
    "nameKey": "CMD_INDUSTRIAL_CLUSTER_NAME",
    "descriptionKey": "CMD_INDUSTRIAL_CLUSTER_DESC",
    "cost": {
      "wood": 60
    },
    "tags": [
      "INDUSTRY",
      "LINK",
      "PROJECT"
    ],
    "reqLinkedDistinctIndustries": 3,
    "reqWood": 60,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_GREAT_RAMPART_PROJECT",
    "category": "COMMAND",
    "nameKey": "CMD_GREAT_RAMPART_PROJECT_NAME",
    "descriptionKey": "CMD_GREAT_RAMPART_PROJECT_DESC",
    "cost": {
      "wood": 70
    },
    "tags": [
      "CONSTRUCTION",
      "DEFENSE",
      "PROJECT"
    ],
    "reqLargeTerritory": true,
    "reqWood": 70,
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1,
    "cyclePolicy": "UNIQUE"
  },
  {
    "id": "CMD_VIGILANCE",
    "category": "COMMAND",
    "nameKey": "CMD_VIGILANCE_NAME",
    "descriptionKey": "CMD_VIGILANCE_DESC",
    "cost": {
      "wood": 15
    },
    "reqTrialOrLowDefense": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MUD_OBSTACLE",
    "category": "COMMAND",
    "nameKey": "CMD_MUD_OBSTACLE_NAME",
    "descriptionKey": "CMD_MUD_OBSTACLE_DESC",
    "cost": {
      "wood": 15
    },
    "reqWetlandOrLake": true,
    "reqTrialNotice": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_HIGH_GROUND_FORMATION",
    "category": "COMMAND",
    "nameKey": "CMD_HIGH_GROUND_FORMATION_NAME",
    "descriptionKey": "CMD_HIGH_GROUND_FORMATION_DESC",
    "cost": {
      "wood": 10
    },
    "reqHillOrMountain": true,
    "reqTrialNotice": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MILITARY_FOCUS",
    "category": "MILITARY",
    "nameKey": "CMD_MILITARY_FOCUS_NAME",
    "descriptionKey": "CMD_MILITARY_FOCUS_DESC",
    "cost": {
      "wood": 20
    },
    "maxDefense": 20,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.3,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_CAVALRY_SCOUTS",
    "category": "COMMAND",
    "nameKey": "CMD_CAVALRY_SCOUTS_NAME",
    "descriptionKey": "CMD_CAVALRY_SCOUTS_DESC",
    "cost": {
      "food": 30,
      "wood": 20
    },
    "reqDiscoveredResourceTag": "HORSE",
    "reqPlains": 6,
    "reqTrialNotice": true,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_OUTPOST_SIGNAL",
    "category": "COMMAND",
    "nameKey": "CMD_OUTPOST_SIGNAL_NAME",
    "descriptionKey": "CMD_OUTPOST_SIGNAL_DESC",
    "cost": {
      "wood": 15
    },
    "reqOutpostOrHighGround": true,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_IRON_RAMPART",
    "category": "MILITARY",
    "nameKey": "CMD_IRON_RAMPART_NAME",
    "descriptionKey": "CMD_IRON_RAMPART_DESC",
    "cost": {
      "wood": 20
    },
    "reqWood": 20,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.3,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_BALLISTA_SET",
    "category": "MILITARY",
    "nameKey": "CMD_BALLISTA_SET_NAME",
    "descriptionKey": "CMD_BALLISTA_SET_DESC",
    "cost": {
      "wood": 30
    },
    "reqWood": 30,
    "reqHillOrMountain": true,
    "cyclePolicy": "UNIQUE",
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2
  },
  {
    "id": "CMD_GUIDED_DEFENSE",
    "category": "COMMAND",
    "nameKey": "CMD_GUIDED_DEFENSE_NAME",
    "descriptionKey": "CMD_GUIDED_DEFENSE_DESC",
    "cost": {
      "wood": 20
    },
    "reqConnectedHillOrForest": 3,
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_SCOUT_ENEMY",
    "category": "COMMAND",
    "nameKey": "CMD_SCOUT_ENEMY_NAME",
    "descriptionKey": "CMD_SCOUT_ENEMY_DESC",
    "cost": {
      "food": 5
    },
    "reqTrialNotice": true,
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_SCORCHED_RETREAT",
    "category": "COMMAND",
    "nameKey": "CMD_SCORCHED_RETREAT_NAME",
    "descriptionKey": "CMD_SCORCHED_RETREAT_DESC",
    "cost": {
      "food": 20
    },
    "reqTrialWithin": 3,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_CAVALRY_HOST",
    "category": "COMMAND",
    "nameKey": "CMD_CAVALRY_HOST_NAME",
    "descriptionKey": "CMD_CAVALRY_HOST_DESC",
    "cost": {
      "food": 30,
      "wood": 20
    },
    "reqConnectedPlains": 12,
    "reqFood": 40,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LOCAL_IRON_ARMAMENT",
    "category": "COMMAND",
    "nameKey": "CMD_LOCAL_IRON_ARMAMENT_NAME",
    "descriptionKey": "CMD_LOCAL_IRON_ARMAMENT_DESC",
    "cost": {
      "wood": 15
    },
    "reqDiscoveredResourceTag": "IRON",
    "reqTrialWithin": 6,
    "minStage": 2,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_STONE_STRONGPOINT",
    "category": "COMMAND",
    "nameKey": "CMD_STONE_STRONGPOINT_NAME",
    "descriptionKey": "CMD_STONE_STRONGPOINT_DESC",
    "cost": {
      "wood": 20
    },
    "reqDiscoveredResourceTag": "STONE",
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MEDITATION",
    "category": "COMMAND",
    "nameKey": "CMD_MEDITATION_NAME",
    "descriptionKey": "CMD_MEDITATION_DESC",
    "cost": {},
    "maxMystic": 20,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.3,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_FILL_THE_VOID",
    "category": "COMMAND",
    "nameKey": "CMD_FILL_THE_VOID_NAME",
    "descriptionKey": "CMD_FILL_THE_VOID_DESC",
    "cost": {},
    "reqMystic": 5,
    "minStage": 1,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_VOICE_BENEATH_EARTH",
    "category": "COMMAND",
    "nameKey": "CMD_VOICE_BENEATH_EARTH_NAME",
    "descriptionKey": "CMD_VOICE_BENEATH_EARTH_DESC",
    "cost": {
      "mystic": 5
    },
    "reqDiscoveredResourcesCount": 2,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_OMEN_DREAM",
    "category": "COMMAND",
    "nameKey": "CMD_OMEN_DREAM_NAME",
    "descriptionKey": "CMD_OMEN_DREAM_DESC",
    "cost": {
      "mystic": 5
    },
    "reqTrialWithin": 10,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_REKINDLE_EMBER",
    "category": "MYSTIC",
    "nameKey": "CMD_REKINDLE_EMBER_NAME",
    "descriptionKey": "CMD_REKINDLE_EMBER_DESC",
    "cost": {
      "mystic": 10
    },
    "reqMystic": 10,
    "maxEmber": 5,
    "minStage": 1,
    "rarity": "UC",
    "weight": 0.25,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_MYSTIC_FOCUS",
    "category": "MYSTIC",
    "nameKey": "CMD_MYSTIC_FOCUS_NAME",
    "descriptionKey": "CMD_MYSTIC_FOCUS_DESC",
    "cost": {
      "mystic": 10
    },
    "maxMystic": 30,
    "cyclePolicy": "UNIQUE",
    "minStage": 1,
    "rarity": "R",
    "weight": 0.15
  },
  {
    "id": "CMD_MANIFEST_MIRACLE",
    "category": "COMMAND",
    "nameKey": "CMD_MANIFEST_MIRACLE_NAME",
    "descriptionKey": "CMD_MANIFEST_MIRACLE_DESC",
    "cost": {
      "mystic": 10
    },
    "reqMystic": 10,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_TRANSMUTE_GOLDEN",
    "category": "MYSTIC",
    "nameKey": "CMD_TRANSMUTE_GOLDEN_NAME",
    "descriptionKey": "CMD_TRANSMUTE_GOLDEN_DESC",
    "cost": {
      "mystic": 20
    },
    "reqMystic": 20,
    "reqUnmergedDesertOrMountain": true,
    "cyclePolicy": "UNIQUE",
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2
  },
  {
    "id": "CMD_REVELATION_CHOICE",
    "category": "COMMAND",
    "nameKey": "CMD_REVELATION_CHOICE_NAME",
    "descriptionKey": "CMD_REVELATION_CHOICE_DESC",
    "cost": {
      "mystic": 15
    },
    "reqMystic": 15,
    "minStage": 2,
    "rarity": "R",
    "weight": 0.2,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_LEYLINE_RESONANCE",
    "category": "COMMAND",
    "nameKey": "CMD_LEYLINE_RESONANCE_NAME",
    "descriptionKey": "CMD_LEYLINE_RESONANCE_DESC",
    "cost": {
      "mystic": 8
    },
    "reqDiscoveredMysticResourcesCount": 2,
    "minStage": 2,
    "rarity": "C",
    "weight": 0.35,
    "cyclePolicy": "RARITY"
  },
  {
    "id": "CMD_TWO_FUTURES",
    "category": "COMMAND",
    "nameKey": "CMD_TWO_FUTURES_NAME",
    "descriptionKey": "CMD_TWO_FUTURES_DESC",
    "cost": {
      "mystic": 20
    },
    "reqMystic": 25,
    "cyclePolicy": "UNIQUE",
    "minStage": 3,
    "rarity": "UR",
    "weight": 0.1
  }
];

if (typeof window !== "undefined") {
    window.COMMAND_CARDS_MASTER = COMMAND_CARDS_MASTER;
}
if (typeof globalThis !== "undefined") {
    globalThis.COMMAND_CARDS_MASTER = COMMAND_CARDS_MASTER;
}
export default COMMAND_CARDS_MASTER;
