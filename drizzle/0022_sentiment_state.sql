CREATE TABLE `sentiment_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`day_key` text DEFAULT '' NOT NULL,
	`day_counts` text DEFAULT '{}' NOT NULL,
	`day_heavy_messages` integer DEFAULT 0 NOT NULL,
	`day_strong_heavy` integer DEFAULT 0 NOT NULL,
	`day_fact_logged` integer DEFAULT 0 NOT NULL,
	`recent_days` text DEFAULT '[]' NOT NULL,
	`mood_spell_noted` integer DEFAULT 0 NOT NULL,
	`mood_spell_last_heavy_day` text DEFAULT '' NOT NULL
);
