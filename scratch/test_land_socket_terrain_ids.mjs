import assert from 'node:assert/strict';
import fs from 'node:fs';

import { LAND_SYSTEM_DATA } from '../game/src/data/land_system.js';

const jsonData = JSON.parse(
  fs.readFileSync(new URL('../game/src/data/land_system.json', import.meta.url), 'utf8')
);

const sortedKeys = value => Object.keys(value || {}).sort();
const naturalTerrainKeys = data => Object.entries(data.terrains || {})
  .filter(([, terrain]) => terrain?.isArtificialTerrain !== true)
  .map(([terrainId]) => terrainId)
  .sort();

assert.deepEqual(
  sortedKeys(LAND_SYSTEM_DATA.sockets),
  naturalTerrainKeys(LAND_SYSTEM_DATA),
  'Every natural canonical terrain must have exactly one Socket pool and no orphan Socket terrainId may remain'
);

assert.deepEqual(
  sortedKeys(jsonData.sockets),
  naturalTerrainKeys(jsonData),
  'land_system.json natural terrain IDs and Socket keys must stay canonical and aligned'
);

assert.deepEqual(
  sortedKeys(LAND_SYSTEM_DATA.sockets),
  sortedKeys(jsonData.sockets),
  'land_system.js and land_system.json Socket terrainId keys must stay synchronized'
);

assert.equal(
  Object.hasOwn(LAND_SYSTEM_DATA.sockets, 'E2_WASTELAND'),
  false,
  'legacy E2_WASTELAND Socket key must not return'
);
assert.equal(
  Object.hasOwn(LAND_SYSTEM_DATA.sockets, 'E2_DEEP_FOREST_HILL'),
  false,
  'legacy E2_DEEP_FOREST_HILL Socket key must not return'
);

assert.ok(
  LAND_SYSTEM_DATA.sockets.E2_DESERT_HILL?.some(socket => socket.id === 'SOCKET_LIMESTONE'),
  'E2_DESERT_HILL must retain the former wasteland Socket pool'
);
assert.ok(
  LAND_SYSTEM_DATA.sockets.E2_DEEP_HILL?.some(socket => socket.id === 'SOCKET_FIR'),
  'E2_DEEP_HILL must retain the former deep-forest-hill Socket pool'
);

assert.equal(
  LAND_SYSTEM_DATA.terrains.E1_RECLAIMED_LAND?.isArtificialTerrain,
  true,
  'artificial reclaimed land remains intentionally outside the natural Socket pool contract'
);

console.log('LAND_SOCKET_TERRAIN_ID_CANONICALIZATION_OK');
