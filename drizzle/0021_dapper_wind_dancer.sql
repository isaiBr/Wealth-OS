PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_compras_cuotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tarjeta_id` integer,
	`transaccion_origen_id` integer,
	`comercio` text NOT NULL,
	`monto_total` real NOT NULL,
	`monto_cuota` real NOT NULL,
	`total_cuotas` integer NOT NULL,
	`cuotas_pagadas` integer DEFAULT 0 NOT NULL,
	`fecha_compra` text NOT NULL,
	`dia_pago` integer,
	`ultimo_pago_mes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaccion_origen_id`) REFERENCES `transacciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_compras_cuotas`("id", "tarjeta_id", "transaccion_origen_id", "comercio", "monto_total", "monto_cuota", "total_cuotas", "cuotas_pagadas", "fecha_compra", "ultimo_pago_mes", "created_at") SELECT "id", "tarjeta_id", "transaccion_origen_id", "comercio", "monto_total", "monto_cuota", "total_cuotas", "cuotas_pagadas", "fecha_compra", "ultimo_pago_mes", "created_at" FROM `compras_cuotas`;--> statement-breakpoint
DROP TABLE `compras_cuotas`;--> statement-breakpoint
ALTER TABLE `__new_compras_cuotas` RENAME TO `compras_cuotas`;--> statement-breakpoint
PRAGMA foreign_keys=ON;