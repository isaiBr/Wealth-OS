ALTER TABLE `transacciones` ADD `gmail_message_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transacciones_gmail_message_id_idx` ON `transacciones` (`gmail_message_id`);