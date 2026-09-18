CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_nombre_unique` ON `tags` (`nombre`);--> statement-breakpoint
CREATE TABLE `transacciones_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaccion_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`transaccion_id`) REFERENCES `transacciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transacciones_tags_par_idx` ON `transacciones_tags` (`transaccion_id`,`tag_id`);