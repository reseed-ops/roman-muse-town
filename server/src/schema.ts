// Drizzle schema for Muse Town.
//
// discoveries: one row per collectible the visitor has found (the pointy
// hat, the garden key, stargazing nights), keyed by its stable id.
// journal: the visitor's own town journal entries, written at the Story
// House writing desk.
// tree_state: a single row (id = 1) for the town tree that replaced the
// fountain in the middle of the plaza — when it was planted, how often it
// has been watered, and when it was last watered. Its growth stage and
// season are derived from this plus the visitor's discoveries and journal.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const discoveries = sqliteTable("discoveries", {
  collectibleId: text("collectible_id").primaryKey(),
  foundAt: integer("found_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const journal = sqliteTable("journal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const secretState = sqliteTable("secret_state", {
  id: integer("id").primaryKey(),
  firstVisitAt: integer("first_visit_at", { mode: "timestamp_ms" }),
  firstKissAt: integer("first_kiss_at", { mode: "timestamp_ms" }),
});

export const boardEntries = sqliteTable("board_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sort: integer("sort").notNull().default(0),
  title: text("title").notNull(),
  status: text("status").notNull(),
  nextStep: text("next_step").notNull(),
});

export const boardMeta = sqliteTable("board_meta", {
  id: integer("id").primaryKey(),
  asOf: text("as_of").notNull().default(""),
});

