CREATE TABLE `cobranzas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`descripcion` text NOT NULL,
	`monto_esperado` real NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`fecha_cobro` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
