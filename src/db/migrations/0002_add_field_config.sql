-- Migration: 0002_add_field_config.sql
-- Description: Add field_config support for custom field logic in collections

ALTER TABLE collections ADD COLUMN `field_config` text;
