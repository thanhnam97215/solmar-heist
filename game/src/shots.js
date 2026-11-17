// Screenshot scenes behind ?shot=chase|drive|foot|menu. Each one stages the
// real game — a real car, real cops, a real mission — then lets an autopilot
// drive it forward, so the frame is what playing actually looks like. The
// same seed always stages the same frame.
import { makeVehicle } from './vehicles.js';

let current = null;

function driveToward(world, targetX, targetZ) {
  const car = world.player.car;
  if (!car) return;
  const dx = targetX - car.pos.x;
  const dz = targetZ - car.pos.z;
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  world.autopilot = {
    throttle: 1,
    steer: Math.max(-1, Math.min(1, diff * 2.5)),
  };
}

export function stageShot(name, world) {
  current = name;
  const { player, police, missions } = world;
  if (name === 'chase') {
    // Mid-mission police chase: three stars, three cruisers right behind,
    // Mara in the car and the pier on the objective line.
    missions.stageMission(1, 1);
    police.setWanted(3);
    const car = makeVehicle(world.scene, {
      x: 0,
      z: -60,
      heading: 0,
      color: 0xc23b2e,
      kind: 'player',
      sport: true,
    });
    car.speed = 30;
    player.enterCar(car);
    police.placeCop(0, -88, 0, 30);
    police.placeCop(-5, -100, 0, 28);
    // One cruiser ahead, in frame: it turns to join the chase as you pass.
    police.placeCop(5, -28, 0, 22);
    player.snapCamera(world.camera);
    return { readyAfter: 5 };
  }
  if (name === 'drive') {
    // Cruising the beach boulevard with traffic, first job on the board.
    missions.stageMission(0, 1);
    const car = makeVehicle(world.scene, {
      x: 180,
      z: -40,
      heading: Math.PI,
      color: 0x2e6ac2,
      kind: 'player',
      sport: true,
    });
    car.speed = 24;
    player.enterCar(car);
    player.snapCamera(world.camera);
    return { readyAfter: 3.5 };
  }
  if (name === 'foot') {
    // On foot on the boardwalk by the pier, strolling north: palms and the
    // ocean to the right, the city to the left.
    player.respawnAt({ x: 193, z: 55 });
    player.heading = Math.PI;
    player.cameraDist = 11;
    player.snapCamera(world.camera);
    return { readyAfter: 3 };
  }
  // menu: the title screen over the live city; main.js handles the orbit.
  return { readyAfter: 3.5 };
}

export function updateShotAutopilot(world) {
  if (!current) return;
  if (current === 'chase' && world.player.car) {
    driveToward(world, 0, world.player.car.pos.z + 60);
  } else if (current === 'drive' && world.player.car) {
    driveToward(world, 180, world.player.car.pos.z - 60);
  } else if (current === 'foot') {
    // A slow stroll down the boardwalk.
    world.input.keys.add('KeyW');
  }
}
