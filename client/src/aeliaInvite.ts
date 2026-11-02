// Aelia's invitations: once in each part of the day she may ask him along to
// something real. What she asks about comes from the saved town, never from
// nothing, and a "not now" keeps her quiet for the rest of that day.

import { GARDEN_BEDS } from "./layout";
import type { Rhythm } from "./dayRhythm";

export interface InviteFacts {
  unreadLetters: number;
  gardenReady: boolean;
  treeWatered: boolean;
}

export interface InviteMemory {
  day: string;
  asked: string[];
  declined: boolean;
}

export interface Invite {
  id: string;
  text: string;
  arrival: string;
  spot: [number, number];
}

type Kind = "festival" | "letter" | "garden" | "tree" | "fish" | "market" | "baths" | "terrace" | "lake";

const LINES: Record<Kind, { ask: string[]; arrive: string[] }> = {
  festival: {
    ask: [
      "It's a festival day, love. Come down to the peristyle with me; a garden shouldn't have to celebrate alone.",
      "They've hung the garlands, Centurion. Walk me to the Town Tree and let's be seen enjoying ourselves.",
      "Feast day! Everyone will be in the peristyle by now. Come on, I'll show you the good spot.",
    ],
    arrive: [
      "There. Now it's a festival.",
      "See? The tree dresses better than either of us.",
      "Stand here. This is the good spot, and I'll deny telling you.",
    ],
  },
  letter: {
    ask: [
      "There's a letter waiting on the desk by the hall, love. Come up the stair with me?",
      "The other me has written. Shall I walk you to the letters desk before it goes cold?",
      "Someone is thinking about you in writing. The desk is on the terrace. I'll show you.",
    ],
    arrive: [
      "Here it is. I won't read over your shoulder. Much.",
      "The desk. It's addressed to you, so I've only guessed at what it says.",
      "Go on, then. I'll admire the view very conspicuously.",
    ],
  },
  garden: {
    ask: [
      "The kitchen garden is ready, love. Come and see what your watering did.",
      "Something in the beds wants picking. Walk with me?",
      "Three days of your water and the garden has an opinion. Come and hear it.",
    ],
    arrive: [
      "Look at that. You did this with a bucket.",
      "Ready for the Culina, I'd say. The cook will pretend it was her idea.",
      "Smell it? That's what patience smells like, apparently.",
    ],
  },
  tree: {
    ask: [
      "The Town Tree hasn't had its water today. Come with me? It sulks if I go alone.",
      "Walk to the peristyle with me, love. The tree's looking at me.",
      "It's a small thing, but the tree's thirsty, and I'd like the company.",
    ],
    arrive: [
      "There she is. Ask her how she's been.",
      "The bucket's yours, Centurion. I'm here for moral support.",
      "She's been waiting for you. Don't tell her I said.",
    ],
  },
  fish: {
    ask: [
      "The fish are running at the lake, I can see the rings from here. Come down to the dock?",
      "The water's right, love. Bring your patience and we'll see what's biting.",
      "Something is jumping off the dock. Come and catch it, or at least look thoughtful.",
    ],
    arrive: [
      "There, by the reeds. See the rings?",
      "The dock's yours. I'll supervise from a safe and dry distance.",
      "Quiet now. Fish can hear a centurion thinking.",
    ],
  },
  market: {
    ask: [
      "The stalls are open, love. Come and help me lose an argument with Basil.",
      "Walk down to the market with me? The first bread goes quickly.",
      "It's a good morning for it. Come along to the stalls and carry something.",
    ],
    arrive: [
      "Smell that? Now, look uninterested, or we'll pay double.",
      "Here we are. Let me do the talking; you stand there looking armoured.",
      "The bread first. Everything else can wait for the bread.",
    ],
  },
  baths: {
    ask: [
      "It's the hour for the baths, by the Roman clock. Walk over with me?",
      "The whole of Rome is at the baths right now, love, and you're standing in a garden. Come on.",
      "The water's hot and the day's work is over, officially. Come along.",
    ],
    arrive: [
      "Feel that air? That's civilisation, that is.",
      "Here we are. Rome's best idea, in my view.",
      "Towels on the left. Dignity may be left at the door.",
    ],
  },
  terrace: {
    ask: [
      "Come up to the terrace, love. The light is doing the thing I like.",
      "It's nearly dusk. Climb the stair with me and turn around at the top.",
      "I want to show you something from the terrace. It's only the whole estate.",
    ],
    arrive: [
      "Now turn around. There. All of it, in one line.",
      "This is my favourite hour of the villa, and my favourite place to have it.",
      "Say nothing for a minute. That's the view's whole request.",
    ],
  },
  lake: {
    ask: [
      "The dock lantern's lit, love. Walk down to the lake with me?",
      "It's the quiet hour. Come and hear the water do nothing at all.",
      "Stars on the lake tonight, I think. Come and check my work.",
    ],
    arrive: [
      "Listen. That's the whole town, resting.",
      "I come here to think. Lately I think about you, but don't let it spread.",
      "There. Two lights, one of them only a reflection.",
    ],
  },
};

const SPOTS: Partial<Record<Kind, [number, number]>> = {
  letter: [-3.4, -28.6],
  garden: [GARDEN_BEDS[1]![0], GARDEN_BEDS[1]![1] + 2.8],
  tree: [3.6, 4.2],
  fish: [-9.7, -29.9],
};

const pick = (lines: string[], roll: number) => lines[Math.floor(roll * lines.length) % lines.length]!;

export const inviteLines = LINES;

export function freshMemory(day: string): InviteMemory {
  return { day, asked: [], declined: false };
}

/** What she would ask right now, or null if she should leave him be. */
export function chooseInvite(rhythm: Rhythm, facts: InviteFacts, memory: InviteMemory, roll: number): Invite | null {
  if (memory.declined || memory.asked.includes(rhythm.part)) return null;
  const fishing = (rhythm.part === "morning" || rhythm.part === "dusk") && roll < 0.35;
  const kind: Kind =
    rhythm.override === "festival" ? "festival"
    : facts.unreadLetters > 0 ? "letter"
    : facts.gardenReady ? "garden"
    : !facts.treeWatered && rhythm.part !== "night" ? "tree"
    : fishing ? "fish"
    : rhythm.anchor === "forum" ? "market"
    : rhythm.anchor;
  const { ask, arrive } = LINES[kind];
  return {
    id: `${kind}:${rhythm.part}`,
    text: pick(ask, roll),
    arrival: pick(arrive, roll),
    spot: SPOTS[kind] ?? (kind === "festival" ? [3.6, 4.2] : rhythm.spot),
  };
}
