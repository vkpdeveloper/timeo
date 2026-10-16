CREATE TABLE `ai_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`input` text NOT NULL,
	`reply` text,
	`model` text NOT NULL,
	`effort` text NOT NULL,
	`actions` text DEFAULT '[]' NOT NULL,
	`error` text,
	`duration_ms` integer,
	`undone_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_commands_user_idx` ON `ai_commands` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `ai_model` text DEFAULT 'deepseek-v4.1-flash' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `ai_effort` text DEFAULT 'low' NOT NULL;