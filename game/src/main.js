// Solmar Heist — boot and the one loop. The world object is built first and
// filled in as each system is created; every system reads from it lazily, so
// creation order never bites. Screens: title, play, pause, busted, wasted.
// ?shot=chase|drive|foot|menu stages a screenshot scene (with &seed=N) and
// sets window.__shotReady when the frame is ready to capture.
import * as THREE from 'three';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { buildCity } from './city.js';
import { createTraffic, damageCar } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { blankSave, clearSave, loadSave, saveGame } from './save.js';
import { stageShot, updateShotAutopilot } from './shots.js';
import { CAR, PLACES } from './config.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// Renderer and camera.
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-40, 30, -40);

const scene = new THREE.Scene();
const world = {
  scene,
  camera,
  time: 0,
  rng: createRandom(seed),
  rivalCar: null,
  autopilot: null,
};
world.save = loadSave() || blankSave();
world.saveGame = () => saveGame(world.save);
world.audio = createAudio();
world.input = createInput(renderer.domElement);
world.city = buildCity(scene, world.rng);
world.effects = createEffects(scene);
world.traffic = createTraffic(scene, world.city, world.rng, world);
world.peds = createPedestrians(scene, world.city, world.rng);
world.player = createPlayer(scene, world.city, PLACES.spawn, world);
world.police = createPolice(scene, world.city, world.rng, world);
world.combat = createCombat(scene, world);
world.hud = createHud();
world.missions = createMissions(scene, world);
world.onGameFinished = () => {
  world.hud.showMessage('Solmar Bay is yours. Keep driving, keep earning.');
};

// A hard crash hurts the driver of the car that hit.
world.onCrash = (car, impact) => {
  if (car === world.player.car && impact > 10) {
    world.hud.flashDamage();
    if (world.player.takeDamage(impact * 0.35)) doWasted();
  }
};

const { player, police, traffic, peds, missions, combat, hud, audio, input } = world;

// Cars the player stole and left parked: stealable again, but no longer in
// the traffic flow.
const freeCars = [];
let lastShotCrime = 0;
let lastCopHit = 0;

