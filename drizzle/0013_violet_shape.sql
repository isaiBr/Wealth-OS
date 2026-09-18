CREATE TABLE `deudas_manuales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`descripcion` text NOT NULL,
	`monto_adeudado` real NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`fecha_pago` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
