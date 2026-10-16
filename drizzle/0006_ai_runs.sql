ALTER TABLE `ai_commands` ADD `status` text DEFAULT 'done' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_commands` ADD `parts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_commands` ADD `seen_at` integer;