function nearestStealable(pos, maxDist) {
  let best = traffic.nearestStealable(pos, maxDist);
  let bestDist = best ? Math.hypot(best.pos.x - pos.x, best.pos.z - pos.z) : maxDist;
  for (const car of freeCars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

// --- Screens ----------------------------------------------------------------
let screen = 'title';
const $ = (id) => document.getElementById(id);
const titleScreen = $('title-screen');
const pauseScreen = $('pause-screen');
const endScreen = $('end-screen');
const endTitle = $('end-title');
const endSub = $('end-sub');

function setScreen(next) {
  screen = next;
  document.body.dataset.screen = next;
  titleScreen.classList.toggle('show', next === 'title');
  pauseScreen.classList.toggle('show', next === 'pause');
  endScreen.classList.toggle('show', next === 'busted' || next === 'wasted');
  input.setEnabled(next === 'play');
}

function startGame(fresh) {
  if (fresh) {
    clearSave();
    world.save = blankSave();
    world.saveGame();
    missions.reset();
    police.clear();
    player.respawnAt(PLACES.spawn);
  }
  audio.init();
  audio.startMusic();
  player.snapCamera(camera);
  hud.setObjective(missions.objectiveText, missions.target);
  hud.showMessage(missions.active ? 'Job in progress.' : 'Welcome to Solmar Bay. Find the gold marker for work.');
  setScreen('play');
}

function doBusted() {
  if (screen !== 'play') return;
  const fine = Math.min(world.save.cash, 200);
  world.save.cash -= fine;
  world.saveGame();
  missions.fail('Busted by the cops.');
  police.clear();
  audio.busted();
  endTitle.textContent = 'BUSTED';
  endSub.textContent = `The Solmar PD took $${fine} in fines. You walk out of the station with a record and a grudge.`;
  setScreen('busted');
  window.setTimeout(() => {
    player.respawnAt(PLACES.policeStation);
    player.snapCamera(camera);
    setScreen('play');
  }, 2800);
}

function doWasted() {
  if (screen !== 'play') return;
  const bill = Math.min(world.save.cash, 150);
  world.save.cash -= bill;
  world.saveGame();
  missions.fail('Wasted.');
  police.clear();
  audio.wasted();
  endTitle.textContent = 'WASTED';
  endSub.textContent = `St. Alba patched you up for $${bill}. The city is still out there.`;
  setScreen('wasted');
  window.setTimeout(() => {
    player.respawnAt(PLACES.hospital);
    player.snapCamera(camera);
    setScreen('play');
  }, 2800);
}

$('btn-start').addEventListener('click', () => {
  audio.uiClick();
  startGame(true);
});
$('btn-continue').addEventListener('click', () => {
  audio.uiClick();
  startGame(false);
});
$('btn-resume').addEventListener('click', () => {
  audio.uiClick();
  setScreen('play');
});
$('btn-restart').addEventListener('click', () => window.location.reload());
$('btn-quit').addEventListener('click', () => {
  audio.uiClick();
  setScreen('title');
});
$('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  $('btn-mute').textContent = audio.isMuted() ? '🔇 Sound: Off' : '🔊 Sound: On';
});
// Continue only makes sense when a save with progress exists.
if (!loadSave() || (world.save.missionsDone === 0 && world.save.cash <= 150)) {
  $('btn-continue').style.display = 'none';
}

// --- Car collisions ----------------------------------------------------------
function resolvePair(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  if (d >= 3.6 || d < 0.001) return;
  const nx = dx / d;
  const nz = dz / d;
  const overlap = (3.6 - d) / 2;
  a.pos.x -= nx * overlap;
  a.pos.z -= nz * overlap;
  b.pos.x += nx * overlap;
  b.pos.z += nz * overlap;
  const rel = (a.vel.x - b.vel.x) * nx + (a.vel.z - b.vel.z) * nz;
  const impact = Math.abs(rel);
  const push = rel * 0.5;
  a.vel.x -= nx * push;
  a.vel.z -= nz * push;
  b.vel.x += nx * push;
  b.vel.z += nz * push;
  a.speed *= 0.7;
  b.speed *= 0.7;
  if (impact < 4) return;
  const midX = (a.pos.x + b.pos.x) / 2;
  const midZ = (a.pos.z + b.pos.z) / 2;
  world.effects.sparks(midX, 0.9, midZ);
  const nearPlayer = Math.hypot(midX - player.position.x, midZ - player.position.z) < 45;
  if (nearPlayer) audio.crash();
  const playerInvolved = a === player.car || b === player.car;
  const other = a === player.car ? b : b === player.car ? a : null;
  if (playerInvolved && other && other === world.rivalCar) {
    // Ramming the rival is the job: it hurts them more than it hurts you.
    damageCar(world.rivalCar, impact * 2.2, world);
    damageCar(player.car, impact * 0.5, world);
  } else {
    damageCar(a, impact * 0.9, world);
    damageCar(b, impact * 0.9, world);
  }
  if (playerInvolved && other && other.kind === 'police' && impact > 6 && world.time - lastCopHit > 3) {
    lastCopHit = world.time;
    police.addWanted(1);
    hud.showMessage('You rammed a cop car!');
  }
}

function resolveStatic(moving, still) {
  const dx = still.pos.x - moving.pos.x;
  const dz = still.pos.z - moving.pos.z;
  const d = Math.hypot(dx, dz);
  if (d >= 3.4 || d < 0.001) return;
  const nx = dx / d;
  const nz = dz / d;
  moving.pos.x -= nx * (3.4 - d);
  moving.pos.z -= nz * (3.4 - d);
  const impact = Math.abs(moving.speed);
  moving.speed *= 0.4;
  moving.vel.multiplyScalar(0.4);
  if (impact > 5) {
    world.effects.sparks(moving.pos.x, 0.9, moving.pos.z);
    audio.crash();
    damageCar(moving, impact * 0.8, world);
  }
}

function collideCars() {
  const dynamic = [];
  if (player.mode === 'car' && player.car && !player.car.wrecked) dynamic.push(player.car);
  for (const car of traffic.cars) if (!car.wrecked) dynamic.push(car);
  for (const cop of police.cops) if (!cop.wrecked) dynamic.push(cop);
  if (world.rivalCar && !world.rivalCar.wrecked) dynamic.push(world.rivalCar);
  for (let i = 0; i < dynamic.length; i += 1) {
    for (let j = i + 1; j < dynamic.length; j += 1) resolvePair(dynamic[i], dynamic[j]);
  }
  const statics = [
    ...traffic.parked,
    ...freeCars,
    ...traffic.cars.filter((c) => c.wrecked),
    ...police.cops.filter((c) => c.wrecked),
  ];
  for (const moving of dynamic) {
    for (const still of statics) {
      if (still !== moving) resolveStatic(moving, still);
    }
  }
  // The player's own car wrecked under them: out on foot.
  if (player.mode === 'car' && player.car && player.car.wrecked) {
    freeCars.push(player.car);
    player.exitCar();
    hud.showMessage('Your car is wrecked!');
  }
}

function collideCarWithPeds() {
  if (player.mode !== 'car' || !player.car || Math.abs(player.car.speed) < 4) return;
  const car = player.car;
  for (const ped of peds.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 2.4) {
      peds.hitPed(ped, 200, world.time);
      world.effects.blood(ped.pos.x, 1, ped.pos.z);
      audio.crash();
      police.addWanted(1);
      hud.showMessage('You ran someone over!');
      hud.flashDamage();
    }
  }
}

