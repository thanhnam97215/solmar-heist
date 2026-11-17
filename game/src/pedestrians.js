// Pedestrians: low-poly people who stroll the sidewalks, scatter when a car
// bears down on them or a shot rings out, and fall when hurt. The same
// person factory builds the player, so the city reads as one cast.
import * as THREE from 'three';
import { PEDS } from './config.js';

const SKIN = [0xe8b88a, 0xc98a5a, 0x8a5a38, 0xf0c8a0, 0x6a4530];
const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe8e8e8, 0x4ad8d8, 0xd87a4a];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x2a5a3a, 0x6a6a7a];

export function makePersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, 1.2), new THREE.MeshLambertMaterial({ color: 0x2a1c12 }));
  hair.position.y = 1.76;
  group.add(hair);
  const legs = [];
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.24), pantsMat);
    leg.position.set(x, 0.4, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const x of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.2), shirtMat);
    arm.position.set(x, 1.15, 0);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

function walkCycle(mesh, phase, amount) {
  const swing = Math.sin(phase) * 0.55 * amount;
  mesh.userData.legs[0].rotation.x = swing;
  mesh.userData.legs[1].rotation.x = -swing;
  mesh.userData.arms[0].rotation.x = -swing * 0.8;
  mesh.userData.arms[1].rotation.x = swing * 0.8;
}

export function createPedestrians(scene, city, rng) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const start = city.randomSidewalkPoint(rng);
    const mesh = makePersonMesh(rng.pick(SHIRTS), rng.pick(PANTS), rng.pick(SKIN));
    mesh.position.set(start.x, 0, start.z);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      heading: rng.range(0, Math.PI * 2),
      speed: PEDS.walkSpeed * rng.range(0.8, 1.25),
      state: 'walk',
      target: city.randomSidewalkPoint(rng),
      fleeUntil: 0,
      downUntil: 0,
      phase: rng.range(0, Math.PI * 2),
      health: 100,
    };
    mesh.userData.owner = ped; // lets raycasts find the person they hit
    peds.push(ped);
  }

  function scare(ped, fromX, fromZ, now) {
    if (ped.state === 'down') return;
    ped.state = 'flee';
    ped.fleeUntil = now + 4;
    const dx = ped.pos.x - fromX;
    const dz = ped.pos.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    ped.target = { x: ped.pos.x + (dx / len) * 30, z: ped.pos.z + (dz / len) * 30 };
  }

  return {
    peds,
    // A gunshot or a screeching car scatters everyone nearby.
    scareNear(x, z, radius, now) {
      for (const ped of peds) {
        if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) scare(ped, x, z, now);
      }
    },
    hitPed(ped, damage, now) {
      if (ped.state === 'down') return false;
      ped.health -= damage;
      if (ped.health <= 0) {
        ped.state = 'down';
        ped.downUntil = now + 12;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.25;
        return true; // killed
      }
      scare(ped, ped.pos.x - Math.sin(ped.heading), ped.pos.z - Math.cos(ped.heading), now);
      return false;
    },
    nearestPed(pos, maxDist) {
      let best = null;
      let bestDist = maxDist;
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          best = ped;
        }
      }
      return best;
    },
    update(dt, now, player) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          if (now > ped.downUntil) {
            const start = city.randomSidewalkPoint(rng);
            ped.pos.set(start.x, 0, start.z);
            ped.mesh.rotation.x = 0;
            ped.mesh.position.y = 0;
            ped.health = 100;
            ped.state = 'walk';
            ped.target = city.randomSidewalkPoint(rng);
          }
          continue;
        }
        if (ped.state === 'flee' && now > ped.fleeUntil) {
          ped.state = 'walk';
          ped.target = city.randomSidewalkPoint(rng);
        }
        // A fast car nearby sends them running.
        if (player && player.mode === 'car' && player.car) {
          const d = Math.hypot(ped.pos.x - player.car.pos.x, ped.pos.z - player.car.pos.z);
          if (d < 7 && Math.abs(player.car.speed) > 8 && ped.state !== 'flee') {
            scare(ped, player.car.pos.x, player.car.pos.z, now);
          }
        }
        const dx = ped.target.x - ped.pos.x;
        const dz = ped.target.z - ped.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5) {
          ped.target = ped.state === 'flee' ? city.randomSidewalkPoint(rng) : city.randomSidewalkPoint(rng);
          if (ped.state === 'flee') ped.state = 'walk';
          continue;
        }
        const speed = ped.state === 'flee' ? PEDS.fleeSpeed : ped.speed;
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += diff * Math.min(1, dt * 6);
        ped.pos.x += Math.sin(ped.heading) * speed * dt;
        ped.pos.z += Math.cos(ped.heading) * speed * dt;
        city.collideCircle(ped.pos, 0.5);
        ped.mesh.rotation.y = ped.heading;
        ped.phase += dt * speed * 1.6;
        walkCycle(ped.mesh, ped.phase, 1);
      }
    },
  };
}
