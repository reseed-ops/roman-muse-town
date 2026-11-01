CREATE TABLE IF NOT EXISTS `dream_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`rests` integer DEFAULT 0 NOT NULL,
	`last_kind` text DEFAULT 'none' NOT NULL,
	`morning_pending` integer DEFAULT 0 NOT NULL,
	`echo_pending` integer DEFAULT 0 NOT NULL,
	`echo_era` text DEFAULT 'low' NOT NULL
);
