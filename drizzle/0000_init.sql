CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text,
	`task_id` text,
	`workout_template_id` text,
	`title` text NOT NULL,
	`kind` text DEFAULT 'focus' NOT NULL,
	`date` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`reschedule_count` integer DEFAULT 0 NOT NULL,
	`protected` integer DEFAULT false NOT NULL,
	`done_at` integer,
	`skipped_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `blocks_user_date_idx` ON `blocks` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `body_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real,
	`body_fat_pct` real,
	`waist_cm` real,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `body_metrics_unique` ON `body_metrics` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`water_ml` integer DEFAULT 0 NOT NULL,
	`steps` integer,
	`sleep_hours` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_logs_unique` ON `daily_logs` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `diet_plan_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`time_min` integer,
	`items` text,
	`calories` integer DEFAULT 0 NOT NULL,
	`protein_g` integer DEFAULT 0 NOT NULL,
	`carbs_g` integer DEFAULT 0 NOT NULL,
	`fat_g` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `diet_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `diet_plan_meals_plan_idx` ON `diet_plan_meals` (`plan_id`);--> statement-breakpoint
CREATE TABLE `diet_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`goal` text DEFAULT 'maintain' NOT NULL,
	`calories` integer NOT NULL,
	`protein_g` integer NOT NULL,
	`carbs_g` integer NOT NULL,
	`fat_g` integer NOT NULL,
	`water_ml` integer DEFAULT 3000 NOT NULL,
	`description` text,
	`source` text,
	`active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `diet_plans_user_idx` ON `diet_plans` (`user_id`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`muscle` text NOT NULL,
	`equipment` text,
	`type` text DEFAULT 'weight' NOT NULL,
	`cues` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercises_user_idx` ON `exercises` (`user_id`);--> statement-breakpoint
CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text,
	`task_id` text,
	`block_id` text,
	`label` text NOT NULL,
	`date` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`planned_min` integer NOT NULL,
	`focused_min` integer DEFAULT 0 NOT NULL,
	`pauses` integer DEFAULT 0 NOT NULL,
	`rating` integer,
	`energy` integer,
	`quality` integer,
	`notes` text,
	`blockers` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `focus_user_date_idx` ON `focus_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `goal_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	`week_start` text NOT NULL,
	`status` text NOT NULL,
	`confidence` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_updates_goal_idx` ON `goal_updates` (`goal_id`,`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`season_id` text NOT NULL,
	`title` text NOT NULL,
	`outcome` text,
	`why` text,
	`tier` text DEFAULT 'core' NOT NULL,
	`area` text DEFAULT 'work' NOT NULL,
	`color` text DEFAULT 'coral' NOT NULL,
	`weekly_hours` real DEFAULT 3 NOT NULL,
	`system` text,
	`status` text DEFAULT 'on_track' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_season_idx` ON `goals` (`season_id`);--> statement-breakpoint
CREATE TABLE `gym_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`template_id` text,
	`label` text,
	`start_min` integer,
	`duration_min` integer DEFAULT 60 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gym_schedule_unique` ON `gym_schedule` (`user_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`plan_meal_id` text,
	`name` text NOT NULL,
	`calories` integer DEFAULT 0 NOT NULL,
	`protein_g` integer DEFAULT 0 NOT NULL,
	`carbs_g` integer DEFAULT 0 NOT NULL,
	`fat_g` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_meal_id`) REFERENCES `diet_plan_meals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meal_logs_user_date_idx` ON `meal_logs` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`done_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_goal_idx` ON `milestones` (`goal_id`);--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`mood` integer,
	`energy` integer,
	`wins` text,
	`slipped` text,
	`learned` text,
	`next` text,
	`energisers` text,
	`drainers` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reflections_unique` ON `reflections` (`user_id`,`kind`,`date`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`intention` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`brain_dump` text,
	`weekly_capacity_hours` integer DEFAULT 15 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seasons_user_idx` ON `seasons` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_log_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_order` integer DEFAULT 0 NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`duration_sec` integer,
	`rpe` real,
	`done` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workout_log_id`) REFERENCES `workout_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `set_logs_workout_idx` ON `set_logs` (`workout_log_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text,
	`milestone_id` text,
	`title` text NOT NULL,
	`notes` text,
	`week_start` text,
	`due_date` text,
	`due_min` integer,
	`estimate_min` integer,
	`done_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_user_due_idx` ON `tasks` (`user_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_goal_idx` ON `tasks` (`goal_id`);--> statement-breakpoint
CREATE TABLE `template_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`sets` integer DEFAULT 3 NOT NULL,
	`reps` text DEFAULT '8-12' NOT NULL,
	`weight_kg` real,
	`rest_sec` integer DEFAULT 90 NOT NULL,
	`notes` text,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `template_ex_template_idx` ON `template_exercises` (`template_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`day_start_min` integer DEFAULT 360 NOT NULL,
	`day_end_min` integer DEFAULT 1380 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workout_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_id` text,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`feeling` integer,
	`notes` text,
	`cardio_min` integer,
	`distance_km` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workout_logs_user_date_idx` ON `workout_logs` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `workout_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`focus` text,
	`color` text DEFAULT 'sky' NOT NULL,
	`estimated_min` integer DEFAULT 60 NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `templates_user_idx` ON `workout_templates` (`user_id`);