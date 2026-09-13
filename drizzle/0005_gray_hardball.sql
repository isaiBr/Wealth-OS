CREATE TABLE `fondo_emergencia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer NOT NULL,
	`meta_meses` real NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
