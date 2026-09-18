CREATE INDEX `transacciones_cuenta_id_idx` ON `transacciones` (`cuenta_id`);--> statement-breakpoint
CREATE INDEX `transacciones_cuenta_destino_id_idx` ON `transacciones` (`cuenta_destino_id`);--> statement-breakpoint
CREATE INDEX `transacciones_fecha_idx` ON `transacciones` (`fecha`);--> statement-breakpoint
CREATE INDEX `transacciones_categoria_id_idx` ON `transacciones` (`categoria_id`);