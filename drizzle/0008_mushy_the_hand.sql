ALTER TABLE `compras_cuotas` ADD `ultimo_pago_mes` text;--> statement-breakpoint
ALTER TABLE `transacciones` ADD `excluida` integer DEFAULT false NOT NULL;