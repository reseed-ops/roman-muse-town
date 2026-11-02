// Tiny synthesized sound jars for the Sound Cottage. Everything is
// generated with Web Audio on the first user tap, no audio files.

import { FEEL } from "./feel";
import type { Footing } from "./footing";
import { dripDelay, dropletDelay, shelterCutoff } from "./rainMood";

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

/** Open the context from a real gesture, so quiet sounds need never ask. */
export function unlockAudio() {
  ctx();
}

let stepNoise: AudioBuffer | null = null;

const STEP_VOICE: Record<Footing, { cutoff: number; q: number; level: number; length: number }> = {
  stone: { cutoff: 1500, q: 1.1, level: 0.16, length: 0.07 },
  grass: { cutoff: 620, q: 0.5, level: 0.085, length: 0.1 },
  gravel: { cutoff: 2300, q: 0.7, level: 0.1, length: 0.11 },
  wood: { cutoff: 420, q: 2.6, level: 0.22, length: 0.09 },
  water: { cutoff: 1000, q: 0.6, level: 0.13, length: 0.2 },
};

/** A short filtered thump. Sounds this small are only worth making while
 *  the clock runs: on a suspended context they would never finish. */
function thump(cutoff: number, q: number, level: number, length: number) {
  const ac = actx;
  if (!ac || ac.state !== "running") return;
  stepNoise ??= noiseBuffer(ac);
  const start = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = stepNoise;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff * (0.9 + Math.random() * 0.2);
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(level * FEEL.stepVolume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(start, Math.random() * 1.5, length + 0.02);
}

export function playFootstep(footing: Footing) {
  const v = STEP_VOICE[footing];
  thump(v.cutoff, v.q, v.level, v.length);
}

export function playLanding(footing: Footing) {
  const v = STEP_VOICE[footing];
  thump(v.cutoff * 0.7, v.q, v.level * 2, v.length * 1.8);
}

export function playSlide(footing: Footing) {
  const v = STEP_VOICE[footing];
  thump(v.cutoff * 1.6, 0.4, v.level * 1.3, 0.55);
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
 *  click, a stone sound, not a note. Deliberately does NOT stop
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

/** A stone meeting water (Nov 1): a soft descending plip: a short
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
  kind: WeatherSoundKind;
  sources: AudioBufferSourceNode[];
  oscs: OscillatorNode[];
  gain: GainNode;
  /** Rain only: the bed the slow swell rides on. */
  swell?: GainNode;
  /** Rain only: rounds the sound off under a roof. */
  shelter?: BiquadFilterNode;
  /** Rain only: stops the droplet and drip timers. */
  stopTimers?: () => void;
}

let weatherNodes: WeatherNodes | null = null;
/** How hard it is raining, 0..1: the scene's swell, read by the droplets. */
let rainLevel = 0.6;

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
  nodes.stopTimers?.();
  const ac = actx;
  if (!ac) return;
  // Rain leaves slowly, the way it does.
  const rain = nodes.kind === "rain";
  try {
    nodes.gain.gain.setTargetAtTime(0.0001, ac.currentTime, rain ? 1.3 : 0.25);
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
    }, rain ? 6000 : 900);
  } catch {
    /* context gone */
  }
}

/** Follow the scene's swell: the bed leans in and out over a few
 *  seconds, and the droplets thicken and thin with it. */
export function setRainLevel(level: number) {
  rainLevel = level;
  const nodes = weatherNodes;
  if (!actx || !nodes?.swell) return;
  nodes.swell.gain.setTargetAtTime(0.55 + level * 0.45, actx.currentTime, 3);
}

/** Step under a roof and the rain draws back to a soft drumming. */
export function setRainShelter(amount: number) {
  const nodes = weatherNodes;
  if (!actx || !nodes?.shelter) return;
  nodes.shelter.frequency.setTargetAtTime(shelterCutoff(amount * FEEL.shelterMuffle), actx.currentTime, 0.8);
}

/** One soft tick of a drop landing: a sliver of filtered noise, placed
 *  somewhere in the stereo field. */
