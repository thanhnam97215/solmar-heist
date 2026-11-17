// Solmar Heist — tuning, layout and palette. One place for every number the
// rest of the game reads, so a balance pass touches this file and no other.
export const WORLD = {
  half: 240, // city spans -240..240 on x and z
  roadHalf: 6, // roads are 12 units wide
  blockPitch: 60, // distance between road centrelines
  beachX: 198, // sand starts here
  oceanX: 256, // water starts here; cars and people stop at the shore
  sidewalk: 3, // pavement ring around each block
};

export const ROADS = [-180, -120, -60, 0, 60, 120, 180];

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  radius: 0.7,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.2,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 22,
  brake: 34,
  maxSpeed: 46, // about 165 km/h at the scale of this city
  maxReverse: 12,
  steerRate: 1.9,
  grip: 6.5,
  handbrakeGrip: 1.6,
  radius: 1.6,
  maxHealth: 100,
};

export const TRAFFIC = {
  count: 26,
  parkedCount: 14,
  cruiseSpeed: 11,
};

export const PEDS = {
  count: 34,
  walkSpeed: 1.6,
  fleeSpeed: 5.5,
};

export const WANTED = {
  decaySeconds: 14, // one star lost after this long unseen
  bustSeconds: 2.5, // standing next to a cop car this long gets you busted
  bustRange: 6,
  maxStars: 5,
};

export const COMBAT = {
  magSize: 12,
  startReserve: 48,
  damage: 34,
  range: 90,
  fireCooldown: 0.16,
  reloadSeconds: 1.1,
};

export const SAVE_KEY = 'solmar-heist-save-v1';

// Fixed story locations, all on road intersections so every objective is
// reachable by car. x = east, z = south; the beach is the east edge.
export const PLACES = {
  spawn: { x: -54, z: -54, label: 'Solmar Bay' },
  garage: { x: -54, z: -60, label: "Rico's Garage" },
  diner: { x: 54, z: -120, label: 'Sunset Diner' },
  pier: { x: 196, z: 60, label: 'Solmar Pier' },
  warehouse: { x: -180, z: 114, label: 'Harbor Warehouse' },
  beachClub: { x: 196, z: -60, label: 'Coral Beach Club' },
  bank: { x: 6, z: 60, label: 'Meridian Bank' },
  safehouse: { x: -120, z: 180, label: 'Safehouse' },
  policeStation: { x: 120, z: 120, label: 'Solmar Police HQ' },
  hospital: { x: -60, z: 180, label: 'St. Alba Hospital' },
  rivalStart: { x: 180, z: -180, label: 'North Docks' },
  vault: { x: 12, z: 66, label: 'Bank Vault' },
};

export const PALETTE = {
  sky: 0x87c5e8,
  sun: 0xfff2d0,
  ground: 0x9aa08a,
  sidewalk: 0xb9b3a4,
  road: 0x3a3d42,
  roadLine: 0xd8d3a8,
  sand: 0xe8d49a,
  ocean: 0x2f7fb8,
  building: [0xd8cdb8, 0xc4b49a, 0xb8c4c4, 0xd8b8a0, 0xa8b8c8, 0xc8c8b0, 0xe0d8c8],
  glass: 0x7fb8d8,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3f9a4a,
  carColors: [0xc23b2e, 0x2e6ac2, 0xe8c23a, 0x3aa86a, 0x8a4ac2, 0xe8e8e8, 0x222226, 0xd87828, 0x38b8c2, 0xb8b8b8],
};