// --- One-shot actions ---------------------------------------------------------
function handleActions() {
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (screen === 'play') setScreen('pause');
    else if (screen === 'pause') setScreen('play');
  }
  if (screen !== 'play') return;
  if (input.wasPressed('KeyM')) {
    audio.setMuted(!audio.isMuted());
    hud.showMessage(audio.isMuted() ? 'Sound off.' : 'Sound on.');
  }
  if (input.wasPressed('KeyE')) {
    if (player.mode === 'foot') {
      const car = nearestStealable(player.pos, 4.5);
      if (car) {
        traffic.removeFromTraffic(car);
        const freeIndex = freeCars.indexOf(car);
        if (freeIndex !== -1) freeCars.splice(freeIndex, 1);
        player.enterCar(car);
        world.save.carsStolen += 1;
        world.saveGame();
        audio.pickup();
        hud.showMessage("Nice wheels. This one's yours now.");
        const nearest = police.nearestCop(player.position);
        if (nearest && nearest.dist < 50) {
          police.addWanted(1);
          hud.showMessage('A cop saw you steal that car!');
        }
      }
    } else {
      freeCars.push(player.car);
      player.exitCar();
    }
  }
  if (input.wasPressed('KeyF') && player.mode === 'foot') {
    const result = combat.punch(player);
    if (result && result.kind === 'ped') {
      police.addWanted(result.killed ? 2 : 1);
      hud.showMessage(result.killed ? 'You knocked them out cold.' : 'That started a fight.');
    }
  }
  if (input.wasPressed('KeyR') && player.mode === 'foot') combat.startReload();
  if (input.mouse.leftPressed && player.mode === 'foot') {
    // The bullet leaves the player's shoulder along the camera's level
    // forward direction: aiming from the camera itself would send every
    // shot into the ground a few metres out.
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const origin = new THREE.Vector3(player.pos.x, 1.4, player.pos.z);
    const result = combat.shoot(origin, dir);
    if (result && result.kind !== 'miss') {
      if (result.kind === 'ped') {
        police.addWanted(result.killed ? 2 : 1);
        hud.showMessage(result.killed ? 'You shot someone!' : 'You hit someone!');
      } else if (result.kind === 'car') {
        police.addWanted(1);
        if (result.car && result.car.kind === 'police') hud.showMessage('You shot at the police!');
      }
    } else if (result && world.time - lastShotCrime > 2) {
      const nearest = police.nearestCop(player.position);
      if (nearest && nearest.dist < 60) {
        lastShotCrime = world.time;
        police.addWanted(1);
        hud.showMessage('Shots fired — the cops are coming!');
      }
    }
  }
}

// --- The loop -----------------------------------------------------------------
let last = performance.now();
let shotReadyAfter = 0;
let shotElapsed = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  const dt = Math.min(rawDt, 0.05);
  last = now;
  world.time += dt;

  if (shot && screen === 'play') {
    updateShotAutopilot(world);
    // Real time, not game time: on a slow machine the game clock lags and
    // the screenshot would wait forever.
    shotElapsed += rawDt;
    if (shotElapsed >= shotReadyAfter && !window.__shotReady) window.__shotReady = true;
  }

  handleActions();

  if (screen === 'title') {
    player.orbitCamera(camera, world.time, { x: 0, z: 0 });
    traffic.update(dt, null);
    peds.update(dt, world.time, null);
    world.effects.update(dt);
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }
  if (screen !== 'play') {
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }

  player.update(dt, input, camera);
  traffic.update(dt, player.position);
  peds.update(dt, world.time, player);
  collideCars();
  collideCarWithPeds();
  const policeResult = police.update(dt, player, world.time);
  if (policeResult === 'busted') doBusted();
  else if (policeResult === 'wasted') doWasted();
  missions.update(dt, world.time);
  combat.update(dt);
  world.effects.update(dt);
  audio.engine(player.mode === 'car' ? Math.abs(player.car.speed) / CAR.maxSpeed : 0, player.mode === 'car');

  // The sun's shadow camera follows the player.
  const focus = player.position;
  world.city.sun.position.set(focus.x + 120, 180, focus.z + 60);
  world.city.sun.target.position.set(focus.x, 0, focus.z);
  world.city.sun.target.updateMatrixWorld();

  hud.setObjective(missions.objectiveText, missions.target);
  hud.update(dt, {
    wanted: police.wanted,
    cash: world.save.cash,
    health: player.health,
    ammo: combat.ammo,
    reserve: combat.reserve,
    speed: player.mode === 'car' ? player.car.speed : 0,
    mode: player.mode,
    playerPos: player.position,
    playerHeading: player.heading,
    target: missions.target,
    missionActive: !!missions.active,
    traffic: traffic.all(),
    cops: police.cops,
    rivalCar: world.rivalCar,
    time: world.time,
    bustProgress: police.bustProgress,
    timerLeft: missions.stepTimeLeft,
    paused: false,
  });

  if (player.health <= 0 && screen === 'play') doWasted();

  renderer.render(scene, camera);
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') setScreen('pause');
});

// Any interaction unlocks audio (browsers start it suspended otherwise).
window.addEventListener('keydown', () => audio.init());
window.addEventListener('pointerdown', () => audio.init());

// A handle for playtesting from the console or a script.
window.__solmar = { world, get screen() { return screen; } };

if (shot === 'menu') {
  setScreen('title');
  // Real time: the title camera orbits while the panel is up.
  window.setTimeout(() => {
    window.__shotReady = true;
  }, 3500);
} else if (shot) {
  setScreen('play');
  const staged = stageShot(shot, world);
  shotReadyAfter = staged.readyAfter;
} else {
  setScreen('title');
}
requestAnimationFrame(frame);
