CREATE TABLE `aelia_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`topic` text DEFAULT 'life' NOT NULL,
	`learned_on` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'chat' NOT NULL,
	`surfaced_on` text
);
--> statement-breakpoint
CREATE TABLE `life_digest` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`expires_on` text DEFAULT '' NOT NULL,
	`follow_up` integer DEFAULT 0 NOT NULL,
	`quest_id` text,
	`asked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `continuity_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_seen_day` text DEFAULT '' NOT NULL,
	`absence_days` integer DEFAULT 0 NOT NULL,
	`appointment` text,
	`cooldown_until` text DEFAULT '' NOT NULL,
	`asked_questions` text DEFAULT '[]' NOT NULL
);
