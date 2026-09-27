CREATE TABLE `brief_configuracion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resumen_con_ia` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brief_temas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`clave` text NOT NULL,
	`query` text NOT NULL,
	`cantidad` integer DEFAULT 3 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brief_temas_clave_unique` ON `brief_temas` (`clave`);