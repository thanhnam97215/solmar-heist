// Save games live in localStorage: cash, mission progress and lifetime stats.
// Everything is guarded, so a browser with storage switched off just plays
// without saving instead of crashing.
import { SAVE_KEY } from './config.js';

export function blankSave() {
  return {
    cash: 150,
    missionIndex: 0,
    missionsDone: 0,
    totalEarned: 0,
    bestWanted: 0,
    carsStolen: 0,
    finished: false,
    version: 1,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return { ...blankSave(), ...data };
  } catch {
    return null;
  }
}

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
