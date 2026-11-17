// Particles: one THREE.Points cloud with a fixed pool, reused for muzzle
// flashes, crash sparks, smoke, cash sparkles and skid dust. Dead particles
// are parked far below the world so nothing is allocated mid-frame.
import * as THREE from 'three';

const POOL = 420;

export function createEffects(scene) {
  const positions = new Float32Array(POOL * 3);
  const colors = new Float32Array(POOL * 3);
  const velocities = new Float32Array(POOL * 3);
  const life = new Float32Array(POOL);
  const gravity = new Float32Array(POOL);
  let cursor = 0;
  for (let i = 0; i < POOL; i += 1) positions[i * 3 + 1] = -999;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  function spawn(x, y, z, vx, vy, vz, seconds, r, g, b, pull) {
    const i = cursor;
    cursor = (cursor + 1) % POOL;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    velocities[i * 3] = vx;
    velocities[i * 3 + 1] = vy;
    velocities[i * 3 + 2] = vz;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    life[i] = seconds;
    gravity[i] = pull;
  }

  function burst(x, y, z, count, color, speed, seconds, pull) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n += 1) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.3;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, seconds * (0.6 + Math.random() * 0.7), c.r, c.g, c.b, pull);
    }
  }

  return {
    sparks(x, y, z) {
      burst(x, y, z, 14, 0xffc23a, 6, 0.5, 9);
    },
    smoke(x, y, z) {
      burst(x, y, z, 8, 0x666666, 1.5, 1.4, -0.6);
    },
    muzzle(x, y, z, dir) {
      spawn(x + dir.x, y + 0.1, z + dir.z, dir.x * 6, 0.5, dir.z * 6, 0.09, 1, 0.85, 0.3, 0);
      burst(x, y, z, 3, 0xffd76a, 3, 0.12, 0);
    },
    cashBurst(x, y, z) {
      burst(x, y, z, 22, 0x7ae07a, 4, 0.9, 3);
    },
    blood(x, y, z) {
      burst(x, y, z, 8, 0xb03030, 3, 0.5, 7);
    },
    update(dt) {
      for (let i = 0; i < POOL; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -999;
          continue;
        }
        velocities[i * 3 + 1] -= gravity[i] * dt;
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        if (positions[i * 3 + 1] < 0.05) positions[i * 3 + 1] = 0.05;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
  };
}
