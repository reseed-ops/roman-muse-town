-- Adds the Roman year to towns seeded before it existed. A brand-new
-- town's calendar is still empty here, and gets these from the seed.
-- A date the town already keeps is left alone.
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '01-03', 'Compitalia: the feast of the crossroads', 'Woollen dolls and little balls hung at the street shrines, one for everyone in the house, and food shared where the lanes meet.', '#a8552e,#e6d3a8,#5e6b3a'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '01-03');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '02-22', 'Caristia, the family table', 'Quarrels set down for the day and places laid for everyone: the meal where a family makes its peace.', '#9c4a3c,#efe0c4,#6d7a4c'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '02-22');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '03-01', 'Matronalia, the women''s day', 'Spring flowers on every doorstep, and gifts for the women of the house.', '#c9708a,#f3e6d0,#7f9a5b'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '03-01');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '04-21', 'Parilia, Rome''s birthday', 'Bonfires of straw at dusk and the whole town wishing the city many happy returns.', '#d9772b,#f2d27a,#8a3324'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '04-21');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '04-28', 'Floralia, the days of flowers', 'Garlands on every column and the lanes smelling of cut stems.', '#d9568a,#f2c14e,#6db33f'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '04-28');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '06-09', 'Vestalia, the bakers'' holiday', 'Millstones garlanded and the market donkeys decked with violets and loaves of bread.', '#7a5ba6,#e8d6a8,#b5763a'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '06-09');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '07-23', 'Neptunalia, the high summer shade', 'Shelters of leafy boughs along the lanes, and everyone keeping close to the water.', '#2e86ab,#a9d6c8,#4f8a4c'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '07-23');
--> statement-breakpoint
INSERT INTO `festivals` (`sort`, `month_day`, `name`, `dressing`, `colors`)
SELECT (SELECT COALESCE(MAX(`sort`), 0) FROM `festivals`) + 1, '08-23', 'Vulcanalia, the fire watch', 'Small fires lit at nightfall to keep the great ones away, and every lamp minded with care.', '#c8401f,#f0a03a,#3a3230'
WHERE EXISTS (SELECT 1 FROM `festivals`)
  AND NOT EXISTS (SELECT 1 FROM `festivals` WHERE `month_day` = '08-23');
