CREATE TABLE `metas_compra` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`precio_objetivo` real NOT NULL,
	`fecha_deseada` text,
	`metodo_pago` text NOT NULL,
	`categoria_id` integer NOT NULL,
	`compra_cuota_id` integer,
	`estado` text DEFAULT 'activa' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`compra_cuota_id`) REFERENCES `compras_cuotas`(`id`) ON UPDATE no action ON DELETE no action
);
