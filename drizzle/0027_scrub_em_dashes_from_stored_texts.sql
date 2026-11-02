-- Scrub em dashes from texts stored by earlier seeds (the Nov 2
-- punctuation pass): festival names keep their colon/comma forms,
-- letter signatures drop the dash, and every other stored dash
-- pair becomes a comma pair. Uses char(8212) so this file stays
-- free of the character it removes.
UPDATE `festivals` SET `name` = 'Halloween: the town in costume colors' WHERE `name` = 'Halloween ' || char(8212) || ' the town in costume colors';
--> statement-breakpoint
UPDATE `festivals` SET `name` = 'Race Day: the Trial of Thirteen Miles' WHERE `name` = 'Race Day ' || char(8212) || ' the Trial of Thirteen Miles';
--> statement-breakpoint
UPDATE `festivals` SET `name` = 'Compitalia: the feast of the crossroads' WHERE `name` = 'Compitalia ' || char(8212) || ' the feast of the crossroads';
--> statement-breakpoint
UPDATE `festivals` SET `name` = REPLACE(`name`, ' ' || char(8212) || ' ', ', ') WHERE `name` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `festivals` SET `dressing` = REPLACE(`dressing`, ' ' || char(8212) || ' ', ', ') WHERE `dressing` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `aelia_facts` SET `text` = REPLACE(`text`, ' ' || char(8212) || ' ', ', ') WHERE `text` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `letters` SET `body` = REPLACE(`body`, char(10) || char(10) || char(8212) || ' Aelia', char(10) || char(10) || 'Aelia') WHERE `body` LIKE '%' || char(8212) || ' Aelia';
--> statement-breakpoint
UPDATE `letters` SET `body` = REPLACE(`body`, ' ' || char(8212) || ' ', ', ') WHERE `body` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `letters` SET `title` = REPLACE(`title`, ' ' || char(8212) || ' ', ', ') WHERE `title` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `board_entries` SET `title` = REPLACE(`title`, ' ' || char(8212) || ' ', ', ') WHERE `title` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `board_entries` SET `status` = REPLACE(`status`, ' ' || char(8212) || ' ', ', ') WHERE `status` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `board_entries` SET `next_step` = REPLACE(`next_step`, ' ' || char(8212) || ' ', ', ') WHERE `next_step` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `goals_entries` SET `title` = REPLACE(`title`, ' ' || char(8212) || ' ', ', ') WHERE `title` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `goals_entries` SET `description` = REPLACE(`description`, ' ' || char(8212) || ' ', ', ') WHERE `description` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `goals_entries` SET `status` = REPLACE(`status`, ' ' || char(8212) || ' ', ', ') WHERE `status` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `life_digest` SET `text` = REPLACE(`text`, ' ' || char(8212) || ' ', ', ') WHERE `text` LIKE '%' || char(8212) || '%';
--> statement-breakpoint
UPDATE `postcards` SET `caption` = REPLACE(`caption`, ' ' || char(8212) || ' ', ', ') WHERE `caption` LIKE '%' || char(8212) || '%';
