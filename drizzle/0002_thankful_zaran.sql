DROP INDEX `transacciones_numero_operacion_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `transacciones_numero_operacion_tipo_idx` ON `transacciones` (`numero_operacion`,`tipo`);