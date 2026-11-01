// Tiny synthesized sound jars for the Sound Cottage. Everything is
// generated with Web Audio on the first user tap — no audio files.

let actx: AudioContext | null = null;
let activeNodes: OscillatorNode[] = [];
let activeGains: GainNode[] = [];

function ctx(): AudioContext {
  if (!actx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new AC();
  }
  if (actx.state === "suspended") void actx.resume();
  return actx;
}

export function stopSounds() {
  for (const n of activeNodes) {
    try {
      n.stop();
    } catch {
      /* already stopped */
    }
  }
  activeNodes = [];
  activeGains = [];
}

function tone(
  freq: number,
  type: OscillatorType,
  gainValue: number,
  when = 0,
  duration?: number,
): OscillatorNode {
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainValue;
  osc.connect(gain).connect(ac.destination);
  const start = ac.currentTime + when;
  osc.start(start);
  if (duration) {
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.stop(start + duration + 0.05);
  }
  activeNodes.push(osc);
  activeGains.push(gain);
  return osc;
}

/** A short pleasant chime, played when a collectible is found. */
export function playChime() {
  stopSounds();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(f, "sine", 0.12, i * 0.09, 0.5));
}

/** A pebble's tick on the cobbles (Nov 1): one tiny filtered noise
 *  click — a stone sound, not a note. Deliberately does NOT stop
 *  other sounds: it's a garnish, not an event. */
export function playStoneTick(heavy = false) {
  try {
    const ac = ctx();
    const dur = heavy ? 0.07 : 0.045;
    const bufferSize = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) ** 2;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = heavy ? 900 : 2100;
    filter.Q.value = 1.1;
    const gain = ac.createGain();
    gain.gain.value = heavy ? 0.16 : 0.09;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
  } catch {
    /* silence is an acceptable stone sound */
  }
}

/** A stone meeting water (Nov 1): a soft descending plip — a short
 *  sine that falls in pitch as it fades, smaller for a skip. */
export function playSplash(small = false) {
  try {
    const ac = ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    const start = ac.currentTime;
    osc.frequency.setValueAtTime(small ? 620 : 480, start);
    osc.frequency.exponentialRampToValueAtTime(small ? 240 : 150, start + (small ? 0.14 : 0.22));
    gain.gain.setValueAtTime(small ? 0.07 : 0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (small ? 0.16 : 0.26));
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  } catch {
    /* silence is an acceptable splash */
  }
}

// --- Weather ambience -----------------------------------------------------
// Looping synthesized weather sound for Muse Town's random weather events:
// rain patter and wind are filtered noise, thunder is a low rumble burst.
// These run on their own node set so the Sound Cottage jars (stopSounds)
// never cut the weather off, and vice versa. Browsers only allow audio
// after a user gesture, so the shell starts these after the first tap.

export type WeatherSoundKind = "rain" | "storm" | "wind" | "none";

interface WeatherNodes {
  sources: AudioBufferSourceNode[];
  oscs: OscillatorNode[];
  gain: GainNode;
}

let weatherNodes: WeatherNodes | null = null;

function noiseBuffer(ac: AudioContext): AudioBuffer {
  const bufferSize = 2 * ac.sampleRate;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function stopWeatherAmbience() {
  if (!weatherNodes) return;
  const nodes = weatherNodes;
  weatherNodes = null;
  const ac = actx;
  if (!ac) return;
  try {
    nodes.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
    window.setTimeout(() => {
      for (const s of nodes.sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const o of nodes.oscs) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      }
    }, 900);
  } catch {
    /* context gone */
  }
}

export function startWeatherAmbience(kind: WeatherSoundKind) {
  stopWeatherAmbience();
  if (kind === "none") return;
  const ac = ctx();
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  const nodes: WeatherNodes = { sources: [], oscs: [], gain: master };
  const buffer = noiseBuffer(ac);

  const addNoise = (
    type: BiquadFilterType,
    frequency: number,
    q: number,
    level: number,
  ): BiquadFilterNode => {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const g = ac.createGain();
    g.gain.value = level;
    src.connect(filter).connect(g).connect(master);
    src.start();
    nodes.sources.push(src);
    return filter;
  };

  if (kind === "rain") {
    addNoise("lowpass", 950, 0.4, 0.05);
    addNoise("bandpass", 2600, 0.5, 0.012);
    master.gain.setTargetAtTime(1, ac.currentTime, 0.6);
  } else if (kind === "storm") {
    addNoise("lowpass", 750, 0.4, 0.085);
    const windFilter = addNoise("bandpass", 420, 0.9, 0.05);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();
    nodes.oscs.push(lfo);
    master.gain.setTargetAtTime(1, ac.currentTime, 0.6);
  } else {
    // Breezy: a soft wind band that slowly breathes up and down.
    const windFilter = addNoise("bandpass", 480, 0.8, 0.055);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.17;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 230;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();
    nodes.oscs.push(lfo);
    master.gain.setTargetAtTime(1, ac.currentTime, 0.8);
  }
  weatherNodes = nodes;
}

/** A low, rolling thunder rumble for storm lightning (kept gentle). */
export function playThunder() {
  const ac = ctx();
  const start = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(64, start);
  osc.frequency.exponentialRampToValueAtTime(38, start + 1.4);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.0001, start);
  oscGain.gain.exponentialRampToValueAtTime(0.16, start + 0.09);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.7);
  osc.connect(oscGain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + 1.8);

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 210;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.0001, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.1, start + 0.12);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.3);
  noise.connect(filter).connect(noiseGain).connect(ac.destination);
  noise.start(start);
  noise.stop(start + 1.4);
}

/** A tiny golden shimmer of notes when a sparkle shower arrives. */
export function playSparkleChime() {
  stopSounds();
  const notes = [1318.5, 1568.0, 2093.0, 2637.0];
  notes.forEach((f, i) => tone(f, "sine", 0.05, i * 0.11, 0.6));
}

export type SoundJar = "piano" | "crickets" | "leaves";

export function playJar(jar: SoundJar) {
  stopSounds();
  const ac = ctx();
  if (jar === "piano") {
    // A small music-box arpeggio.
    const seq = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 392.0];
    seq.forEach((f, i) => tone(f, "triangle", 0.14, i * 0.16, 0.45));
  } else if (jar === "crickets") {
    // Rhythmic high chirps for a few seconds.
    for (let i = 0; i < 14; i++) {
      tone(4200 + Math.random() * 300, "sine", 0.03, i * 0.28, 0.09);
      tone(4200 + Math.random() * 300, "sine", 0.03, i * 0.28 + 0.12, 0.09);
    }
  } else {
    // Town tree leaves: filtered noise rustling in a slow breeze.
    const bufferSize = 2 * ac.sampleRate;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.6;
    const gain = ac.createGain();
    gain.gain.value = 0.06;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(filter.frequency);
    noise.connect(filter).connect(gain).connect(ac.destination);
    noise.start();
    lfo.start();
    window.setTimeout(() => {
      try {
        noise.stop();
        lfo.stop();
      } catch {
        /* already stopped */
      }
    }, 4000);
  }
}