function playDroplet(ac: AudioContext, buffer: AudioBuffer, master: GainNode) {
  const start = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1500 + Math.random() * 2400;
  filter.Q.value = 3 + Math.random() * 4;
  const gain = ac.createGain();
  const peak = (0.03 + Math.random() * 0.05) * FEEL.dropletVolume;
  const decay = 0.03 + Math.random() * 0.05;
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  const pan = ac.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  src.connect(filter).connect(gain).connect(pan).connect(master);
  src.start(start, Math.random() * 1.8, decay + 0.02);
}

/** A slow drip off an eave: one small round note that bends upward. */
function playDrip(ac: AudioContext, master: GainNode) {
  const start = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  const pitch = 700 + Math.random() * 500;
  osc.frequency.setValueAtTime(pitch, start);
  osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, start + 0.05);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.016, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
  const pan = ac.createStereoPanner();
  pan.pan.value = Math.random() * 1.2 - 0.6;
  osc.connect(gain).connect(pan).connect(master);
  osc.start(start);
  osc.stop(start + 0.13);
}

export function startWeatherAmbience(kind: WeatherSoundKind) {
  // Already playing: leave it be, so a shower isn't restarted by a
  // re-render of the same weather.
  if (weatherNodes?.kind === kind) return;
  stopWeatherAmbience();
  if (kind === "none") return;
  const ac = ctx();
  const master = ac.createGain();
  master.gain.value = 0.0001;
  const nodes: WeatherNodes = { kind, sources: [], oscs: [], gain: master };
  if (kind === "rain") {
    const shelter = ac.createBiquadFilter();
    shelter.type = "lowpass";
    shelter.frequency.value = shelterCutoff(0);
    master.connect(shelter).connect(ac.destination);
    nodes.shelter = shelter;
  } else {
    master.connect(ac.destination);
  }
  const buffer = noiseBuffer(ac);

  const addNoise = (
    type: BiquadFilterType,
    frequency: number,
    q: number,
    level: number,
    into: AudioNode = master,
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
    src.connect(filter).connect(g).connect(into);
    src.start();
    nodes.sources.push(src);
    return filter;
  };

  if (kind === "rain") {
    // A low, soft bed and a faint airy wash, riding the slow swell, with
    // droplets and the odd drip scattered over it. Steady noise alone
    // reads as hiss; it's the unevenness on top that reads as rain.
    const swell = ac.createGain();
    swell.gain.value = 0.55 + rainLevel * 0.45;
    swell.connect(master);
    nodes.swell = swell;
    addNoise("lowpass", 560, 0.3, 0.075, swell);
    addNoise("bandpass", 1500, 0.35, 0.011, swell);
    const timers = new Set<number>();
    const after = (seconds: number, run: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        run();
      }, seconds * 1000);
      timers.add(id);
    };
    // Scheduled on a stopped clock, a drop never plays, never ends and is
    // never freed, so a backgrounded phone would stack them up by the
    // thousand. Asking to resume brings the rain back with the page.
    const whenAudible = (play: () => void) => {
      if (ac.state === "running") play();
      else void ac.resume();
    };
    const nextDroplet = () => {
      whenAudible(() => playDroplet(ac, buffer, master));
      after(dropletDelay(rainLevel, Math.random), nextDroplet);
    };
    const nextDrip = () => {
      whenAudible(() => playDrip(ac, master));
      after(dripDelay(Math.random), nextDrip);
    };
    after(1, nextDroplet);
    after(dripDelay(Math.random), nextDrip);
    nodes.stopTimers = () => {
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    };
    master.gain.setTargetAtTime(1, ac.currentTime, 1.4);
  } else if (kind === "storm") {
    addNoise("lowpass", 680, 0.4, 0.07);
    const windFilter = addNoise("bandpass", 420, 0.9, 0.034);
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

/** Thunder a long way off: a slow, low roll with no crack in it, more
 *  felt than heard, so a storm stays cosy from indoors. */
export function playThunder() {
  const ac = ctx();
  const start = ac.currentTime;
  const roll = 2.6 + Math.random() * 1.6;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(52, start);
  osc.frequency.exponentialRampToValueAtTime(34, start + roll);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.0001, start);
  oscGain.gain.exponentialRampToValueAtTime(0.07, start + 0.45);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, start + roll);
  osc.connect(oscGain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + roll + 0.1);

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac);
  noise.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 130;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.0001, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.06, start + 0.6);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + roll);
  noise.connect(filter).connect(noiseGain).connect(ac.destination);
  noise.start(start);
  noise.stop(start + roll + 0.1);
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
