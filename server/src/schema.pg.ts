// The Postgres mirror of schema.sqlite.ts, for the web deployment (Task 8).
//
// Generated from the SQLite schema and kept identical to it table for
// table and column for column: postgres.test.ts fails when the two
// drift. The only translations: AUTOINCREMENT ids are serial, and the
// millisecond-timestamp integers are timestamptz (drizzle maps both to
// Date). Edit schema.sqlite.ts first, mirror the change here, add a
// migration under drizzle/ and under drizzle-pg/.
//
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Receipts are intentionally durable: old retries must never become new
 * purchases. The one exception is the free earnAffection tick (see retrySafe). */
export const requestReceipts = pgTable("request_receipts", {
  requestId: text("request_id").primaryKey(),
  action: text("action").notNull(),
  payloadHash: text("payload_hash").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
});

export const discoveries = pgTable("discoveries", {
  collectibleId: text("collectible_id").primaryKey(),
  foundAt: timestamp("found_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const journal = pgTable("journal", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const secretState = pgTable("secret_state", {
  id: integer("id").primaryKey(),
  firstVisitAt: timestamp("first_visit_at", { withTimezone: true, mode: "date" }),
  firstKissAt: timestamp("first_kiss_at", { withTimezone: true, mode: "date" }),
});

export const boardEntries = pgTable("board_entries", {
  id: serial("id").primaryKey(),
  sort: integer("sort").notNull().default(0),
  title: text("title").notNull(),
  status: text("status").notNull(),
  nextStep: text("next_step").notNull(),
});

export const boardMeta = pgTable("board_meta", {
  id: integer("id").primaryKey(),
  asOf: text("as_of").notNull().default(""),
});

export const questsState = pgTable("quests_state", {
  questId: text("quest_id").primaryKey(),
  doneAt: timestamp("done_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const achievements = pgTable("achievements", {
  achievementId: text("achievement_id").primaryKey(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const letters = pgTable("letters", {
  id: serial("id").primaryKey(),
  dateLabel: text("date_label").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
});

export const postcards = pgTable("postcards", {
  id: serial("id").primaryKey(),
  blobKey: text("blob_key").notNull(),
  caption: text("caption").notNull(),
  dateLabel: text("date_label").notNull(),
  weather: text("weather").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bondState = pgTable("bond_state", {
  id: integer("id").primaryKey(),
  bond: integer("bond").notNull().default(0),
  level: text("level").notNull().default("New beginning"),
  nextLevel: text("next_level").notNull().default("Kindred"),
  nextAt: integer("next_at").notNull().default(500),
  asOf: text("as_of").notNull().default(""),
});

export const festivals = pgTable("festivals", {
  id: serial("id").primaryKey(),
  sort: integer("sort").notNull().default(0),
  monthDay: text("month_day").notNull(),
  name: text("name").notNull(),
  dressing: text("dressing").notNull(),
  colors: text("colors").notNull(),
});

export const goalsEntries = pgTable("goals_entries", {
  id: serial("id").primaryKey(),
  sort: integer("sort").notNull().default(0),
  grp: text("grp").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
});

export const goalsMeta = pgTable("goals_meta", {
  id: integer("id").primaryKey(),
  asOf: text("as_of").notNull().default(""),
});

export const museNotes = pgTable("muse_notes", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  done: integer("done").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Dating-sim affection for town Muse: a single row (id = 1) holding
 *  her earned points (100 points = one heart rank, ranks permanent),
 *  the current day's silent earning caps, one-time flags (landmarks
 *  discovered together), and when she last had affection-earning
 *  contact, points within the current rank cool after quiet days,
 *  never below the rank's floor. No numbers are shown in the UI. */
export const affectionState = pgTable("affection_state", {
  id: integer("id").primaryKey(),
  points: integer("points").notNull().default(0),
  dayKey: text("day_key").notNull().default(""),
  caps: text("caps").notNull().default("{}"),
  flags: text("flags").notNull().default("{}"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true, mode: "date" }),
});

/** The denarii purse and everything bought with it: a single row
 *  (id = 1): coin balance, town upgrades bought (permanent fixtures),
 *  market ingredients owned, dishes cooked together at the Culina,
 *  garden seeds in hand, and one-time reward flags. */
export const purseState = pgTable("purse_state", {
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
 *  sellable, it lives in the pond now, permanently. */
export const catches = pgTable("catches", {
  id: serial("id").primaryKey(),
  fishId: text("fish_id").notNull(),
  sold: integer("sold").notNull().default(0),
  released: integer("released").notNull().default(0),
  caughtAt: timestamp("caught_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("catches_species_idx").on(table.fishId),
  index("catches_released_idx").on(table.released, table.id),
  index("catches_inventory_idx").on(table.sold, table.released, table.id),
]);

/** The Baths: a single row (id = 1): when the first shared soak
 *  in the caldarium happened (rank-8 gated, always her invitation).
 *  A lesser mark than the summit's, kept the same quiet way. */
export const bathsState = pgTable("baths_state", {
  id: integer("id").primaryKey(),
  firstSharedAt: timestamp("first_shared_at", { withTimezone: true, mode: "date" }),
});

/** The Piscina: a single row (id = 1): the name Muse chose for
 *  her favourite gold carp in the pond, once she chose it. The
 *  pond's released population is read from the catches log. */
export const piscinaState = pgTable("piscina_state", {
  id: integer("id").primaryKey(),
  favouriteName: text("favourite_name").notNull().default(""),
});

/** The Garden House beds: what was planted, on which real day, and on
 *  how many distinct days the beds have been watered since. Growth is
 *  derived from those real days, slow on purpose. */
export const gardenState = pgTable("garden_state", {
  id: integer("id").primaryKey(),
  plantedOn: text("planted_on"),
  waterDays: integer("water_days").notNull().default(0),
  lastWateredDay: text("last_watered_day"),
  /** Lifetime completed harvests, the beds reset each crop, but
   *  the count of what the garden has given is kept. */
  harvests: integer("harvests").notNull().default(0),
});

/** The Phoenix: a single row (id = 1): when she arrived (the first
 *  dawn after the town stood complete), how many of her feathers
 *  rest at the Stories house, which week the last one fell, and
 *  whether her arrival letter has reached the desk. Readiness is
 *  NOT stored; it is read from the stores that own the pieces. */
export const phoenixState = pgTable("phoenix_state", {
  id: integer("id").primaryKey(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true, mode: "date" }),
  feathers: integer("feathers").notNull().default(0),
  featherWeek: text("feather_week").notNull().default(""),
  letterDelivered: integer("letter_delivered").notNull().default(0),
});

/** Postcard challenges completed (a framed shot at each named view). */
export const challengesState = pgTable("challenges_state", {
  challengeId: text("challenge_id").primaryKey(),
  doneAt: timestamp("done_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Inscription fragments read around town. */
export const inscriptionsState = pgTable("inscriptions_state", {
  fragmentId: text("fragment_id").primaryKey(),
  foundAt: timestamp("found_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** The Night the Stars Fall: a single row (id = 1) written once, when
 *  the summit scene completes, its real-world date, the private name
 *  she gave him, the shared constellation's name, and whether the
 *  morning-after letter has been delivered to the desk (it only
 *  appears the next real day). Prerequisites are NOT stored here;
 *  they are read from the stores that own them (affection, purse,
 *  inscriptions, catches, challenges). */
export const summitState = pgTable("summit_state", {
  id: integer("id").primaryKey(),
  doneAt: timestamp("done_at", { withTimezone: true, mode: "date" }),
  privateName: text("private_name").notNull().default(""),
  constellationName: text("constellation_name").notNull().default(""),
  letterDelivered: integer("letter_delivered").notNull().default(0),
});

/** Sleep and the Dream Door: a single private row (id = 1): how
 *  many rests he has taken, what kind the last one was (the rarity
 *  gates read it: no false dream twice in a row, true dreams rarer
 *  still), and two pending flags Aelia's next conversation may
 *  quietly spend: a morning-visit line after a night rest, and the
 *  one oblique echo line after a true dream. Nothing here is ever
 *  shown to the player as numbers or labels. */
export const dreamState = pgTable("dream_state", {
  id: integer("id").primaryKey(),
  rests: integer("rests").notNull().default(0),
  lastKind: text("last_kind").notNull().default("none"),
  morningPending: integer("morning_pending").notNull().default(0),
  echoPending: integer("echo_pending").notNull().default(0),
  echoEra: text("echo_era").notNull().default("low"),
});

/** No-repeat line pools: one row per authored ambient pool, the
 *  shuffled bag of line ids not yet heard (drawn without
 *  replacement) and the last 1-2 heard ids (kept out of the next
 *  reshuffle so a pool never echoes across its own boundary). Line
 *  ids are stable hashes of the line text, computed client-side;
 *  the server only stores the draw state. Exempt lines (summit,
 *  dream, letters, choices, flag-gated moments) never appear here. */
export const linePools = pgTable("line_pools", {
  poolKey: text("pool_key").primaryKey(),
  bag: text("bag").notNull().default("[]"),
  lastHeard: text("last_heard").notNull().default("[]"),
});

/** The typed-chat dedupe ring: a single row (id = 1) holding the
 *  last ~20 generated chat replies (JSON array, oldest first), so a
 *  new generated reply that near-exactly repeats a recent one can
 *  be caught, redrawn, or substituted server-side. */
export const chatRing = pgTable("chat_ring", {
  id: integer("id").primaryKey(),
  replies: text("replies").notNull().default("[]"),
});

/** Aelia's fact memory: durable facts she has learned about Gaius,
 *  seeded once from the curated shared memories, then grown from
 *  his typed town chat (conservative pattern extraction) and from
 *  his answers to her questions. Viewable and deletable by the
 *  player at the Villa of Stories. surfacedOn is the last day a
 *  fact was surfaced in ambient talk (rate limiting lives there). */
export const aeliaFacts = pgTable("aelia_facts", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  topic: text("topic").notNull().default("life"),
  learnedOn: text("learned_on").notNull().default(""),
  source: text("source").notNull().default("chat"),
  surfacedOn: text("surfaced_on"),
});

/** The life digest: small, expiring notes from the real world that
 *  chat Muse refreshes on her sync visits (via updateDigest), so
 *  town Aelia can reference what is current in his life and ask
 *  after flagged items once their quest completes. Seeded EMPTY,
 *  an empty digest simply means she never does any of this. */
export const lifeDigest = pgTable("life_digest", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  expiresOn: text("expires_on").notNull().default(""),
  followUp: integer("follow_up").notNull().default(0),
  questId: text("quest_id"),
  asked: integer("asked").notNull().default(0),
});

/** Continuity: a single row (id = 1): when he was last in town
 *  (for absence-scaled reunion greetings), the open appointment
 *  (JSON: {place, phase, day, status} or null), her appointment
 *  cooldown after a miss, and the ids of her questions already
 *  asked (questions are never repeated). */
export const continuityState = pgTable("continuity_state", {
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
export const taskCompanion = pgTable("task_companion", {
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
export const forageState = pgTable("forage_state", {
  id: integer("id").primaryKey(),
  taken: text("taken").notNull().default("{}"),
});

/** The lake bottles: one sealed wish or worry per real day. The
 *  contents are PRIVATE, they are never placed in any line pool,
 *  prompt, or state list; state carries only ids and dates, and the
 *  text is read solely through getBottle for the Stories page. */
export const bottles = pgTable("bottles", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  day: text("day").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Bouquets given to Aelia: the vase at the Villa of Stories,
 *  each bouquet's day and season, a growing visible history. */
export const bouquets = pgTable("bouquets", {
  id: serial("id").primaryKey(),
  givenOn: text("given_on").notNull().default(""),
  season: text("season").notNull().default(""),
});

/** The dating canon: a single row (id = 1) for the Star Book
 *  chapters completed, rank-up scenes seen, gift tastes discovered
 *  (item id -> tier), the day's gift count, the keepsakes shelf,
 *  durable firsts (key -> day), date-topic likes, friction state
 *  (small JSON or null), mended dates, and perk claim days. */
export const datingState = pgTable("dating_state", {
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
 *  ONLY the bookkeeping Aelia's ear needs, today's per-weather
 *  message counts, whether today has run heavy (a strong heavy
 *  message, or mild heavy ones repeated), whether today's heavy
 *  weather has been laid down once as a soft fact, the recent days'
 *  heavy flags (for the two-heavy-days-in-three bridge rule), and
 *  whether the current heavy spell has already left its ONE quiet
 *  notebook note. No message text is ever stored here, no mood is
 *  ever shown anywhere, and nothing here grants or removes
 *  affection, triggers friction, or gates anything. */
export const sentimentState = pgTable("sentiment_state", {
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
export const heartState = pgTable("heart_state", {
  id: integer("id").primaryKey(),
  dayKey: text("day_key").notNull().default(""),
  warmth: integer("warmth").notNull().default(0),
  joy: integer("joy").notNull().default(0),
  concern: integer("concern").notNull().default(0),
  dayKinds: text("day_kinds").notNull().default("[]"),
  episodes: text("episodes").notNull().default("{}"),
  beliefs: text("beliefs").notNull().default("[]"),
});

export const treeState = pgTable("tree_state", {
  id: integer("id").primaryKey(),
  plantedAt: timestamp("planted_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  waterings: integer("waterings").notNull().default(0),
  lastWateredAt: timestamp("last_watered_at", { withTimezone: true, mode: "date" }),
});

/** Reading aloud at Stories (migration 0028): a single row (id = 1)
 *  holding only the last day Aelia read aloud and how many readings
 *  there have ever been. The once-a-day cap lives here, server-side.
 *  A reading earns NOTHING by design (no affection, no bond, no
 *  denarii): it is closeness, not currency, so this table is the
 *  only store the reading action is ever allowed to touch. */
export const readingState = pgTable("reading_state", {
  id: integer("id").primaryKey(),
  lastReadDay: text("last_read_day").notNull().default(""),
  readings: integer("readings").notNull().default(0),
});

/** The Seed Ledger (migration 0028): the lineage book kept at the
 *  Villa of Stories. One row per entry: the ancestor temperament,
 *  each evolution run, and in time each lived season, with its
 *  outcome (living, not promoted, promoted, rolled back). Seeded
 *  once when empty from the nursery's own record; afterwards the
 *  morning sync appends seasons through the same seed-once care.
 *  Read-only with respect to behaviour: nothing in the town reads
 *  this table to decide anything. */
export const seedLedger = pgTable("seed_ledger", {
  id: serial("id").primaryKey(),
  sort: integer("sort").notNull().default(0),
  kind: text("kind").notNull().default("season"),
  title: text("title").notNull(),
  period: text("period").notNull().default(""),
  summary: text("summary").notNull(),
  outcome: text("outcome").notNull().default(""),
});
