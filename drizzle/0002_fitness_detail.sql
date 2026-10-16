ALTER TABLE `exercises` ADD `weight_basis` text DEFAULT 'total' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `unilateral` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_schedule` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `set_logs` ADD `warmup` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `set_logs` ADD `note` text;--> statement-breakpoint
ALTER TABLE `template_exercises` ADD `reps_min` integer;--> statement-breakpoint
ALTER TABLE `template_exercises` ADD `reps_max` integer;--> statement-breakpoint
ALTER TABLE `template_exercises` ADD `provisional` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `training_notes` text;--> statement-breakpoint
ALTER TABLE `workout_logs` ADD `planned_template_id` text REFERENCES workout_templates(id);--> statement-breakpoint
ALTER TABLE `workout_logs` ADD `status` text DEFAULT 'in_progress' NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_logs` ADD `skip_reason` text;