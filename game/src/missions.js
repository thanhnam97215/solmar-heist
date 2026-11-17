// The story: five missions that take the player from a nobody with no car
// to the crew's getaway legend. Each mission is a list of steps — reach a
// place, get in a car, beat a clock, wreck a rival, hold a vault — with a
// beacon on the map, an objective line in the HUD and a cash reward.
import { PLACES } from './config.js';
import { createBeacon } from './city.js';
import { damageCar, driveStep, makeVehicle } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief: "Rico needs a driver with no questions asked. Steal a car and bring it to his garage — that's the job interview.",
    reward: 400,
    start: PLACES.garage,
    steps: [
      { type: 'enterCar', label: 'Steal a car (walk up to one and press E)' },
      { type: 'reach', target: PLACES.garage, label: "Drive it to Rico's Garage", radius: 9 },
    ],
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    brief: 'Mara lifted a ledger from the Coral Club and the cops are already looking. Pick her up at the Sunset Diner and get her to the pier.',
    reward: 900,
    start: PLACES.diner,
    steps: [
      { type: 'reach', target: PLACES.diner, label: 'Pick up Mara at the Sunset Diner', radius: 8 },
      { type: 'reach', target: PLACES.pier, label: 'Drive Mara to Solmar Pier — the cops are coming', radius: 10, wanted: 2 },
    ],
  },
  {
    id: 'hot-delivery',
    title: 'Hot Delivery',
    brief: 'A crate at the Harbor Warehouse has to be at the Coral Beach Club in 100 seconds, and the harbour cops already know the route.',
    reward: 1200,
    start: PLACES.warehouse,
    steps: [
      { type: 'reach', target: PLACES.warehouse, label: 'Pick up the crate at the Harbor Warehouse', radius: 8 },
      { type: 'timedReach', target: PLACES.beachClub, label: 'Deliver the crate to the Coral Beach Club', radius: 10, seconds: 100, wanted: 2 },
    ],
  },
  {
    id: 'harbor-chase',
    title: 'Harbor Chase',
    brief: 'Vex, a rival wheelman, is bragging all over the North Docks that nobody can catch him. Ram his car until it stops.',
    reward: 1600,
    start: PLACES.rivalStart,
    steps: [
      { type: 'reach', target: PLACES.rivalStart, label: 'Find Vex at the North Docks', radius: 10 },
      { type: 'ram', label: "Ram Vex's car until it is wrecked", target: PLACES.rivalStart },
    ],
  },
  {
    id: 'solmar-heist',
    title: 'The Solmar Heist',
    brief: 'The big one. Meridian Bank, midday, four stars of heat. Grab the vault cash on foot and lose the cops at the safehouse.',
    reward: 5000,
    start: PLACES.bank,
    steps: [
      { type: 'reach', target: PLACES.bank, label: 'Get to Meridian Bank', radius: 10 },
      { type: 'stand', target: PLACES.vault, label: 'On foot: crack the vault (stay in the gold zone)', radius: 5, seconds: 6, wanted: 4 },
      { type: 'escape', target: PLACES.safehouse, label: 'Escape to the Safehouse', radius: 10 },
    ],
  },
];

