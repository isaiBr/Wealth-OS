CREATE TABLE `configuracion_finanzas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ocultar_saldos` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
