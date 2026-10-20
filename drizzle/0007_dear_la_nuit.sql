ALTER TABLE `workout_logs` ADD `paused_at` integer;--> statement-breakpoint
ALTER TABLE `workout_logs` ADD `paused_ms` integer DEFAULT 0 NOT NULL;