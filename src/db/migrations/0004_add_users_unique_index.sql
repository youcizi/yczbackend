CREATE UNIQUE INDEX `user_tenant_email_idx` ON `users` (`tenant_id`, `email`);
