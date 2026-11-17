// Solmar Bay: a procedural sun-soaked coastal city. A grid of roads, blocks
// of buildings with lit-window textures, a palm-lined beach boulevard and an
// ocean to the east. The module also owns collision (building boxes, the
// shoreline, the city edge) and the glowing mission beacons.
import * as THREE from 'three';
import { PALETTE, ROADS, WORLD } from './config.js';

function windowTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#5a6a78';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 20) {
      const lit = rng.chance(0.3);
      g.fillStyle = lit ? '#ffd98a' : '#2c3a48';
      g.fillRect(x, y, 12, 14);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#d8d3a8';
  for (let y = 0; y < 256; y += 32) g.fillRect(30, y + 4, 4, 18);
  g.fillStyle = '#c8c8c8';
  g.fillRect(2, 0, 2, 256);
  g.fillRect(60, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 30);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBeacon(color) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
  dot.position.y = 26;
  group.add(beam);
  group.add(ring);
  group.add(dot);
  group.userData.update = (time) => {
    const pulse = 0.75 + Math.sin(time * 3) * 0.25;
    ring.scale.setScalar(pulse);
    beam.material.opacity = 0.28 + Math.sin(time * 3) * 0.12;
    dot.position.y = 26 + Math.sin(time * 2) * 1.2;
  };
  return group;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const windows = windowTexture(rng);
  const roadTex = roadTexture();
  const materials = PALETTE.building.map(
    (color) => new THREE.MeshLambertMaterial({ color, map: windows }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 220, 620);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.45));

  // Ground, sand, ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(227, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 760),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(416, 0.05, 0);
  scene.add(ocean);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 560),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(256, 0.09, 0);
  scene.add(foam);

  // Boardwalk along the beach.
  const boardwalk = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 480),
    new THREE.MeshLambertMaterial({ color: 0xc8a878 }),
  );
  boardwalk.rotation.x = -Math.PI / 2;
  boardwalk.position.set(193, 0.03, 0);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);

  // Roads: one textured strip per avenue and street. The east-west strips use
  // a 90-degree-rotated copy of the texture so their dashes run along the
  // road, and sit a hair higher so crossings never z-fight.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadTexEW = roadTex.clone();
  roadTexEW.center.set(0.5, 0.5);
  roadTexEW.rotation = Math.PI / 2;
  roadTexEW.needsUpdate = true;
  const roadMatEW = new THREE.MeshLambertMaterial({ map: roadTexEW });
  for (const c of ROADS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(12, 480), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.04, 0);
    ns.receiveShadow = true;
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(480, 12), roadMatEW);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.045, c);
    ew.receiveShadow = true;
    scene.add(ew);
  }

  // Blocks: sidewalk slabs and buildings.
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const blockCentres = [];
  for (let i = 0; i < ROADS.length - 1; i += 1) {
    blockCentres.push((ROADS[i] + ROADS[i + 1]) / 2);
  }
  blockCentres.push(ROADS[ROADS.length - 1] + 30);
  blockCentres.unshift(ROADS[0] - 30);

  const signDefs = [
    { text: 'MERIDIAN BANK', x: 30, z: 90, bg: '#1c2a44', fg: '#ffd76a' },
    { text: "RICO'S GARAGE", x: -30, z: -90, bg: '#40281c', fg: '#ffb37a' },
    { text: 'SUNSET DINER', x: 30, z: -150, bg: '#3c1c2c', fg: '#ff9ac2' },
    { text: 'CORAL CLUB', x: 150, z: -90, bg: '#0c3a44', fg: '#7ae8d8' },
  ];

  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      if (bx > 170) continue; // beach blocks stay open
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), sidewalkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(bx, 0.015, bz);
      slab.receiveShadow = true;
      scene.add(slab);

      const distCentre = Math.hypot(bx, bz);
      const downtown = Math.max(0, 1 - distCentre / 320);
      const lots = rng.chance(0.45) ? 1 : rng.chance(0.6) ? 2 : 4;
      for (let lot = 0; lot < lots; lot += 1) {
        const cols = lots === 4 ? 2 : lots === 2 ? 2 : 1;
        const rows = lots === 4 ? 2 : 1;
        const lx = bx + (lots === 1 ? 0 : (lot % cols) * 24 - 12);
        const lz = bz + (lots === 4 ? Math.floor(lot / 2) * 24 - 12 : 0);
        const w = lots === 1 ? rng.range(26, 36) : rng.range(14, 20);
        const d = lots === 1 ? rng.range(26, 36) : lots === 4 ? rng.range(14, 20) : rng.range(20, 30);
        const h = 8 + downtown * rng.range(18, 34) + rng.range(0, 10);
        const tex = windows.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const mat = new THREE.MeshLambertMaterial({
          color: rng.pick(PALETTE.building),
          map: tex,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        building.position.set(lx, h / 2, lz);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
        roof.position.set(lx, h + 0.25, lz);
        scene.add(roof);
        colliders.push({ minX: lx - w / 2, maxX: lx + w / 2, minZ: lz - d / 2, maxZ: lz + d / 2 });
      }
    }
  }

  // Signs on the story buildings.
  for (const def of signDefs) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 3.75),
      new THREE.MeshBasicMaterial({ map: signTexture(def.text, def.bg, def.fg) }),
    );
    sign.position.set(def.x, 7, def.z - 18.5);
    scene.add(sign);
  }

  // Palms along the beach boulevard and scattered on blocks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const crownGeo = new THREE.ConeGeometry(2.4, 2.6, 7);
  function plantPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3;
    trunk.rotation.z = rng.range(-0.12, 0.12);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(crownGeo, leafMat);
    crown.position.y = 6.8;
    crown.rotation.x = Math.PI;
    crown.scale.y = 0.7;
    crown.castShadow = true;
    palm.add(trunk);
    palm.add(crown);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(palm);
  }
  for (let z = -225; z <= 225; z += 18) {
    plantPalm(199, z + rng.range(-3, 3));
    if (rng.chance(0.5)) plantPalm(188, z + rng.range(-4, 4));
  }
  for (let i = 0; i < 26; i += 1) {
    const bx = rng.pick(blockCentres.filter((v) => v <= 150));
    const bz = rng.pick(blockCentres);
    plantPalm(bx + rng.range(-22, 22), bz + rng.range(-22, 22));
  }

  // Lamp posts along every road, instanced to keep draw calls low.
  const lampPositions = [];
  for (const c of ROADS) {
    for (let t = -225; t <= 225; t += 30) {
      lampPositions.push([c + 7.5, t]);
      lampPositions.push([t, c + 7.5]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
  const headGeo = new THREE.BoxGeometry(1.6, 0.3, 0.5);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampPositions.length);
  const dummy = new THREE.Object3D();
  lampPositions.forEach(([x, z], i) => {
    dummy.position.set(x, 3.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 7, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles);
  scene.add(heads);

  function isOnRoad(x, z) {
    for (const c of ROADS) {
      if (Math.abs(x - c) < WORLD.roadHalf || Math.abs(z - c) < WORLD.roadHalf) return true;
    }
    return false;
  }

  // Push a circle out of every building box and the world bounds. Mutates
  // `pos` (a Vector3, x/z used) and returns true when anything was hit.
  function collideCircle(pos, radius) {
    let hit = false;
    for (const box of colliders) {
      const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        hit = true;
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          pos.x = cx + (dx / dist) * radius;
          pos.z = cz + (dz / dist) * radius;
        } else {
          // Dead centre of a box (should not happen): shove it out along x.
          pos.x = box.maxX + radius;
        }
      }
    }
    const edge = WORLD.half - 2;
    if (pos.x < -edge) { pos.x = -edge; hit = true; }
    if (pos.x > WORLD.oceanX - 4) { pos.x = WORLD.oceanX - 4; hit = true; }
    if (pos.z < -edge) { pos.z = -edge; hit = true; }
    if (pos.z > edge) { pos.z = edge; hit = true; }
    return hit;
  }

  function nearestRoad(x, z) {
    let best = ROADS[0];
    let bestDist = Infinity;
    for (const c of ROADS) {
      const d = Math.min(Math.abs(x - c), Math.abs(z - c));
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  function randomRoadPoint(rngInstance) {
    const axis = rngInstance.chance(0.5) ? 'x' : 'z';
    const coord = rngInstance.pick(ROADS);
    const along = rngInstance.range(-210, 210);
    return axis === 'x' ? { x: coord, z: along } : { x: along, z: coord };
  }

  function randomSidewalkPoint(rngInstance) {
    const bx = rngInstance.pick(blockCentres.filter((v) => v <= 150));
    const bz = rngInstance.pick(blockCentres);
    const side = rngInstance.int(0, 3);
    const t = rngInstance.range(-22, 22);
    if (side === 0) return { x: bx + t, z: bz - 23 };
    if (side === 1) return { x: bx + t, z: bz + 23 };
    if (side === 2) return { x: bx - 23, z: bz + t };
    return { x: bx + 23, z: bz + t };
  }

  return {
    colliders,
    sun,
    isOnRoad,
    collideCircle,
    nearestRoad,
    randomRoadPoint,
    randomSidewalkPoint,
  };
}
