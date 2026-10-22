CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`account` text,
	`credentials` text NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`synced_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_unique` ON `integrations` (`user_id`,`provider`);--> statement-breakpoint
ALTER TABLE `blocks` ADD `source` text;--> statement-breakpoint
ALTER TABLE `blocks` ADD `integration_id` text REFERENCES integrations(id);--> statement-breakpoint
ALTER TABLE `blocks` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `blocks` ADD `external_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_external_idx` ON `blocks` (`integration_id`,`external_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `source` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `integration_id` text REFERENCES integrations(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `external_url` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `external_state` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_external_idx` ON `tasks` (`integration_id`,`external_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_idx` ON `users` (`google_id`);