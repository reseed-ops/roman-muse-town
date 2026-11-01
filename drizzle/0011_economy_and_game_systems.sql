CREATE TABLE `purse_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`denarii` integer DEFAULT 0 NOT NULL,
	`upgrades` text DEFAULT '[]' NOT NULL,
	`ingredients` text DEFAULT '[]' NOT NULL,
	`dishes` text DEFAULT '[]' NOT NULL,
	`seeds` integer DEFAULT 0 NOT NULL,
	`flags` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fish_id` text NOT NULL,
	`sold` integer DEFAULT 0 NOT NULL,
	`caught_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `garden_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`planted_on` text,
	`water_days` integer DEFAULT 0 NOT NULL,
	`last_watered_day` text
);
--> statement-breakpoint
CREATE TABLE `challenges_state` (
	`challenge_id` text PRIMARY KEY NOT NULL,
	`done_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inscriptions_state` (
	`fragment_id` text PRIMARY KEY NOT NULL,
	`found_at` integer NOT NULL
);
