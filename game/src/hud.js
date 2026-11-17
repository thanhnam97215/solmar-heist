// The HUD: wanted stars, cash, health, ammo, speed, the mission objective,
// a live canvas minimap (roads, beach, the player, the target, cops and
// traffic), message feed, banners and the damage flash.
import { ROADS, WORLD } from './config.js';

const MAP_SIZE = 190;
const MAP_SCALE = MAP_SIZE / 560; // world -260..300 mapped into the canvas

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const starsEl = $('stars');
  const cashEl = $('cash');
  const healthFill = $('health-fill');
  const ammoEl = $('ammo');
  const speedEl = $('speed');
  const speedValue = $('speed-value');
  const objectiveEl = $('objective');
  const objectiveText = $('objective-text');
  const objectiveDist = $('objective-dist');
  const timerEl = $('timer');
  const messagesEl = $('messages');
  const bannerEl = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const crosshairEl = $('crosshair');
  const bustEl = $('bust');
  const bustFill = $('bust-fill');
  const damageEl = $('damage');
  const minimap = $('minimap');
  const mapCtx = minimap.getContext('2d');

  let last = {};
  let bannerTimer = 0;
  let damageFlash = 0;
  let objectiveTarget = null;

  function setText(el, key, value) {
    if (last[key] !== value) {
      el.textContent = value;
      last[key] = value;
    }
  }

  function mapX(x) {
    return (x + 260) * MAP_SCALE;
  }
  function mapY(z) {
    return (z + 260) * MAP_SCALE;
  }

  function drawMinimap(state) {
    const g = mapCtx;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Ground, sand, ocean.
    g.fillStyle = '#8a9078';
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    g.fillStyle = '#e8d49a';
    g.fillRect(mapX(WORLD.beachX), 0, mapX(WORLD.oceanX) - mapX(WORLD.beachX), MAP_SIZE);
    g.fillStyle = '#2f7fb8';
    g.fillRect(mapX(WORLD.oceanX), 0, MAP_SIZE - mapX(WORLD.oceanX), MAP_SIZE);
    // Roads.
    g.strokeStyle = '#3a3d42';
    g.lineWidth = 4;
    for (const c of ROADS) {
      g.beginPath();
      g.moveTo(mapX(c), 0);
      g.lineTo(mapX(c), MAP_SIZE);
      g.stroke();
      g.beginPath();
      g.moveTo(0, mapY(c));
      g.lineTo(MAP_SIZE, mapY(c));
      g.stroke();
    }
    // Traffic dots.
    g.fillStyle = '#ffffff';
    for (const car of state.traffic) {
      g.fillRect(mapX(car.pos.x) - 1, mapY(car.pos.z) - 1, 2, 2);
    }
    // Rival car.
    if (state.rivalCar && !state.rivalCar.wrecked) {
      g.fillStyle = '#ff4ad8';
      g.beginPath();
      g.arc(mapX(state.rivalCar.pos.x), mapY(state.rivalCar.pos.z), 4, 0, Math.PI * 2);
      g.fill();
    }
    // Cop blips flash red/blue.
    const phase = Math.floor(state.time * 4) % 2 === 0;
    for (const cop of state.cops) {
      g.fillStyle = phase ? '#ff4444' : '#4488ff';
      g.beginPath();
      g.arc(mapX(cop.pos.x), mapY(cop.pos.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Mission target diamond.
    if (state.target) {
      const tx = mapX(state.target.x);
      const ty = mapY(state.target.z);
      const pulse = 5 + Math.sin(state.time * 4) * 1.5;
      g.fillStyle = state.missionActive ? '#38d8e8' : '#ffc23a';
      g.beginPath();
      g.moveTo(tx, ty - pulse);
      g.lineTo(tx + pulse, ty);
      g.lineTo(tx, ty + pulse);
      g.lineTo(tx - pulse, ty);
      g.closePath();
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      g.stroke();
    }
    // Player arrow, pointing along the heading.
    const px = mapX(state.playerPos.x);
    const py = mapY(state.playerPos.z);
    g.save();
    g.translate(px, py);
    g.rotate(state.playerHeading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#222222';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(-5, -5);
    g.lineTo(0, -2.5);
    g.lineTo(5, -5);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  return {
    setObjective(text, target) {
      objectiveTarget = target;
      setText(objectiveText, 'objective', text);
    },
    showMessage(text) {
      const line = document.createElement('div');
      line.className = 'message';
      line.textContent = text;
      messagesEl.appendChild(line);
      while (messagesEl.children.length > 4) messagesEl.removeChild(messagesEl.firstChild);
      window.setTimeout(() => {
        line.classList.add('fade');
        window.setTimeout(() => line.remove(), 600);
      }, 4500);
    },
    showBanner(title, sub) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub || '';
      bannerEl.classList.add('show');
      bannerTimer = 5;
    },
    hideBanner() {
      bannerEl.classList.remove('show');
      bannerTimer = 0;
    },
    flashDamage() {
      damageFlash = 0.55;
    },
    update(dt, state) {
      // Wanted stars.
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
      setText(starsEl, 'stars', stars);
      starsEl.classList.toggle('hot', state.wanted > 0);
      setText(cashEl, 'cash', `$${state.cash.toLocaleString('en-US')}`);
      healthFill.style.width = `${Math.max(0, state.health)}%`;
      healthFill.classList.toggle('low', state.health < 30);
      setText(ammoEl, 'ammo', state.mode === 'foot' ? `🔫 ${state.ammo} / ${state.reserve}` : '');
      if (state.mode === 'car') {
        speedEl.classList.add('show');
        setText(speedValue, 'speed', `${Math.round(Math.abs(state.speed) * 3.6)}`);
      } else {
        speedEl.classList.remove('show');
      }
      crosshairEl.classList.toggle('show', state.mode === 'foot' && !state.paused);
      if (state.timerLeft > 0) {
        timerEl.classList.add('show');
        const total = Math.ceil(state.timerLeft);
        setText(timerEl, 'timer', `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`);
      } else {
        timerEl.classList.remove('show');
      }
      if (state.bustProgress > 0) {
        bustEl.classList.add('show');
        bustFill.style.width = `${state.bustProgress * 100}%`;
      } else {
        bustEl.classList.remove('show');
      }
      if (objectiveTarget && state.playerPos) {
        const d = Math.hypot(objectiveTarget.x - state.playerPos.x, objectiveTarget.z - state.playerPos.z);
        setText(objectiveDist, 'dist', `${Math.round(d)}m`);
      } else {
        setText(objectiveDist, 'dist', '');
      }
      objectiveEl.classList.toggle('show', state.missionActive || !!objectiveTarget);
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) bannerEl.classList.remove('show');
      }
      if (damageFlash > 0) {
        damageFlash = Math.max(0, damageFlash - dt * 1.4);
        damageEl.style.opacity = String(damageFlash);
      }
      drawMinimap(state);
    },
  };
}
