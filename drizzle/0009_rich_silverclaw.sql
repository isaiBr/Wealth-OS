CREATE TABLE `reglas_categorizacion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patron` text NOT NULL,
	`categoria_id` integer NOT NULL,
	`origen` text NOT NULL,
	`veces_usada` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reglas_categorizacion_patron_idx` ON `reglas_categorizacion` (`patron`);