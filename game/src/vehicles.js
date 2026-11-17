// Cars: a boxy low-poly car factory, arcade driving physics (accelerate,
// steer, drift on the handbrake, crash into buildings and each other), and
// the traffic system — cars that follow the road lanes and parked cars the
// player can steal.
import * as THREE from 'three';
import { CAR, PALETTE, ROADS, TRAFFIC, WORLD } from './config.js';

const FORWARD = new THREE.Vector3();

export function forwardOf(heading, out) {
  out = out || FORWARD;
  out.set(Math.sin(heading), 0, Math.cos(heading));
  return out;
}

export function createCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2833 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x18181c });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.3), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.1), opts.police ? paint : glassMat);
  cabin.position.set(0, 1.3, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
    wheels.push(wheel);
  }

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), lightMat);
    head.position.set(x, 0.66, 2.16);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xd83838 }));
    tail.position.set(x, 0.66, -2.16);
    group.add(tail);
  }

  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.5), trimMat);
    bar.position.set(0, 1.72, -0.25);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.4, 1.86, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.4, 1.86, -0.25);
    group.add(red);
    group.add(blue);
    group.userData.redLight = red;
    group.userData.blueLight = blue;
  }
  if (opts.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), trimMat);
    spoiler.position.set(0, 1.05, -2.0);
    group.add(spoiler);
  }

  group.userData.wheels = wheels;
  return group;
}

export function makeVehicle(scene, opts) {
  const mesh = createCarMesh(opts.color, opts);
  mesh.position.set(opts.x, 0, opts.z);
  mesh.rotation.y = opts.heading || 0;
  scene.add(mesh);
  const vehicle = {
    mesh,
    pos: mesh.position,
    heading: opts.heading || 0,
    speed: 0,
    vel: new THREE.Vector3(),
    health: CAR.maxHealth,
    kind: opts.kind || 'traffic',
    color: opts.color,
    wrecked: false,
    steerVisual: 0,
    lane: opts.lane || null,
    cruise: opts.cruise || TRAFFIC.cruiseSpeed,
    driver: opts.driver || 'ai',
    brakeLight: false,
  };
  mesh.userData.owner = vehicle; // lets raycasts find the car they hit
  return vehicle;
}

// One arcade physics step. `control` is { throttle: -1..1, steer: -1..1,
// handbrake: bool }. `world` carries city, effects and audio for crashes.
export function driveStep(car, dt, control, world) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    car.vel.multiplyScalar(Math.max(0, 1 - 3 * dt));
    return;
  }
  const throttle = control.throttle || 0;
  const steer = control.steer || 0;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed += CAR.brake * throttle * dt;
    else car.speed += CAR.accel * 0.55 * throttle * dt;
  }
  car.speed -= car.speed * 0.35 * dt; // rolling drag
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

  const steerAuthority = Math.min(1, Math.abs(car.speed) / 7);
  car.heading += steer * CAR.steerRate * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
  car.steerVisual += (steer * 0.45 - car.steerVisual) * Math.min(1, dt * 8);

  const grip = control.handbrake ? CAR.handbrakeGrip : CAR.grip;
  forwardOf(car.heading, FORWARD);
  const targetX = FORWARD.x * car.speed;
  const targetZ = FORWARD.z * car.speed;
  const blend = Math.min(1, grip * dt);
  car.vel.x += (targetX - car.vel.x) * blend;
  car.vel.z += (targetZ - car.vel.z) * blend;

  const prevX = car.pos.x;
  const prevZ = car.pos.z;
  car.pos.x += car.vel.x * dt;
  car.pos.z += car.vel.z * dt;

  // Two circles (nose and tail) against buildings and the city edge.
  let crashed = false;
  const probe = new THREE.Vector3();
  for (const offset of [1.5, -1.5]) {
    probe.set(car.pos.x + FORWARD.x * offset, 0, car.pos.z + FORWARD.z * offset);
    if (world.city.collideCircle(probe, CAR.radius)) {
      crashed = true;
      car.pos.x += probe.x - (car.pos.x + FORWARD.x * offset);
      car.pos.z += probe.z - (car.pos.z + FORWARD.z * offset);
    }
  }
  if (crashed && Math.abs(car.speed) > 4) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.35;
    car.vel.multiplyScalar(0.35);
    car.health -= impact * 0.9;
    if (world.effects) world.effects.sparks(car.pos.x, 0.8, car.pos.z);
    if (world.audio) world.audio.crash();
    if (world.onCrash) world.onCrash(car, impact);
    if (car.health <= 0) wreckCar(car, world);
  } else if (crashed) {
    car.speed *= 0.6;
    car.vel.multiplyScalar(0.6);
  }
  void prevX;
  void prevZ;

  car.mesh.rotation.y = car.heading;
  const wheels = car.mesh.userData.wheels;
  const spin = (car.speed / 0.38) * dt;
  for (let i = 0; i < wheels.length; i += 1) {
    wheels[i].rotation.x += spin;
    if (i < 2) wheels[i].rotation.y = car.steerVisual;
  }
}

export function wreckCar(car, world) {
  car.wrecked = true;
  car.health = 0;
  car.speed = 0;
  if (world && world.effects) {
    world.effects.smoke(car.pos.x, 1.2, car.pos.z);
    world.effects.sparks(car.pos.x, 1, car.pos.z);
  }
}

export function damageCar(car, amount, world) {
  if (car.wrecked) return;
  car.health -= amount;
  if (world && world.effects) world.effects.sparks(car.pos.x, 1, car.pos.z);
  if (car.health <= 0) wreckCar(car, world);
}

