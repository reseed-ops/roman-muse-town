// A night together (Task 45, the owner's decision of Nov 8, 2026):
// implied and never shown. The door closes, the lamp dims, the screen
// goes dark, and morning comes. Nothing explicit is ever shown,
// described or said, at any rank; the fade says it. Shared by the
// client (which runs the moment) and the bridge's output filter tests
// (which prove these lines pass from rank 7 and explicit ones never).

/** The terrace kiss's rank: the night is offered from here. */
export const NIGHT_RANK = 7;
/** Never in a visit's opening minutes. */
export const NIGHT_VISIT_GRACE_MS = 5 * 60 * 1000;

/** He asks, by the bed. */
export const NIGHT_ASK_PROMPT = "Stay together tonight";

/** Her yes to his asking. */
export const NIGHT_ACCEPT_LINES = [
  "Stay with me tonight. I'm glad you're here.",
  "Yes. Stay with me tonight, love.",
  "I was hoping you'd ask. Stay.",
];
/** Her gentle no: it ends as an ordinary rest till morning, no penalty. */
export const NIGHT_DECLINE_LINES = [
  "Not tonight, love. Just hold me, and we'll rest.",
  "Not tonight. Lie quiet with me till morning instead.",
  "Another night, I think. Tonight, just rest with me.",
];
/** Her own invitation, when her mood and the day allow it. */
export const NIGHT_INVITE_LINES = [
  "Stay with me tonight?",
  "The lamp's low and the town is quiet. Stay with me tonight?",
  "Don't go back out. Stay with me tonight?",
];
export const NIGHT_INVITE_YES = "Stay with her";
export const NIGHT_INVITE_NO = "Not tonight";
/** Her kindness when he declines her: her mood stays kind. */
export const NIGHT_INVITE_DECLINED_LINES = [
  "Of course. Sit with me a while, then. I'm glad you're here.",
  "Another night. I like just having you home.",
];
/** The morning: one soft line, waking together. */
export const NIGHT_MORNING_LINES = [
  "Good morning. Look at the light on the wall.",
  "You're still here. Good. Stay a little longer.",
  "Morning already. I could get used to waking like this.",
];
/** Her first talk later that day, the warmth carried. */
export const NIGHT_AFTERGLOW_LINE = "I keep smiling for no reason today. You know why.";

/** Every line she can say in this moment, for the filter's tests. */
export const NIGHT_LINES = [
  ...NIGHT_ACCEPT_LINES,
  ...NIGHT_DECLINE_LINES,
  ...NIGHT_INVITE_LINES,
  ...NIGHT_INVITE_DECLINED_LINES,
  ...NIGHT_MORNING_LINES,
  NIGHT_AFTERGLOW_LINE,
];

/** The night a moment belongs to: the evening's date, so the hours
 *  after midnight count as the same night (YYYY-MM-DD, local). */
export function nightKey(now: Date): string {
  const d = new Date(now.getTime());
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface NightFacts {
  rank: number;
  /** The town's sky says night. */
  night: boolean;
  /** He and she are both inside the house. */
  bothHome: boolean;
  walking: boolean;
  /** A quarrel open, or one mended today, or a heavy day she was told of today. */
  troubled: boolean;
  /** Something else holds the moment: a dream, the summit, a boat, a seat. */
  busy: boolean;
  /** The night this moment would belong to, and the last night it was had. */
  tonight: string;
  lastNight: string | null;
  /** A visit's start (ms) if a visit is open, and the time now (ms). */
  visitBeganAt: number | null;
  now: number;
}

/** Why the night is not offered, or null when it is. */
export function nightBlocked(f: NightFacts): string | null {
  if (f.rank < NIGHT_RANK) return "rank";
  if (!f.night) return "day";
  if (!f.walking || !f.bothHome) return "not home";
  if (f.busy) return "busy";
  if (f.troubled) return "troubled";
  if (f.lastNight === f.tonight) return "once a night";
  if (f.visitBeganAt !== null && f.now - f.visitBeganAt < NIGHT_VISIT_GRACE_MS) return "visit opening";
  return null;
}

/** Her answer to his asking: usually yes; sometimes a gentle no, and
 *  more often when the day was a quiet one between them. */
export function acceptsAsk(roll: number, opts: { talkedToday: boolean }): boolean {
  return roll < (opts.talkedToday ? 0.8 : 0.6);
}

/** Whether she invites him herself tonight (decided once a night). */
export function invitesTonight(roll: number, opts: { talkedToday: boolean }): boolean {
  return opts.talkedToday && roll < 0.45;
}

/** How long the dark lasts, in ms: shorter with reduced motion. */
export function darkBeatMs(reducedMotion: boolean): number {
  return reducedMotion ? 2200 : 4200;
}
