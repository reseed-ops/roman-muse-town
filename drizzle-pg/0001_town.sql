CREATE TABLE "achievements" (
	"achievement_id" text PRIMARY KEY NOT NULL,
	"unlocked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aelia_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"topic" text NOT NULL DEFAULT 'life',
	"learned_on" text NOT NULL DEFAULT '',
	"source" text NOT NULL DEFAULT 'chat',
	"surfaced_on" text
);
--> statement-breakpoint
CREATE TABLE "affection_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"points" integer NOT NULL DEFAULT 0,
	"day_key" text NOT NULL DEFAULT '',
	"caps" text NOT NULL DEFAULT '{}',
	"flags" text NOT NULL DEFAULT '{}',
	"last_contact_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "baths_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_shared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "board_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer NOT NULL DEFAULT 0,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"next_step" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_meta" (
	"id" integer PRIMARY KEY NOT NULL,
	"as_of" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "bond_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"bond" integer NOT NULL DEFAULT 0,
	"level" text NOT NULL DEFAULT 'New beginning',
	"next_level" text NOT NULL DEFAULT 'Kindred',
	"next_at" integer NOT NULL DEFAULT 500,
	"as_of" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "bottles" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"day" text NOT NULL DEFAULT '',
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bouquets" (
	"id" serial PRIMARY KEY NOT NULL,
	"given_on" text NOT NULL DEFAULT '',
	"season" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "catches" (
	"id" serial PRIMARY KEY NOT NULL,
	"fish_id" text NOT NULL,
	"sold" integer NOT NULL DEFAULT 0,
	"released" integer NOT NULL DEFAULT 0,
	"caught_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "catches_species_idx" ON "catches" ("fish_id");
--> statement-breakpoint
CREATE INDEX "catches_released_idx" ON "catches" ("released", "id");
--> statement-breakpoint
CREATE INDEX "catches_inventory_idx" ON "catches" ("sold", "released", "id");
--> statement-breakpoint
CREATE TABLE "challenges_state" (
	"challenge_id" text PRIMARY KEY NOT NULL,
	"done_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_ring" (
	"id" integer PRIMARY KEY NOT NULL,
	"replies" text NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE "continuity_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_seen_day" text NOT NULL DEFAULT '',
	"absence_days" integer NOT NULL DEFAULT 0,
	"appointment" text,
	"cooldown_until" text NOT NULL DEFAULT '',
	"asked_questions" text NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE "dating_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"starbook" text NOT NULL DEFAULT '[]',
	"rank_scenes" text NOT NULL DEFAULT '[]',
	"tastes" text NOT NULL DEFAULT '{}',
	"gift_day" text NOT NULL DEFAULT '',
	"gift_count" integer NOT NULL DEFAULT 0,
	"keepsakes" text NOT NULL DEFAULT '[]',
	"firsts" text NOT NULL DEFAULT '{}',
	"date_likes" text NOT NULL DEFAULT '[]',
	"friction" text,
	"friction_mended" text NOT NULL DEFAULT '[]',
	"last_friction_day" text NOT NULL DEFAULT '',
	"perk_claims" text NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "discoveries" (
	"collectible_id" text PRIMARY KEY NOT NULL,
	"found_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dream_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"rests" integer NOT NULL DEFAULT 0,
	"last_kind" text NOT NULL DEFAULT 'none',
	"morning_pending" integer NOT NULL DEFAULT 0,
	"echo_pending" integer NOT NULL DEFAULT 0,
	"echo_era" text NOT NULL DEFAULT 'low'
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer NOT NULL DEFAULT 0,
	"month_day" text NOT NULL,
	"name" text NOT NULL,
	"dressing" text NOT NULL,
	"colors" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forage_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"taken" text NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "garden_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"planted_on" text,
	"water_days" integer NOT NULL DEFAULT 0,
	"last_watered_day" text,
	"harvests" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "goals_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer NOT NULL DEFAULT 0,
	"grp" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals_meta" (
	"id" integer PRIMARY KEY NOT NULL,
	"as_of" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "heart_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"day_key" text NOT NULL DEFAULT '',
	"warmth" integer NOT NULL DEFAULT 0,
	"joy" integer NOT NULL DEFAULT 0,
	"concern" integer NOT NULL DEFAULT 0,
	"day_kinds" text NOT NULL DEFAULT '[]',
	"episodes" text NOT NULL DEFAULT '{}',
	"beliefs" text NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE "inscriptions_state" (
	"fragment_id" text PRIMARY KEY NOT NULL,
	"found_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_label" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "life_digest" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"expires_on" text NOT NULL DEFAULT '',
	"follow_up" integer NOT NULL DEFAULT 0,
	"quest_id" text,
	"asked" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "line_pools" (
	"pool_key" text PRIMARY KEY NOT NULL,
	"bag" text NOT NULL DEFAULT '[]',
	"last_heard" text NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE "muse_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"done" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phoenix_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"arrived_at" timestamp with time zone,
	"feathers" integer NOT NULL DEFAULT 0,
	"feather_week" text NOT NULL DEFAULT '',
	"letter_delivered" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "piscina_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"favourite_name" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "postcards" (
	"id" serial PRIMARY KEY NOT NULL,
	"blob_key" text NOT NULL,
	"caption" text NOT NULL,
	"date_label" text NOT NULL,
	"weather" text NOT NULL DEFAULT '',
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purse_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"denarii" integer NOT NULL DEFAULT 0,
	"upgrades" text NOT NULL DEFAULT '[]',
	"ingredients" text NOT NULL DEFAULT '[]',
	"dishes" text NOT NULL DEFAULT '[]',
	"seeds" integer NOT NULL DEFAULT 0,
	"flags" text NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "quests_state" (
	"quest_id" text PRIMARY KEY NOT NULL,
	"done_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_read_day" text NOT NULL DEFAULT '',
	"readings" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "request_receipts" (
	"request_id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"payload_hash" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secret_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_visit_at" timestamp with time zone,
	"first_kiss_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seed_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer NOT NULL DEFAULT 0,
	"kind" text NOT NULL DEFAULT 'season',
	"title" text NOT NULL,
	"period" text NOT NULL DEFAULT '',
	"summary" text NOT NULL,
	"outcome" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "sentiment_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"day_key" text NOT NULL DEFAULT '',
	"day_counts" text NOT NULL DEFAULT '{}',
	"day_heavy_messages" integer NOT NULL DEFAULT 0,
	"day_strong_heavy" integer NOT NULL DEFAULT 0,
	"day_fact_logged" integer NOT NULL DEFAULT 0,
	"recent_days" text NOT NULL DEFAULT '[]',
	"mood_spell_noted" integer NOT NULL DEFAULT 0,
	"mood_spell_last_heavy_day" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "summit_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"done_at" timestamp with time zone,
	"private_name" text NOT NULL DEFAULT '',
	"constellation_name" text NOT NULL DEFAULT '',
	"letter_delivered" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "task_companion" (
	"id" integer PRIMARY KEY NOT NULL,
	"muster_day" text NOT NULL DEFAULT '',
	"celebrated" text NOT NULL DEFAULT '[]',
	"eve_touched" text NOT NULL DEFAULT '[]',
	"overdue_touched" text NOT NULL DEFAULT '{}',
	"last_seek_day" text NOT NULL DEFAULT '',
	"seek_json" text,
	"seek_found_count" integer NOT NULL DEFAULT 0,
	"last_seek_found_day" text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "tree_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"planted_at" timestamp with time zone NOT NULL,
	"waterings" integer NOT NULL DEFAULT 0,
	"last_watered_at" timestamp with time zone
);
