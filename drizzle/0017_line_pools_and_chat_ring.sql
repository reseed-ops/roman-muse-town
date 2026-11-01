CREATE TABLE `line_pools` (
	`pool_key` text PRIMARY KEY NOT NULL,
	`bag` text DEFAULT '[]' NOT NULL,
	`last_heard` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_ring` (
	`id` integer PRIMARY KEY NOT NULL,
	`replies` text DEFAULT '[]' NOT NULL
);
