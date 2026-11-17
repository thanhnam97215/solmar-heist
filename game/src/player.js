// The player: a getaway driver on foot and behind the wheel. On foot they
// run, jump and punch; in a car they drive with the shared arcade physics.
// The third-person camera trails behind and swings with a right-mouse drag.
import * as THREE from 'three';
import { CAR, PLAYER } from './config.js';
import { driveStep, forwardOf } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

const CAMERA_HEIGHT = 3.4;
const CAMERA_DIST = 8.5;

export function createPlayer(scene, city, start, world) {
  const mesh = makePersonMesh(0x2a9ad8, 0x2a2d33, 0xe8b88a);
  mesh.position.set(start.x, 0, start.z);
  scene.add(mesh);

  const state = {
    mesh,
    pos: mesh.position,
    heading: 0,
    cameraYaw: 0,
    cameraPitch: 0.32,
    cameraDist: CAMERA_DIST,
    health: PLAYER.maxHealth,
    mode: 'foot',
    car: null,
    vy: 0,
    grounded: true,
    phase: 0,
    moving: false,
    speed: 0,
  };

  function footStep(dt, input) {
    const axis = input.axis();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moving = axis.x !== 0 || axis.y !== 0;
    state.moving = moving;
    if (moving) {
      // Movement is relative to where the camera looks.
      const moveAngle = Math.atan2(axis.x, axis.y) + state.cameraYaw;
      const wantHeading = moveAngle;
      let diff = wantHeading - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += diff * Math.min(1, dt * 12);
      state.pos.x += Math.sin(state.heading) * speed * dt;
      state.pos.z += Math.cos(state.heading) * speed * dt;
      state.speed = speed;
      state.phase += dt * speed * 1.4;
      const swing = Math.sin(state.phase) * 0.6;
      mesh.userData.legs[0].rotation.x = swing;
      mesh.userData.legs[1].rotation.x = -swing;
      mesh.userData.arms[0].rotation.x = -swing * 0.8;
      mesh.userData.arms[1].rotation.x = swing * 0.8;
    } else {
      state.speed = 0;
      mesh.userData.legs[0].rotation.x = 0;
      mesh.userData.legs[1].rotation.x = 0;
      mesh.userData.arms[0].rotation.x = 0;
      mesh.userData.arms[1].rotation.x = 0;
    }
    if (input.wasPressed('Space') && state.grounded) {
      state.vy = 7.5;
      state.grounded = false;
    }
    if (!state.grounded) {
      state.vy -= 22 * dt;
      state.pos.y += state.vy * dt;
      if (state.pos.y <= 0) {
        state.pos.y = 0;
        state.vy = 0;
        state.grounded = true;
      }
    }
    city.collideCircle(state.pos, PLAYER.radius);
    mesh.rotation.y = state.heading;
  }

  function updateCamera(camera, dt, input, targetPos, targetHeading) {
    if (input.mouse.right) {
      state.cameraYaw -= input.mouse.dx * 0.004;
      state.cameraPitch = Math.max(0.05, Math.min(1.1, state.cameraPitch + input.mouse.dy * 0.003));
    } else {
      // Ease the camera behind the direction of travel.
      let diff = targetHeading - state.cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const rate = state.mode === 'car' ? 2.2 : 1.1;
      state.cameraYaw += diff * Math.min(1, dt * rate);
    }
    if (input.mouse.wheel !== 0) {
      state.cameraDist = Math.max(5, Math.min(14, state.cameraDist + input.mouse.wheel * 0.003));
    }
    const dist = state.mode === 'car' ? state.cameraDist + 1.5 : state.cameraDist;
    const height = CAMERA_HEIGHT + Math.sin(state.cameraPitch) * 3;
    const back = dist * Math.cos(state.cameraPitch);
    const cx = targetPos.x - Math.sin(state.cameraYaw) * back;
    const cz = targetPos.z - Math.cos(state.cameraYaw) * back;
    const cy = Math.max(1.2, targetPos.y + height);
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 7);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 7);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 7);
    camera.lookAt(targetPos.x, targetPos.y + 1.6, targetPos.z);
  }

  // Methods live on the state object itself so every reader sees live values.
  Object.defineProperty(state, 'position', {
    get() {
      return state.mode === 'car' && state.car ? state.car.pos : state.pos;
    },
  });
  return Object.assign(state, {
    enterCar(car) {
      state.car = car;
      state.mode = 'car';
      car.driver = 'player';
      mesh.visible = false;
      state.pos.set(car.pos.x, 0, car.pos.z);
      state.heading = car.heading;
    },
    exitCar() {
      if (!state.car) return;
      const car = state.car;
      forwardOf(car.heading, new THREE.Vector3());
      const sideX = Math.cos(car.heading);
      const sideZ = -Math.sin(car.heading);
      state.pos.set(car.pos.x + sideX * 2.6, 0, car.pos.z + sideZ * 2.6);
      city.collideCircle(state.pos, PLAYER.radius);
      state.heading = car.heading;
      car.driver = 'ai';
      state.car = null;
      state.mode = 'foot';
      mesh.visible = true;
      mesh.position.copy(state.pos);
    },
    takeDamage(amount) {
      state.health = Math.max(0, state.health - amount);
      return state.health <= 0;
    },
    heal(amount) {
      state.health = Math.min(PLAYER.maxHealth, state.health + amount);
    },
    respawnAt(place) {
      if (state.car) {
        state.car.driver = 'ai';
        state.car = null;
      }
      state.mode = 'foot';
      state.health = PLAYER.maxHealth;
      state.pos.set(place.x, 0, place.z);
      mesh.visible = true;
      mesh.position.copy(state.pos);
    },
    update(dt, input, camera) {
      if (state.mode === 'car' && state.car) {
        const axis = input.axis();
        // The screenshot autopilot drives through world.autopilot when set.
        const auto = world.autopilot;
        driveStep(
          state.car,
          dt,
          auto
            ? { throttle: auto.throttle, steer: auto.steer, handbrake: false }
            : { throttle: axis.y, steer: axis.x, handbrake: input.down('Space') },
          world,
        );
        state.heading = state.car.heading;
        state.speed = Math.abs(state.car.speed);
        state.pos.copy(state.car.pos);
        updateCamera(camera, dt, input, state.car.pos, state.car.heading);
      } else {
        footStep(dt, input);
        updateCamera(camera, dt, input, state.pos, state.heading);
      }
    },
    // Point the camera at the city for the title screen's slow orbit.
    orbitCamera(camera, time, centre) {
      const angle = time * 0.05;
      camera.position.set(
        centre.x + Math.sin(angle) * 90,
        42,
        centre.z + Math.cos(angle) * 90,
      );
      camera.lookAt(centre.x, 0, centre.z);
    },
    snapCamera(camera) {
      const target = state.mode === 'car' && state.car ? state.car.pos : state.pos;
      state.cameraYaw = state.heading;
      camera.position.set(
        target.x - Math.sin(state.cameraYaw) * state.cameraDist,
        target.y + CAMERA_HEIGHT,
        target.z - Math.cos(state.cameraYaw) * state.cameraDist,
      );
      camera.lookAt(target.x, target.y + 1.6, target.z);
    },
  });
}
