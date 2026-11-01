CREATE TABLE `dating_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`starbook` text DEFAULT '[]' NOT NULL,
	`rank_scenes` text DEFAULT '[]' NOT NULL,
	`tastes` text DEFAULT '{}' NOT NULL,
	`gift_day` text DEFAULT '' NOT NULL,
	`gift_count` integer DEFAULT 0 NOT NULL,
	`keepsakes` text DEFAULT '[]' NOT NULL,
	`firsts` text DEFAULT '{}' NOT NULL,
	`date_likes` text DEFAULT '[]' NOT NULL,
	`friction` text,
	`friction_mended` text DEFAULT '[]' NOT NULL,
	`last_friction_day` text DEFAULT '' NOT NULL,
	`perk_claims` text DEFAULT '{}' NOT NULL
);
