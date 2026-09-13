CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`bucket` text NOT NULL,
	`limite_mensual` real,
	`usa_promedio_movil` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_nombre_unique` ON `categorias` (`nombre`);--> statement-breakpoint
CREATE TABLE `compras_cuotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tarjeta_id` integer NOT NULL,
	`transaccion_origen_id` integer,
	`comercio` text NOT NULL,
	`monto_total` real NOT NULL,
	`monto_cuota` real NOT NULL,
	`total_cuotas` integer NOT NULL,
	`cuotas_pagadas` integer DEFAULT 0 NOT NULL,
	`fecha_compra` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaccion_origen_id`) REFERENCES `transacciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cuentas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`banco` text NOT NULL,
	`alias` text,
	`tipo` text NOT NULL,
	`billetera` text,
	`saldo_inicial` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tarjetas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer,
	`nombre` text NOT NULL,
	`banco` text NOT NULL,
	`fecha_vencimiento` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transacciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cuenta_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`monto` real NOT NULL,
	`moneda` text DEFAULT 'PEN' NOT NULL,
	`comercio` text,
	`descripcion` text,
	`fecha` text NOT NULL,
	`numero_operacion` text,
	`categoria_id` integer,
	`categoria_confirmada` integer DEFAULT false NOT NULL,
	`es_transferencia_interna` integer DEFAULT false NOT NULL,
	`cuenta_destino_id` integer,
	`fuente` text NOT NULL,
	`correo_raw` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cuenta_destino_id`) REFERENCES `cuentas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transacciones_numero_operacion_idx` ON `transacciones` (`numero_operacion`);