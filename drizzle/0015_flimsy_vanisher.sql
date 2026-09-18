CREATE TABLE `configuracion_ia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sugerir_con_ia` integer DEFAULT true NOT NULL,
	`aprender_reglas_nuevas` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
