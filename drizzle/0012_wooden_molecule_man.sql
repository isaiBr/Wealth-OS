CREATE TABLE `pagos_cuota` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`compra_cuota_id` integer NOT NULL,
	`mes` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`compra_cuota_id`) REFERENCES `compras_cuotas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pagos_cuota_compra_mes_idx` ON `pagos_cuota` (`compra_cuota_id`,`mes`);