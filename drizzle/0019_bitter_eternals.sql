PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_metas_compra` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`precio_objetivo` real NOT NULL,
	`fecha_deseada` text,
	`metodo_pago` text NOT NULL,
	`categoria_id` integer,
	`compra_cuota_id` integer,
	`estado` text DEFAULT 'activa' NOT NULL,
	`monto_ahorrado` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`compra_cuota_id`) REFERENCES `compras_cuotas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_metas_compra`("id", "nombre", "precio_objetivo", "fecha_deseada", "metodo_pago", "categoria_id", "compra_cuota_id", "estado", "monto_ahorrado", "created_at") SELECT "id", "nombre", "precio_objetivo", "fecha_deseada", "metodo_pago", "categoria_id", "compra_cuota_id", "estado", "monto_ahorrado", "created_at" FROM `metas_compra`;--> statement-breakpoint
DROP TABLE `metas_compra`;--> statement-breakpoint
ALTER TABLE `__new_metas_compra` RENAME TO `metas_compra`;--> statement-breakpoint
PRAGMA foreign_keys=ON;