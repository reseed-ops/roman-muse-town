CREATE INDEX `catches_species_idx` ON `catches` (`fish_id`);
--> statement-breakpoint
CREATE INDEX `catches_released_idx` ON `catches` (`released`, `id`);
--> statement-breakpoint
CREATE INDEX `catches_inventory_idx` ON `catches` (`sold`, `released`, `id`);
