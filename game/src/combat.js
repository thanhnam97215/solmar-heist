// Combat: a pistol with a magazine and reserve ammo, raycast shots with a
// tracer and muzzle flash, and a melee punch. Shooting people and cars is a
// crime — the caller raises the wanted level for it.
import * as THREE from 'three';
import { COMBAT, PLAYER } from './config.js';
import { damageCar } from './vehicles.js';

export function createCombat(scene, world) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = COMBAT.range;
  let ammo = COMBAT.magSize;
  let reserve = COMBAT.startReserve;
  let cooldown = 0;
  let punchCooldown = 0;
  let reloading = 0;

  // A small pool of tracer lines, reused so shooting allocates nothing.
  const tracers = [];
  for (let i = 0; i < 6; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }),
    );
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerCursor = 0;

  function fireTracer(from, to) {
    const tracer = tracers[tracerCursor];
    tracerCursor = (tracerCursor + 1) % tracers.length;
    const attr = tracer.line.geometry.attributes.position;
    attr.setXYZ(0, from.x, from.y, from.z);
    attr.setXYZ(1, to.x, to.y, to.z);
    attr.needsUpdate = true;
    tracer.line.material.opacity = 0.9;
    tracer.life = 0.07;
  }

  function ownerOf(object) {
    let node = object;
    while (node) {
      if (node.userData && node.userData.owner) return node.userData.owner;
      node = node.parent;
    }
    return null;
  }

  return {
    get ammo() {
      return ammo;
    },
    get reserve() {
      return reserve;
    },
    get reloading() {
      return reloading > 0;
    },
    addAmmo(n) {
      reserve += n;
    },
    startReload() {
      if (reloading > 0 || ammo >= COMBAT.magSize || reserve <= 0) return false;
      reloading = COMBAT.reloadSeconds;
      return true;
    },
    // Fire from `origin` along `dir`. Returns what the bullet hit, if anything.
    shoot(origin, dir) {
      if (cooldown > 0 || reloading > 0) return null;
      if (ammo <= 0) {
        this.startReload();
        if (world.audio) world.audio.denied();
        return null;
      }
      ammo -= 1;
      cooldown = COMBAT.fireCooldown;
      raycaster.set(origin, dir);
      const targets = [];
      for (const ped of world.peds.peds) if (ped.state !== 'down') targets.push(ped.mesh);
      for (const car of world.traffic.all()) targets.push(car.mesh);
      for (const cop of world.police.cops) targets.push(cop.mesh);
      if (world.player.car) targets.push(world.player.car.mesh);
      if (world.rivalCar) targets.push(world.rivalCar.mesh);
      const hits = raycaster.intersectObjects(targets, true);
      const end = new THREE.Vector3().copy(origin).addScaledVector(dir, COMBAT.range);
      let result = null;
      if (hits.length > 0) {
        const hit = hits[0];
        end.copy(hit.point);
        const owner = ownerOf(hit.object);
        if (owner) {
          if (owner.mesh && owner.health !== undefined && owner.state !== undefined) {
            // A pedestrian.
            const killed = world.peds.hitPed(owner, COMBAT.damage, world.time);
            result = { kind: 'ped', killed, point: hit.point };
            if (world.effects) world.effects.blood(hit.point.x, hit.point.y, hit.point.z);
          } else if (owner.mesh && owner.speed !== undefined) {
            damageCar(owner, COMBAT.damage, world);
            result = { kind: 'car', car: owner, point: hit.point };
          }
        }
      }
      fireTracer(origin, end);
      if (world.effects) world.effects.muzzle(origin.x, origin.y, origin.z, dir);
      if (world.audio) world.audio.shot();
      world.peds.scareNear(origin.x, origin.z, 30, world.time);
      return result || { kind: 'miss', point: end };
    },
    // A swing at whatever is right in front of the player.
    punch(player) {
      if (punchCooldown > 0) return null;
      punchCooldown = PLAYER.punchCooldown;
      if (world.audio) world.audio.punch();
      const ahead = new THREE.Vector3(
        player.pos.x + Math.sin(player.heading) * PLAYER.punchRange,
        0,
        player.pos.z + Math.cos(player.heading) * PLAYER.punchRange,
      );
      const ped = world.peds.nearestPed(ahead, PLAYER.punchRange + 0.6);
      if (ped) {
        const killed = world.peds.hitPed(ped, PLAYER.punchDamage, world.time);
        if (world.effects) world.effects.blood(ped.pos.x, 1.2, ped.pos.z);
        return { kind: 'ped', killed };
      }
      for (const car of world.traffic.all()) {
        if (Math.hypot(car.pos.x - ahead.x, car.pos.z - ahead.z) < 2.4) {
          damageCar(car, PLAYER.punchDamage, world);
          return { kind: 'car', car };
        }
      }
      return { kind: 'miss' };
    },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      punchCooldown = Math.max(0, punchCooldown - dt);
      if (reloading > 0) {
        reloading -= dt;
        if (reloading <= 0) {
          const take = Math.min(COMBAT.magSize - ammo, reserve);
          ammo += take;
          reserve -= take;
          if (world.audio) world.audio.pickup();
        }
      }
      for (const tracer of tracers) {
        if (tracer.life > 0) {
          tracer.life -= dt;
          if (tracer.life <= 0) tracer.line.material.opacity = 0;
        }
      }
    },
  };
}
