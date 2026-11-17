// The wanted system: stars 1-5, police cruisers that spawn, chase and ram,
// a bust timer when a cop catches you on foot, and slow decay when you
// break line of sight. Cops flash their light bars and the siren follows.
import { ROADS, WANTED } from './config.js';
import { driveStep, makeVehicle } from './vehicles.js';

const COP_COLOR = 0x1c2733;

export function createPolice(scene, city, rng, world) {
  const cops = [];
  let wanted = 0;
  let unseenTimer = 0;
  let bustTimer = 0;
  let shootTimer = 0;
  let spawnTimer = 0;

  function spawnCop(playerPos) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const coord = rng.pick(ROADS);
    const along = rng.range(-210, 210);
    const x = axis === 'x' ? coord : along;
    const z = axis === 'x' ? along : coord;
    // Never spawn on top of the player.
    if (Math.hypot(x - playerPos.x, z - playerPos.z) < 45) return;
    const cop = makeVehicle(scene, {
      x,
      z,
      heading: rng.range(0, Math.PI * 2),
      color: COP_COLOR,
      kind: 'police',
      police: true,
    });
    cop.stuckTimer = 0;
    cop.reverseTimer = 0;
    cops.push(cop);
  }

  function despawnCop(cop) {
    scene.remove(cop.mesh);
    const index = cops.indexOf(cop);
    if (index !== -1) cops.splice(index, 1);
  }

  function chaseStep(cop, dt, player) {
    if (cop.wrecked) return;
    const playerPos = player.position;
    const dx = playerPos.x - cop.pos.x;
    const dz = playerPos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    // A cruiser that catches you on foot pulls up alongside and stops — that
    // is the arrest, and it is what lets the bust timer run.
    if (player.mode === 'foot' && dist < 7) {
      const braking = Math.abs(cop.speed) > 1.5;
      driveStep(cop, dt, { throttle: braking ? -1 : 0, steer: 0, handbrake: false }, world);
      flashLights(cop);
      return;
    }
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - cop.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const speed = Math.abs(cop.speed);
    if (speed < 2 && dist > 8) cop.stuckTimer += dt;
    else cop.stuckTimer = 0;
    if (cop.stuckTimer > 1.6) {
      cop.reverseTimer = 0.9;
      cop.stuckTimer = 0;
    }
    let control;
    if (cop.reverseTimer > 0) {
      cop.reverseTimer -= dt;
      control = { throttle: -1, steer: -Math.sign(diff), handbrake: false };
    } else {
      control = {
        throttle: dist > 6 ? 1 : 0.4,
        steer: Math.max(-1, Math.min(1, diff * 2.2)),
        handbrake: Math.abs(diff) > 1.9 && speed > 12,
      };
    }
    driveStep(cop, dt, control, world);
    flashLights(cop);
  }

  function flashLights(cop) {
    const phase = Math.floor(world.time * 6) % 2 === 0;
    if (cop.mesh.userData.redLight) {
      cop.mesh.userData.redLight.material.color.setHex(phase ? 0xff2222 : 0x551111);
      cop.mesh.userData.blueLight.material.color.setHex(phase ? 0x112255 : 0x2266ff);
    }
  }

  return {
    cops,
    get wanted() {
      return wanted;
    },
    get bustProgress() {
      return Math.min(1, bustTimer / WANTED.bustSeconds);
    },
    setWanted(n) {
      wanted = Math.max(0, Math.min(WANTED.maxStars, n));
      unseenTimer = 0;
    },
    // Put a cruiser at an exact spot (used to stage the chase screenshot).
    placeCop(x, z, heading, speed) {
      const cop = makeVehicle(scene, {
        x,
        z,
        heading,
        color: COP_COLOR,
        kind: 'police',
        police: true,
      });
      cop.speed = speed || 0;
      cop.stuckTimer = 0;
      cop.reverseTimer = 0;
      cops.push(cop);
      return cop;
    },
    addWanted(n) {
      this.setWanted(wanted + n);
    },
    clear() {
      this.setWanted(0);
      for (const cop of [...cops]) despawnCop(cop);
    },
    nearestCop(pos) {
      let best = null;
      let bestDist = Infinity;
      for (const cop of cops) {
        const d = Math.hypot(cop.pos.x - pos.x, cop.pos.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          best = cop;
        }
      }
      return best ? { cop: best, dist: bestDist } : null;
    },
    // Returns 'busted' when the player is caught, otherwise null.
    update(dt, player, now) {
      const playerPos = player.position;
      const wantCops = wanted === 0 ? 0 : Math.min(1 + wanted, 5);
      // Spawn up to the wanted level's strength, one cruiser at a time on a
      // steady timer, so the response never depends on the frame rate.
      spawnTimer += dt;
      if (cops.length < wantCops && spawnTimer > 0.7) {
        spawnTimer = 0;
        spawnCop(playerPos);
      }
      // Lose cops that are far away when the heat drops.
      if (cops.length > wantCops) {
        const far = [...cops].sort(
          (a, b) =>
            Math.hypot(b.pos.x - playerPos.x, b.pos.z - playerPos.z) -
            Math.hypot(a.pos.x - playerPos.x, a.pos.z - playerPos.z),
        )[0];
        if (Math.hypot(far.pos.x - playerPos.x, far.pos.z - playerPos.z) > 90) despawnCop(far);
      }
      for (const cop of cops) chaseStep(cop, dt, player);

      // Siren while any cop is on the hunt.
      world.audio.siren(cops.length > 0 && wanted > 0, now);

      if (wanted === 0) {
        bustTimer = 0;
        return null;
      }

      // Seen? Any cop within 80 units keeps the heat on.
      const nearest = this.nearestCop(playerPos);
      if (!nearest || nearest.dist > 80) {
        unseenTimer += dt;
        if (unseenTimer > WANTED.decaySeconds) {
          wanted -= 1;
          unseenTimer = 0;
          if (world.hud) world.hud.showMessage(wanted === 0 ? 'You lost the cops.' : `Heat dropping — ${wanted} star${wanted === 1 ? '' : 's'} left.`);
        }
      } else {
        unseenTimer = 0;
      }

      // Busted: on foot, slow, and a cop right next to you.
      if (player.mode === 'foot' && nearest && nearest.dist < WANTED.bustRange && player.speed < 2.5) {
        bustTimer += dt;
        if (bustTimer >= WANTED.bustSeconds) {
          bustTimer = 0;
          return 'busted';
        }
      } else {
        bustTimer = Math.max(0, bustTimer - dt * 2);
      }

      // At 3+ stars, nearby cops shoot at you on foot.
      if (wanted >= 3 && player.mode === 'foot' && nearest && nearest.dist < 26) {
        shootTimer -= dt;
        if (shootTimer <= 0) {
          shootTimer = 0.9;
          if (world.effects) world.effects.muzzle(nearest.cop.pos.x, 1.4, nearest.cop.pos.z, { x: 0, z: 0 });
          if (world.audio) world.audio.shot();
          if (player.takeDamage(6)) return 'wasted';
          if (world.hud) world.hud.flashDamage();
        }
      }
      return null;
    },
  };
}
