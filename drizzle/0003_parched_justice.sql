CREATE TABLE `gmail_sync_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`history_id` text NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `identificadores_cuenta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer NOT NULL,
	`ultimos_digitos` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identificadores_cuenta_digitos_idx` ON `identificadores_cuenta` (`ultimos_digitos`);