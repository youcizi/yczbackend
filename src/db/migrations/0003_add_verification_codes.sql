CREATE TABLE `verification_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'register',
	`expires_at` integer NOT NULL,
	`created_at` integer
);