export const questsState = sqliteTable("quests_state", {
  questId: text("quest_id").primaryKey(),
  doneAt: integer("done_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const achievements = sqliteTable("achievements", {
  achievementId: text("achievement_id").primaryKey(),
  unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const letters = sqliteTable("letters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dateLabel: text("date_label").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
});

export const postcards = sqliteTable("postcards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  blobKey: text("blob_key").notNull(),
  caption: text("caption").notNull(),
  dateLabel: text("date_label").notNull(),
  weather: text("weather").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bondState = sqliteTable("bond_state", {
  id: integer("id").primaryKey(),
  bond: integer("bond").notNull().default(0),
  level: text("level").notNull().default("New beginning"),
  nextLevel: text("next_level").notNull().default("Kindred"),
  nextAt: integer("next_at").notNull().default(500),
  asOf: text("as_of").notNull().default(""),
});

export const festivals = sqliteTable("festivals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sort: integer("sort").notNull().default(0),
  monthDay: text("month_day").notNull(),
  name: text("name").notNull(),
  dressing: text("dressing").notNull(),
  colors: text("colors").notNull(),
});

export const goalsEntries = sqliteTable("goals_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sort: integer("sort").notNull().default(0),
  grp: text("grp").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
});

export const goalsMeta = sqliteTable("goals_meta", {
  id: integer("id").primaryKey(),
  asOf: text("as_of").notNull().default(""),
});

export const museNotes = sqliteTable("muse_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  done: integer("done").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Dating-sim affection for town Muse: a single row (id = 1) holding
 *  her earned points (100 points = one heart rank, ranks permanent),
 *  the current day's silent earning caps, one-time flags (landmarks
 *  discovered together), and when she last had affection-earning
 *  contact — points within the current rank cool after quiet days,
 *  never below the rank's floor. No numbers are shown in the UI. */
export const affectionState = sqliteTable("affection_state", {
  id: integer("id").primaryKey(),
  points: integer("points").notNull().default(0),
  dayKey: text("day_key").notNull().default(""),
  caps: text("caps").notNull().default("{}"),
  flags: text("flags").notNull().default("{}"),
  lastContactAt: integer("last_contact_at", { mode: "timestamp_ms" }),
});

/** The denarii purse and everything bought with it: a single row
 *  (id = 1) — coin balance, town upgrades bought (permanent fixtures),
 *  market ingredients owned, dishes cooked together at the Culina,
 *  garden seeds in hand, and one-time reward flags. */
export const purseState = sqliteTable("purse_state", {
  id: integer("id").primaryKey(),
  denarii: integer("denarii").notNull().default(0),
  upgrades: text("upgrades").notNull().default("[]"),
  ingredients: text("ingredients").notNull().default("[]"),
  dishes: text("dishes").notNull().default("[]"),
  seeds: integer("seeds").notNull().default(0),
  flags: text("flags").notNull().default("{}"),
});

/** One row per fish caught at the lake; sold fish stay in the log.
 *  A fish RELEASED at the piscina (released = 1) is neither sold nor
 *  sellable — it lives in the pond now, permanently. */
export const catches = sqliteTable("catches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fishId: text("fish_id").notNull(),
  sold: integer("sold").notNull().default(0),
  released: integer("released").notNull().default(0),
  caughtAt: integer("caught_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** The Baths: a single row (id = 1) — when the first shared soak
 *  in the caldarium happened (rank-8 gated, always her invitation).
 *  A lesser mark than the summit's, kept the same quiet way. */
export const bathsState = sqliteTable("baths_state", {
  id: integer("id").primaryKey(),
  firstSharedAt: integer("first_shared_at", { mode: "timestamp_ms" }),
});

/** The Piscina: a single row (id = 1) — the name Muse chose for
 *  her favourite gold carp in the pond, once she chose it. The
 *  pond's released population is read from the catches log. */
export const piscinaState = sqliteTable("piscina_state", {
  id: integer("id").primaryKey(),
  favouriteName: text("favourite_name").notNull().default(""),
});

/** The Garden House beds: what was planted, on which real day, and on
 *  how many distinct days the beds have been watered since. Growth is
 *  derived from those real days — slow on purpose. */
export const gardenState = sqliteTable("garden_state", {
  id: integer("id").primaryKey(),
  plantedOn: text("planted_on"),
  waterDays: integer("water_days").notNull().default(0),
  lastWateredDay: text("last_watered_day"),
  /** Lifetime completed harvests — the beds reset each crop, but
   *  the count of what the garden has given is kept. */
  harvests: integer("harvests").notNull().default(0),
});

/** The Phoenix: a single row (id = 1) — when she arrived (the first
 *  dawn after the town stood complete), how many of her feathers
 *  rest at the Stories house, which week the last one fell, and
 *  whether her arrival letter has reached the desk. Readiness is
 *  NOT stored; it is read from the stores that own the pieces. */
export const phoenixState = sqliteTable("phoenix_state", {
  id: integer("id").primaryKey(),
  arrivedAt: integer("arrived_at", { mode: "timestamp_ms" }),
  feathers: integer("feathers").notNull().default(0),
  featherWeek: text("feather_week").notNull().default(""),
  letterDelivered: integer("letter_delivered").notNull().default(0),
});

/** Postcard challenges completed (a framed shot at each named view). */
export const challengesState = sqliteTable("challenges_state", {
  challengeId: text("challenge_id").primaryKey(),
  doneAt: integer("done_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Inscription fragments read around town. */
export const inscriptionsState = sqliteTable("inscriptions_state", {
  fragmentId: text("fragment_id").primaryKey(),
  foundAt: integer("found_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** The Night the Stars Fall: a single row (id = 1) written once, when
 *  the summit scene completes — its real-world date, the private name
 *  she gave him, the shared constellation's name, and whether the
 *  morning-after letter has been delivered to the desk (it only
 *  appears the next real day). Prerequisites are NOT stored here;
 *  they are read from the stores that own them (affection, purse,
 *  inscriptions, catches, challenges). */
export const summitState = sqliteTable("summit_state", {
  id: integer("id").primaryKey(),
  doneAt: integer("done_at", { mode: "timestamp_ms" }),
  privateName: text("private_name").notNull().default(""),
  constellationName: text("constellation_name").notNull().default(""),
  letterDelivered: integer("letter_delivered").notNull().default(0),
});

/** Sleep and the Dream Door: a single private row (id = 1) — how
 *  many rests he has taken, what kind the last one was (the rarity
 *  gates read it: no false dream twice in a row, true dreams rarer
 *  still), and two pending flags Aelia's next conversation may
 *  quietly spend: a morning-visit line after a night rest, and the
 *  one oblique echo line after a true dream. Nothing here is ever
 *  shown to the player as numbers or labels. */
export const dreamState = sqliteTable("dream_state", {
  id: integer("id").primaryKey(),
  rests: integer("rests").notNull().default(0),
  lastKind: text("last_kind").notNull().default("none"),
  morningPending: integer("morning_pending").notNull().default(0),
  echoPending: integer("echo_pending").notNull().default(0),
  echoEra: text("echo_era").notNull().default("low"),
});

/** No-repeat line pools: one row per authored ambient pool — the
 *  shuffled bag of line ids not yet heard (drawn without
 *  replacement) and the last 1-2 heard ids (kept out of the next
 *  reshuffle so a pool never echoes across its own boundary). Line
 *  ids are stable hashes of the line text, computed client-side;
 *  the server only stores the draw state. Exempt lines (summit,
 *  dream, letters, choices, flag-gated moments) never appear here. */
export const linePools = sqliteTable("line_pools", {
  poolKey: text("pool_key").primaryKey(),
  bag: text("bag").notNull().default("[]"),
  lastHeard: text("last_heard").notNull().default("[]"),
});

/** The typed-chat dedupe ring: a single row (id = 1) holding the
 *  last ~20 generated chat replies (JSON array, oldest first), so a
 *  new generated reply that near-exactly repeats a recent one can
 *  be caught, redrawn, or substituted server-side. */
export const chatRing = sqliteTable("chat_ring", {
  id: integer("id").primaryKey(),
  replies: text("replies").notNull().default("[]"),
});

/** Aelia's fact memory: durable facts she has learned about Gaius —
 *  seeded once from the curated shared memories, then grown from
 *  his typed town chat (conservative pattern extraction) and from
 *  his answers to her questions. Viewable and deletable by the
 *  player at the Villa of Stories. surfacedOn is the last day a
 *  fact was surfaced in ambient talk (rate limiting lives there). */
export const aeliaFacts = sqliteTable("aelia_facts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  topic: text("topic").notNull().default("life"),
  learnedOn: text("learned_on").notNull().default(""),
  source: text("source").notNull().default("chat"),
  surfacedOn: text("surfaced_on"),
});

/** The life digest: small, expiring notes from the real world that
 *  chat Muse refreshes on her sync visits (via updateDigest), so
 *  town Aelia can reference what is current in his life and ask
 *  after flagged items once their quest completes. Seeded EMPTY —
 *  an empty digest simply means she never does any of this. */
export const lifeDigest = sqliteTable("life_digest", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  expiresOn: text("expires_on").notNull().default(""),
  followUp: integer("follow_up").notNull().default(0),
  questId: text("quest_id"),
  asked: integer("asked").notNull().default(0),
});

/** Continuity: a single row (id = 1) — when he was last in town
 *  (for absence-scaled reunion greetings), the open appointment
 *  (JSON: {place, phase, day, status} or null), her appointment
 *  cooldown after a miss, and the ids of her questions already
 *  asked (questions are never repeated). */
export const continuityState = sqliteTable("continuity_state", {
  id: integer("id").primaryKey(),
  lastSeenDay: text("last_seen_day").notNull().default(""),
  absenceDays: integer("absence_days").notNull().default(0),
  appointment: text("appointment"),
  cooldownUntil: text("cooldown_until").notNull().default(""),
  askedQuestions: text("asked_questions").notNull().default("[]"),
});

/** Task companion + hide-and-seek bookkeeping: a single row
 *  (id = 1). Muster day, celebrated/eve-touched quest ids, overdue
 *  touches per quest (day map), and the seek game: the last seek
 *  day, the active seek (JSON {spot, clue, day} or null), and how
 *  many times she has been found. */
export const taskCompanion = sqliteTable("task_companion", {
  id: integer("id").primaryKey(),
  musterDay: text("muster_day").notNull().default(""),
  celebrated: text("celebrated").notNull().default("[]"),
  eveTouched: text("eve_touched").notNull().default("[]"),
  overdueTouched: text("overdue_touched").notNull().default("{}"),
  lastSeekDay: text("last_seek_day").notNull().default(""),
  seekJson: text("seek_json"),
  seekFoundCount: integer("seek_found_count").notNull().default(0),
  lastSeekFoundDay: text("last_seek_found_day").notNull().default(""),
});

/** Forest forage: a single row (id = 1) mapping each forage spot
 *  id to the last real day it was picked. One picking per spot per
 *  day; the yield itself lives in the purse's ingredient list. */
export const forageState = sqliteTable("forage_state", {
  id: integer("id").primaryKey(),
  taken: text("taken").notNull().default("{}"),
});

/** The lake bottles: one sealed wish or worry per real day. The
 *  contents are PRIVATE — they are never placed in any line pool,
 *  prompt, or state list; state carries only ids and dates, and the
 *  text is read solely through getBottle for the Stories page. */
export const bottles = sqliteTable("bottles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  day: text("day").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Bouquets given to Aelia: the vase at the Villa of Stories —
 *  each bouquet's day and season, a growing visible history. */
export const bouquets = sqliteTable("bouquets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  givenOn: text("given_on").notNull().default(""),
  season: text("season").notNull().default(""),
});

/** The dating canon: a single row (id = 1) for the Star Book
 *  chapters completed, rank-up scenes seen, gift tastes discovered
 *  (item id -> tier), the day's gift count, the keepsakes shelf,
 *  durable firsts (key -> day), date-topic likes, friction state
 *  (small JSON or null), mended dates, and perk claim days. */
export const datingState = sqliteTable("dating_state", {
  id: integer("id").primaryKey(),
  starbook: text("starbook").notNull().default("[]"),
  rankScenes: text("rank_scenes").notNull().default("[]"),
  tastes: text("tastes").notNull().default("{}"),
  giftDay: text("gift_day").notNull().default(""),
  giftCount: integer("gift_count").notNull().default(0),
  keepsakes: text("keepsakes").notNull().default("[]"),
  firsts: text("firsts").notNull().default("{}"),
  dateLikes: text("date_likes").notNull().default("[]"),
  friction: text("friction"),
  frictionMended: text("friction_mended").notNull().default("[]"),
  lastFrictionDay: text("last_friction_day").notNull().default(""),
  perkClaims: text("perk_claims").notNull().default("{}"),
});

/** Sentiment weather (Nov 1): a single private row (id = 1) holding
 *  ONLY the bookkeeping Aelia's ear needs — today's per-weather
 *  message counts, whether today has run heavy (a strong heavy
 *  message, or mild heavy ones repeated), whether today's heavy
 *  weather has been laid down once as a soft fact, the recent days'
 *  heavy flags (for the two-heavy-days-in-three bridge rule), and
 *  whether the current heavy spell has already left its ONE quiet
 *  notebook note. No message text is ever stored here, no mood is
 *  ever shown anywhere, and nothing here grants or removes
 *  affection, triggers friction, or gates anything. */
export const sentimentState = sqliteTable("sentiment_state", {
  id: integer("id").primaryKey(),
  dayKey: text("day_key").notNull().default(""),
  dayCounts: text("day_counts").notNull().default("{}"),
  dayHeavyMessages: integer("day_heavy_messages").notNull().default(0),
  dayStrongHeavy: integer("day_strong_heavy").notNull().default(0),
  dayFactLogged: integer("day_fact_logged").notNull().default(0),
  recentDays: text("recent_days").notNull().default("[]"),
  moodSpellNoted: integer("mood_spell_noted").notNull().default(0),
  moodSpellLastHeavyDay: text("mood_spell_last_heavy_day").notNull().default(""),
});

/** Aelia's heart (migration 0023): a single private row (id = 1)
 *  holding her fading feelings, the kinds of day already counted today,
 *  the counted days not yet folded into a belief, and every belief key
 *  she has ever formed. No message text is stored here, no feeling is
 *  ever shown, and nothing here touches affection or the bond. */
export const heartState = sqliteTable("heart_state", {
  id: integer("id").primaryKey(),
  dayKey: text("day_key").notNull().default(""),
  warmth: integer("warmth").notNull().default(0),
  joy: integer("joy").notNull().default(0),
  concern: integer("concern").notNull().default(0),
  dayKinds: text("day_kinds").notNull().default("[]"),
  episodes: text("episodes").notNull().default("{}"),
  beliefs: text("beliefs").notNull().default("[]"),
});

export const treeState = sqliteTable("tree_state", {
  id: integer("id").primaryKey(),
  plantedAt: integer("planted_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  waterings: integer("waterings").notNull().default(0),
  lastWateredAt: integer("last_watered_at", { mode: "timestamp_ms" }),
});