// Traffic: cars that cruise the road lanes, turn at intersections, brake for
// the car ahead, and respawn far away when the player drives off.
export function createTraffic(scene, city, rng, world) {
  const cars = [];
  const parked = [];

  function randomLane() {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    return { axis, coord: rng.pick(ROADS), dir: rng.chance(0.5) ? 1 : -1, along: rng.range(-210, 210) };
  }

  function lanePosition(lane) {
    // Right-hand traffic: the lane sits 3 units to the right of the centre.
    const off = lane.dir > 0 ? 3 : -3;
    if (lane.axis === 'x') return { x: lane.coord + off, z: lane.along };
    return { x: lane.along, z: lane.coord - off };
  }

  function laneHeading(lane) {
    if (lane.axis === 'x') return lane.dir > 0 ? 0 : Math.PI;
    return lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const lane = randomLane();
    const p = lanePosition(lane);
    const car = makeVehicle(scene, {
      x: p.x,
      z: p.z,
      heading: laneHeading(lane),
      color: rng.pick(PALETTE.carColors),
      kind: 'traffic',
      lane,
      cruise: TRAFFIC.cruiseSpeed * rng.range(0.8, 1.2),
    });
    car.speed = car.cruise;
    cars.push(car);
  }

  for (let i = 0; i < TRAFFIC.parkedCount; i += 1) {
    const lane = randomLane();
    const p = lanePosition(lane);
    const car = makeVehicle(scene, {
      x: p.x + (lane.axis === 'x' ? 0 : rng.range(-1.5, 1.5)),
      z: p.z + (lane.axis === 'z' ? 0 : rng.range(-1.5, 1.5)),
      heading: laneHeading(lane) + (rng.chance(0.3) ? Math.PI : 0),
      color: rng.pick(PALETTE.carColors),
      kind: 'parked',
      sport: rng.chance(0.25),
    });
    parked.push(car);
  }

  function updateTrafficCar(car, dt, playerPos) {
    if (car.wrecked) return;
    const lane = car.lane;
    // At an intersection, sometimes turn onto the cross street.
    const nearCross = ROADS.some((c) => Math.abs(lane.along - c) < 1.2);
    if (nearCross && rng.chance(dt * 0.35)) {
      const cross = ROADS.reduce((a, b) => (Math.abs(lane.along - a) < Math.abs(lane.along - b) ? a : b));
      car.lane = {
        axis: lane.axis === 'x' ? 'z' : 'x',
        coord: cross,
        dir: rng.chance(0.5) ? 1 : -1,
        along: lane.axis === 'x' ? lane.coord : lane.coord,
      };
      return;
    }
    // Keep off the map edge: turn around at the ends.
    if (lane.along > 215 || lane.along < -215) {
      lane.dir *= -1;
      lane.along = Math.max(-215, Math.min(215, lane.along));
    }
    // Brake for a car ahead on the same lane.
    let targetSpeed = car.cruise;
    forwardOf(car.heading, FORWARD);
    const aheadX = car.pos.x + FORWARD.x * 9;
    const aheadZ = car.pos.z + FORWARD.z * 9;
    for (const other of cars) {
      if (other === car || other.wrecked) continue;
      if (Math.hypot(other.pos.x - aheadX, other.pos.z - aheadZ) < 5) targetSpeed = 0;
    }
    if (playerPos && Math.hypot(playerPos.x - aheadX, playerPos.z - aheadZ) < 5) targetSpeed = 0;
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 8 * dt);
    else car.speed = Math.max(targetSpeed, car.speed - 18 * dt);
    lane.along += lane.dir * car.speed * dt;
    const p = lanePosition(lane);
    car.pos.x += (p.x - car.pos.x) * Math.min(1, dt * 3);
    car.pos.z += (p.z - car.pos.z) * Math.min(1, dt * 3);
    const wantHeading = laneHeading(lane);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += diff * Math.min(1, dt * 2.5);
    car.mesh.rotation.y = car.heading;
    const wheels = car.mesh.userData.wheels;
    const spin = (car.speed / 0.38) * dt;
    for (const wheel of wheels) wheel.rotation.x += spin;
  }

  return {
    cars,
    parked,
    update(dt, playerPos) {
      for (const car of cars) updateTrafficCar(car, dt, playerPos);
      // A wrecked traffic car quietly respawns far from the player.
      for (let i = 0; i < cars.length; i += 1) {
        const car = cars[i];
        if (!car.wrecked) continue;
        if (playerPos && Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) < 120) continue;
        const lane = randomLane();
        const p = lanePosition(lane);
        car.lane = lane;
        car.pos.set(p.x, 0, p.z);
        car.heading = laneHeading(lane);
        car.speed = car.cruise;
        car.health = CAR.maxHealth;
        car.wrecked = false;
      }
    },
    // The closest car the player can steal (traffic or parked, not wrecked).
    nearestStealable(pos, maxDist) {
      let best = null;
      let bestDist = maxDist;
      for (const car of [...cars, ...parked]) {
        if (car.wrecked || car.driver === 'player') continue;
        const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          best = car;
        }
      }
      return best;
    },
    removeFromTraffic(car) {
      const index = cars.indexOf(car);
      if (index !== -1) cars.splice(index, 1);
      const parkedIndex = parked.indexOf(car);
      if (parkedIndex !== -1) parked.splice(parkedIndex, 1);
    },
    all() {
      return [...cars, ...parked];
    },
  };
}