export function createMissions(scene, world) {
  const startBeacon = createBeacon(0xffc23a);
  const targetBeacon = createBeacon(0x38d8e8);
  scene.add(startBeacon);
  scene.add(targetBeacon);
  targetBeacon.visible = false;

  let index = world.save.missionIndex || 0;
  let active = null; // { mission, stepIndex, stepTimer, standTimer }
  let rivalCar = null;
  let rivalWaypoint = null;
  let rivalThink = 0;

  function currentMission() {
    return index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function placeStartBeacon() {
    const mission = currentMission();
    if (!mission) {
      startBeacon.visible = false;
      return;
    }
    startBeacon.visible = true;
    startBeacon.position.set(mission.start.x, 0, mission.start.z);
  }

  function startMission() {
    const mission = currentMission();
    if (!mission) return;
    active = { mission, stepIndex: 0, stepTimer: 0, standTimer: 0 };
    startBeacon.visible = false;
    targetBeacon.visible = true;
    world.hud.showBanner(mission.title, mission.brief);
    if (world.audio) world.audio.pickup();
    beginStep();
  }

  function beginStep() {
    const step = active.mission.steps[active.stepIndex];
    active.stepTimer = step.seconds || 0;
    active.standTimer = 0;
    if (step.wanted) world.police.setWanted(step.wanted);
    if (step.type === 'ram') spawnRival();
    if (step.target) {
      targetBeacon.position.set(step.target.x, 0, step.target.z);
      targetBeacon.visible = true;
    } else {
      targetBeacon.visible = false;
    }
    world.hud.setObjective(step.label, step.target || null);
  }

  function spawnRival() {
    const start = PLACES.rivalStart;
    rivalCar = makeVehicle(scene, {
      x: start.x,
      z: start.z,
      heading: Math.PI / 4,
      color: 0xd838a0,
      kind: 'rival',
      sport: true,
    });
    world.rivalCar = rivalCar;
    rivalWaypoint = { x: start.x - 60, z: start.z + 40 };
    world.hud.showMessage("Vex is running! Ram his car until it stops.");
  }

  function updateRival(dt) {
    if (!rivalCar || rivalCar.wrecked) return;
    const playerPos = world.player.position;
    const distToPlayer = Math.hypot(rivalCar.pos.x - playerPos.x, rivalCar.pos.z - playerPos.z);
    rivalThink -= dt;
    if (rivalThink <= 0 || Math.hypot(rivalCar.pos.x - rivalWaypoint.x, rivalCar.pos.z - rivalWaypoint.z) < 15) {
      rivalThink = 1.5;
      // Pick a road point away from the player.
      let best = null;
      let bestScore = -Infinity;
      for (let i = 0; i < 6; i += 1) {
        const p = world.city.randomRoadPoint(world.rng);
        const score = Math.hypot(p.x - playerPos.x, p.z - playerPos.z) + Math.random() * 40;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      rivalWaypoint = best;
    }
    const dx = rivalWaypoint.x - rivalCar.pos.x;
    const dz = rivalWaypoint.z - rivalCar.pos.z;
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - rivalCar.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    driveStep(rivalCar, dt, {
      throttle: 1,
      steer: Math.max(-1, Math.min(1, diff * 2)),
      handbrake: Math.abs(diff) > 2,
    }, world);
    // Rubber band: never too far ahead, never too easy to catch.
    const cap = distToPlayer > 90 ? 12 : distToPlayer > 45 ? 24 : 33;
    if (rivalCar.speed > cap) rivalCar.speed = cap;
  }

  function completeStep() {
    active.stepIndex += 1;
    if (world.audio) world.audio.pickup();
    if (active.stepIndex >= active.mission.steps.length) completeMission();
    else beginStep();
  }

  function completeMission() {
    const mission = active.mission;
    active = null;
    targetBeacon.visible = false;
    if (rivalCar) {
      scene.remove(rivalCar.mesh);
      rivalCar = null;
      world.rivalCar = null;
    }
    index += 1;
    world.save.missionIndex = index;
    world.save.missionsDone += 1;
    world.save.totalEarned += mission.reward;
    world.save.cash += mission.reward;
    world.saveGame();
    if (world.audio) {
      world.audio.missionComplete();
      world.audio.cash();
    }
    world.effects.cashBurst(world.player.position.x, 1.5, world.player.position.z);
    const finished = index >= MISSIONS.length;
    if (finished) {
      world.save.finished = true;
      world.saveGame();
      world.hud.showBanner('SOLMAR LEGEND', `You pulled off the heist. $${mission.reward} is yours — the city is yours now. Free roam!`);
      world.onGameFinished();
    } else {
      world.hud.showBanner('MISSION COMPLETE', `${mission.title} — you earned $${mission.reward}. Next job is marked on the map.`);
    }
    placeStartBeacon();
  }

  function failMission(reason) {
    if (!active) return;
    const mission = active.mission;
    active = null;
    targetBeacon.visible = false;
    if (rivalCar) {
      scene.remove(rivalCar.mesh);
      rivalCar = null;
      world.rivalCar = null;
    }
    world.police.setWanted(0);
    world.hud.showBanner('MISSION FAILED', `${reason} — ${mission.title} is waiting at its marker when you are ready.`);
    if (world.audio) world.audio.busted();
    placeStartBeacon();
  }

  placeStartBeacon();

  return {
    get index() {
      return index;
    },
    get active() {
      return active;
    },
    get mission() {
      return currentMission();
    },
    get target() {
      if (active) {
        const step = active.mission.steps[active.stepIndex];
        return step.target || null;
      }
      const mission = currentMission();
      return mission ? mission.start : null;
    },
    get objectiveText() {
      if (active) {
        const step = active.mission.steps[active.stepIndex];
        if (step.type === 'stand') {
          if (world.player.mode !== 'foot') return 'Get out of the car and stand in the vault zone';
          const d = Math.hypot(world.player.position.x - step.target.x, world.player.position.z - step.target.z);
          if (d < step.radius) return `Cracking the vault… ${Math.ceil(step.seconds - active.standTimer)}s`;
        }
        return step.label;
      }
      const mission = currentMission();
      return mission ? `Next job: ${mission.title} — drive to the gold marker` : 'All jobs done — free roam Solmar Bay!';
    },
    get stepTimeLeft() {
      return active ? active.stepTimer : 0;
    },
    fail: failMission,
    // Back to the first job, as if the story never started.
    reset() {
      index = 0;
      active = null;
      if (rivalCar) {
        scene.remove(rivalCar.mesh);
        rivalCar = null;
        world.rivalCar = null;
      }
      targetBeacon.visible = false;
      placeStartBeacon();
    },
    // Jump straight to a mission and step (used to stage screenshots).
    stageMission(missionIndex, stepIndex) {
      index = missionIndex;
      const mission = MISSIONS[missionIndex];
      active = { mission, stepIndex, stepTimer: 0, standTimer: 0 };
      startBeacon.visible = false;
      const step = mission.steps[stepIndex];
      if (step.wanted) world.police.setWanted(step.wanted);
      if (step.type === 'ram') spawnRival();
      if (step.target) {
        targetBeacon.position.set(step.target.x, 0, step.target.z);
        targetBeacon.visible = true;
      }
      world.hud.setObjective(step.label, step.target || null);
    },
    update(dt, now) {
      startBeacon.userData.update(now);
      targetBeacon.userData.update(now);
      updateRival(dt);
      const playerPos = world.player.position;
      if (!active) {
        const mission = currentMission();
        if (mission && Math.hypot(playerPos.x - mission.start.x, playerPos.z - mission.start.z) < 9) {
          startMission();
        }
        return;
      }
      const step = active.mission.steps[active.stepIndex];
      if (step.type === 'enterCar') {
        if (world.player.mode === 'car') completeStep();
        return;
      }
      if (step.type === 'ram') {
        if (rivalCar && rivalCar.wrecked) {
          completeStep();
          return;
        }
        // Ramming damage is applied by the car-collision pass in main.js.
        return;
      }
      if (step.type === 'timedReach') {
        active.stepTimer -= dt;
        if (active.stepTimer <= 0) {
          failMission('Out of time.');
          return;
        }
      }
      if (step.type === 'stand') {
        if (world.player.mode !== 'foot') {
          active.standTimer = 0;
          return;
        }
        const d = Math.hypot(playerPos.x - step.target.x, playerPos.z - step.target.z);
        if (d < step.radius) {
          active.standTimer += dt;
          if (active.standTimer >= step.seconds) completeStep();
        } else {
          active.standTimer = 0;
        }
        return;
      }
      // reach / escape / timedReach: arrive at the target.
      const d = Math.hypot(playerPos.x - step.target.x, playerPos.z - step.target.z);
      if (d < (step.radius || 9)) completeStep();
    },
  };
}
