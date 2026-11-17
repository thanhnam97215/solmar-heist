// Every sound is synthesized with WebAudio: engine hum, sirens, gunfire,
// jingles and a laid-back music loop. No audio files, no network, and the
// whole system stays silent until the player clicks Start (browsers require
// a gesture before audio may play).
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: a detuned sawtooth pair through a low-pass filter.
      engineOsc = ctx.createOscillator();
      const engineOsc2 = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2.type = 'sawtooth';
      engineOsc2.detune.value = 9;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a sine that swings between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, seconds, type, volume, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.02);
  }

  function noise(seconds, volume, filterFreq) {
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  // A slow four-chord loop: root notes on a soft triangle wave with a
  // brushed-hat tick, scheduled a bar at a time.
  const CHORD_ROOTS = [110, 87.31, 98, 130.81];
  function scheduleBar() {
    if (!ctx) return;
    const root = CHORD_ROOTS[musicStep % CHORD_ROOTS.length];
    musicStep += 1;
    const now = ctx.currentTime;
    [0, 0.5, 1.0, 1.5].forEach((beat, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = root * (i === 3 ? 1.5 : 1);
      gain.gain.setValueAtTime(0.0001, now + beat);
      gain.gain.exponentialRampToValueAtTime(0.5, now + beat + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + beat + 0.45);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(now + beat);
      osc.stop(now + beat + 0.5);
    });
  }

  return {
    init() {
      return ensure();
    },
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.55, ctx.currentTime);
    },
    isMuted() {
      return muted;
    },
    // speed01: 0..1 of top speed; on: false silences the engine.
    engine(speed01, on) {
      if (!ctx || !engineOsc) return;
      const target = on ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(on, time) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
      if (on) sirenOsc.frequency.setValueAtTime(Math.sin(time * 6) > 0 ? 720 : 540, ctx.currentTime);
    },
    shot() {
      noise(0.14, 0.5, 2800);
      blip(180, 0.08, 'square', 0.12, 60);
    },
    punch() {
      noise(0.08, 0.35, 500);
      blip(120, 0.1, 'sine', 0.3, 55);
    },
    crash() {
      noise(0.3, 0.4, 900);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.25);
      setTimeout(() => blip(1320, 0.16, 'sine', 0.25), 90);
    },
    cash() {
      blip(1046, 0.1, 'triangle', 0.25);
      setTimeout(() => blip(1568, 0.18, 'triangle', 0.25), 80);
    },
    denied() {
      blip(160, 0.18, 'square', 0.15, 110);
    },
    uiClick() {
      blip(660, 0.07, 'sine', 0.18);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => blip(freq, 0.22, 'triangle', 0.28), i * 110));
    },
    busted() {
      [392, 311, 233].forEach((freq, i) => setTimeout(() => blip(freq, 0.3, 'sawtooth', 0.14), i * 160));
    },
    wasted() {
      [330, 262, 196, 131].forEach((freq, i) => setTimeout(() => blip(freq, 0.32, 'sawtooth', 0.14), i * 170));
    },
    startMusic() {
      if (!ctx || musicTimer) return;
      scheduleBar();
      musicTimer = window.setInterval(scheduleBar, 2000);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
