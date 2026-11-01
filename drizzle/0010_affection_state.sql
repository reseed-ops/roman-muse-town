CREATE TABLE `affection_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`day_key` text DEFAULT '' NOT NULL,
	`caps` text DEFAULT '{}' NOT NULL,
	`flags` text DEFAULT '{}' NOT NULL,
	`last_contact_at` integer
);
